import type { Session } from '@supabase/supabase-js';
import { spawnSync } from 'node:child_process';

const mockGetSession = jest.fn();
const mockSignIn = jest.fn();
const mockPersisted = jest.fn();
const mockClient = { auth: { getSession: mockGetSession, signInAnonymously: mockSignIn } };
const mockGetClient = jest.fn(() => mockClient);
jest.mock('../../src/lib/supabase', () => ({ getSupabase: mockGetClient, hasPersistedSession: mockPersisted }));

const session = (id = 'synthetic-original') => ({ user: { id }, access_token: 'synthetic-access', refresh_token: 'synthetic-refresh' }) as Session;
const result = (value: Session | null, error: unknown = null) => ({ data: { session: value }, error });
const load = () => require('../../src/auth/anonymous-session') as typeof import('../../src/auth/anonymous-session');

beforeEach(() => {
  jest.resetModules(); jest.clearAllMocks();
  mockPersisted.mockReturnValue(false);
  mockGetSession.mockReset().mockResolvedValue(result(null));
  mockSignIn.mockReset().mockResolvedValue(result(session()));
});

it('module evaluation does not construct or start Auth', () => {
  load();
  expect(mockGetClient).not.toHaveBeenCalled();
  expect(mockGetSession).not.toHaveBeenCalled();
  expect(mockSignIn).not.toHaveBeenCalled();
});

it('does not expose ready or sign in when a recovered session lacks its participant', async () => {
  mockGetSession.mockResolvedValue(result({ ...session(), user: undefined } as unknown as Session));
  await expect(load().bootstrapAnonymousSession()).rejects.toThrow('Unable to restore');
  expect(mockSignIn).not.toHaveBeenCalled();
});

it('restores retained sessions on repeated bootstrap/reconnect without signing in', async () => {
  mockPersisted.mockReturnValue(true);
  mockGetSession.mockResolvedValue(result(session()));
  const { bootstrapAnonymousSession } = load();
  for (let i = 0; i < 3; i++) expect((await bootstrapAnonymousSession()).user.id).toBe('synthetic-original');
  expect(mockSignIn).not.toHaveBeenCalled();
});

it('checks storage then getSession before one absent-session sign-in', async () => {
  await load().bootstrapAnonymousSession();
  expect(mockPersisted.mock.invocationCallOrder[0]).toBeLessThan(mockGetClient.mock.invocationCallOrder[0]);
  expect(mockGetSession.mock.invocationCallOrder[0]).toBeLessThan(mockSignIn.mock.invocationCallOrder[0]);
  expect(mockSignIn).toHaveBeenCalledTimes(1);
});

it('shares exactly one in-flight promise and releases a successful flight', async () => {
  let resolve!: (value: ReturnType<typeof result>) => void;
  mockGetSession.mockReturnValue(new Promise(done => { resolve = done; }));
  const { bootstrapAnonymousSession } = load();
  const a = bootstrapAnonymousSession(), b = bootstrapAnonymousSession();
  expect(a).toBe(b);
  await Promise.resolve();
  resolve(result(null));
  await Promise.all([a, b]);
  expect(mockSignIn).toHaveBeenCalledTimes(1);
  mockGetSession.mockResolvedValue(result(session()));
  expect(bootstrapAnonymousSession()).not.toBe(a);
  await bootstrapAnonymousSession();
  expect(mockSignIn).toHaveBeenCalledTimes(1);
});

it.each(['returned', 'thrown', 'storage', 'removed-by-recovery'])('failed restore never signs in a replacement (%s)', async mode => {
  mockPersisted.mockReturnValue(true);
  if (mode === 'returned') mockGetSession.mockResolvedValue(result(null, { message: 'sensitive' }));
  if (mode === 'thrown') mockGetSession.mockRejectedValue(new Error('sensitive'));
  if (mode === 'storage') mockPersisted.mockImplementation(() => { throw new Error('sensitive'); });
  const { bootstrapAnonymousSession } = load();
  await expect(bootstrapAnonymousSession()).rejects.toThrow('Unable to restore your local session. Please try again.');
  await expect(bootstrapAnonymousSession()).rejects.toThrow('Unable to restore');
  expect(mockSignIn).not.toHaveBeenCalled();
});

it('failed shared flight is released; explicit retry rechecks storage rather than blindly signing up', async () => {
  mockSignIn.mockResolvedValueOnce(result(null, { message: 'sensitive', status: 503 }));
  const { bootstrapAnonymousSession } = load();
  const a = bootstrapAnonymousSession(), b = bootstrapAnonymousSession();
  expect(a).toBe(b);
  await expect(a).rejects.toThrow('Unable to restore');
  await Promise.resolve();
  expect(mockSignIn).toHaveBeenCalledTimes(1);
  mockPersisted.mockReturnValue(true);
  mockGetSession.mockResolvedValue(result(session()));
  expect((await bootstrapAnonymousSession()).user.id).toBe('synthetic-original');
  expect(mockSignIn).toHaveBeenCalledTimes(1);
  expect(mockGetSession).toHaveBeenCalledTimes(2);
});

