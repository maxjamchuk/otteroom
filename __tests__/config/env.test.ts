/** @jest-environment node */
const mockCreateClient = jest.fn(() => ({ auth: {} }));
jest.mock('@supabase/supabase-js', () => ({ createClient: mockCreateClient }));
jest.mock('../../src/lib/auth-storage', () => ({ authStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } }));

const original = { ...process.env };
beforeEach(() => { jest.resetModules(); mockCreateClient.mockClear(); });
afterEach(() => { process.env = { ...original }; });

function configure(url?: string, key?: string) {
  delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (url !== undefined) process.env.EXPO_PUBLIC_SUPABASE_URL = url;
  if (key !== undefined) process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = key;
}

it.each([
  [undefined, 'public-test', 'EXPO_PUBLIC_SUPABASE_URL'],
  ['', 'public-test', 'EXPO_PUBLIC_SUPABASE_URL'],
  ['not-a-url', 'public-test', 'EXPO_PUBLIC_SUPABASE_URL'],
  ['ftp://localhost', 'public-test', 'EXPO_PUBLIC_SUPABASE_URL'],
  ['https://private:password@example.com', 'public-test', 'EXPO_PUBLIC_SUPABASE_URL'],
  ['https://example.com', undefined, 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'],
  ['https://example.com', '  ', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'],
  ['https://example.com', 'sb_secret_synthetic', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'],
])('rejects invalid configuration before client construction (%#)', (url, key, field) => {
  configure(url, key);
  const { getSupabase } = require('../../src/lib/supabase');
  let failure: Error | undefined;
  try { getSupabase(); } catch (error) { failure = error as Error; }
  expect(failure?.message).toContain(field);
  expect(failure?.message).toContain('env:local');
  expect(failure?.message.includes('private:password')).toBe(false);
  expect(failure?.message.includes('sb_secret_synthetic')).toBe(false);
  expect(mockCreateClient).not.toHaveBeenCalled();
});

it('module evaluation does not construct a client, read storage, or require env during static export', () => {
  configure();
  require('../../src/config/env');
  require('../../src/lib/supabase');
  expect(mockCreateClient).not.toHaveBeenCalled();
});

it('privileged environment fields cannot substitute for the required public key', () => {
  configure('http://127.0.0.1:55321');
  process.env.SERVICE_ROLE_KEY = 'synthetic-private';
  process.env.SECRET_KEY = 'synthetic-private';
  expect(() => require('../../src/lib/supabase').getSupabase()).toThrow('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  expect(mockCreateClient).not.toHaveBeenCalled();
});

it.each(['http://127.0.0.1:55321', 'https://example.com'])('constructs exactly one typed client after valid config (%s)', url => {
  configure(url, 'sb_publishable_synthetic');
  const { getSupabase } = require('../../src/lib/supabase');
  expect(getSupabase()).toBe(getSupabase());
  expect(mockCreateClient).toHaveBeenCalledTimes(1);
  expect(mockCreateClient).toHaveBeenCalledWith(url, 'sb_publishable_synthetic', {
    auth: expect.objectContaining({ persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }),
  });
  const options = mockCreateClient.mock.calls[0] as unknown as [string, string, { auth: { storage: unknown } }];
  expect(options[2].auth.storage).toBe(require('../../src/lib/auth-storage').authStorage);
});