it('HTTP 429 stays a safe budget classification, with one attempt per explicit retry and no loop', async () => {
  mockSignIn.mockResolvedValue(result(null, { status: 429, message: 'sensitive', body: 'sensitive' }));
  const { bootstrapAnonymousSession } = load();
  for (let i = 1; i <= 2; i++) {
    let failure: unknown;
    try { await bootstrapAnonymousSession(); } catch (error) { failure = error; }
    expect(failure).toMatchObject({ category: 'auth-budget', status: 429 });
    expect(JSON.stringify(failure).includes('sensitive')).toBe(false);
    expect(mockSignIn).toHaveBeenCalledTimes(i);
    await Promise.resolve();
    expect(mockSignIn).toHaveBeenCalledTimes(i);
  }
});

it('a fresh module after explicitly cleared storage creates a distinct participant', async () => {
  mockGetSession.mockResolvedValueOnce(result(session()));
  expect((await load().bootstrapAnonymousSession()).user.id).toBe('synthetic-original');
  jest.resetModules();
  mockGetSession.mockResolvedValue(result(null));
  mockSignIn.mockResolvedValue(result(session('synthetic-new')));
  expect((await load().bootstrapAnonymousSession()).user.id).toBe('synthetic-new');
  expect(mockSignIn).toHaveBeenCalledTimes(1);
});

it('refresh error preserves the prior recoverable identity, and retry sees updated session tokens', async () => {
  mockPersisted.mockReturnValue(true);
  mockGetSession.mockResolvedValueOnce(result(session()))
    .mockResolvedValueOnce(result(null, { status: 503 }))
    .mockResolvedValueOnce(result({ ...session(), access_token: 'synthetic-refreshed' }));
  const { bootstrapAnonymousSession } = load();
  await bootstrapAnonymousSession();
  await expect(bootstrapAnonymousSession()).rejects.toThrow('Unable to restore');
  const refreshed = await bootstrapAnonymousSession();
  expect(refreshed.user.id).toBe('synthetic-original');
  expect(refreshed.access_token === 'synthetic-refreshed').toBe(true);
  expect(mockSignIn).not.toHaveBeenCalled();
});

it('concurrent protected callbacks wait for bootstrap and none run after failure', async () => {
  let resolve!: (value: ReturnType<typeof result>) => void;
  mockGetSession.mockReturnValue(new Promise(done => { resolve = done; }));
  const { withParticipant } = load();
  const action = jest.fn();
  const a = withParticipant(action), b = withParticipant(action);
  expect(action).not.toHaveBeenCalled();
  await Promise.resolve(); resolve(result(null, { status: 503 }));
  await expect(a).rejects.toThrow('Unable to restore');
  await expect(b).rejects.toThrow('Unable to restore');
  expect(action).not.toHaveBeenCalled();
  mockGetSession.mockResolvedValue(result(session()));
  await withParticipant(action);
  expect(action).toHaveBeenCalledTimes(1);
});

it('the pinned real SDK refreshes stored tokens and exposes them to the same client without any signup or channel', () => {
  const child = spawnSync(process.execPath, ['--input-type=module'], {
    input: `
      import assert from 'node:assert/strict';
      import { randomUUID } from 'node:crypto';
      import { createClient } from '@supabase/supabase-js';
      const id = randomUUID(), key = 'sb-synthetic-auth-token';
      const token = () => [randomUUID(), randomUUID(), randomUUID()].map(x=>x.replaceAll('-','')).join('.');
      const original = { access_token: token(), refresh_token: randomUUID(), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now()/1000)+3600, user: { id, is_anonymous: true } };
      const next = { ...original, access_token: token(), refresh_token: randomUUID() };
      const values = new Map([[key, JSON.stringify(original)]]); let refreshes=0;
      const client = createClient('http://synthetic.invalid', 'synthetic-public', {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: key,
          storage: { getItem: k=>values.get(k)??null, setItem: (k,v)=>{values.set(k,v);}, removeItem:k=>{values.delete(k);} } },
        global: { fetch: async url => { assert.equal(String(url).endsWith('/auth/v1/token?grant_type=refresh_token'), true); refreshes++; return new Response(JSON.stringify(next),{status:200,headers:{'content-type':'application/json'}}); } }
      });
      try {
        assert.equal((await client.auth.getSession()).data.session.user.id === id, true);
        const refreshed = await client.auth.refreshSession();
        assert.equal(refreshed.error === null, true);
        assert.equal(refreshed.data.session.user.id === id, true);
        assert.equal(JSON.parse(values.get(key)).access_token === next.access_token, true);
        assert.equal(await client.realtime.accessToken() === next.access_token, true);
        assert.equal(refreshes, 1); assert.equal(client.getChannels().length, 0);
      } finally { await client.auth.dispose(); values.clear(); }
    `,
    encoding: 'utf8', timeout: 15000, maxBuffer: 65536,
  });
  // Never forward the child streams or a value-bearing assertion diff.
  expect(child.error === undefined && child.status === 0).toBe(true);
});
