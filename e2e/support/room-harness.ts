import { spawnSync } from 'node:child_process';
import { expect, type Page, type Browser, type BrowserContextOptions, type TestInfo, type Response, type Request, type Frame, type WebSocketRoute } from '@playwright/test';
import { safeBody, SafeDiagnostics } from './safe-diagnostics.ts';

export type PublicApi = { origin: string; publicKey: string };
export type RoomProjection = { id: string; code: string; state: string; voter_count: number;
  required_voter_count: number; filter_completed_count: number };
export type CreationConfiguration = { requiredVoterCount: number; creatorIsVoter: boolean };
export const twoVoters = { requiredVoterCount: 2, creatorIsVoter: true } as const;
type Member = { id: string; room_id: string; user_id: string; is_voter: boolean; joined_at: string };
type StoredRoom = RoomProjection & { creator_user_id: string; creation_request_id: string;
  created_at: string; updated_at: string; movie_candidate_id: string | null };
type StoredFilter = { room_member_id: string; genres: string[]; release_year_from: number;
  release_year_to: number; xmin: string };
const candidateTraffic = new WeakMap<Page, { count: number; listener: (request: Request) => void }>();

export function observeCandidateRpcZero(page: Page) {
  let traffic = candidateTraffic.get(page);
  if (!traffic) {
    traffic = { count: 0, listener: request => {
      if (new URL(request.url()).pathname === '/rest/v1/rpc/ensure_room_candidate') traffic!.count++;
    } };
    candidateTraffic.set(page, traffic); page.on('request', traffic.listener);
  }
  return { count: () => traffic!.count };
}

// Owner-only bounded snapshots remain in memory. No browser credentials,
// application roster endpoint, diagnostic dumps or derived host/guest authority.
export function committedRoomSnapshot(room: RoomProjection) {
  if (!/^[0-9a-f-]{36}$/.test(room.id) || !/^[0-9A-F]{10}$/.test(room.code)) throw new Error('E2E_SAFE_FAILURE');
  const result = spawnSync('docker', ['exec', 'supabase_db_otteroom-room-session',
    'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-At', '-c',
    `SELECT coalesce(json_agg(json_build_object('row', row_to_json(r), 'xmin', r.xmin::text,
      'members', (SELECT coalesce(json_agg(m ORDER BY m.user_id), '[]'::json) FROM
        (SELECT * FROM public.room_members WHERE room_id=r.id ORDER BY user_id LIMIT 6) m),
      'filters', (SELECT coalesce(json_agg(f ORDER BY f.room_member_id), '[]'::json) FROM
        (SELECT pf.room_member_id,pf.genres,pf.release_year_from,pf.release_year_to,pf.xmin::text AS xmin
         FROM public.participant_filters pf JOIN public.room_members rm ON rm.id=pf.room_member_id
         WHERE rm.room_id=r.id ORDER BY pf.room_member_id LIMIT 5) f)) ORDER BY id), '[]'::json)
      FROM public.rooms r WHERE id='${room.id}'::uuid OR code='${room.code}';`],
  { encoding: 'utf8', maxBuffer: 65536, timeout: 10000 });
  if (result.status !== 0 || result.error) throw new Error('E2E_SAFE_FAILURE');
  try {
    const snapshots = JSON.parse(result.stdout);
    if (!Array.isArray(snapshots) || snapshots.length !== 1 || !/^[0-9]+$/.test(snapshots[0].xmin)) throw new Error();
    const { row, members, filters } = snapshots[0] as { row: StoredRoom; members: Member[]; filters: StoredFilter[] };
    if (!row || row.id !== room.id || row.code !== room.code ||
      Object.keys(row).sort().join(',') !== 'code,created_at,creation_request_id,creator_user_id,filter_completed_count,id,movie_candidate_id,required_voter_count,state,updated_at,voter_count' ||
      !Number.isInteger(row.required_voter_count) || row.required_voter_count < 2 || row.required_voter_count > 2147483647 ||
      !Number.isInteger(row.voter_count) || row.voter_count < 0 || row.voter_count > row.required_voter_count ||
      row.state !== (row.voter_count === row.required_voter_count ? 'ready' : 'waiting') ||
      !Number.isInteger(row.filter_completed_count) || row.filter_completed_count < 0 ||
      row.filter_completed_count > row.required_voter_count || row.filter_completed_count > 0 && row.state !== 'ready' ||
      row.movie_candidate_id !== null && typeof row.movie_candidate_id !== 'string' ||
      !Array.isArray(members) || members.length < 1 || members.length > 5 ||
      members.some(m => Object.keys(m).sort().join(',') !== 'id,is_voter,joined_at,room_id,user_id' || m.room_id !== row.id ||
        typeof m.is_voter !== 'boolean' || !/^[0-9a-f-]{36}$/.test(m.id) || !/^[0-9a-f-]{36}$/.test(m.user_id) || typeof m.joined_at !== 'string') ||
      new Set(members.map(m => m.user_id)).size !== members.length || new Set(members.map(m => m.id)).size !== members.length ||
      members.filter(m => m.user_id === row.creator_user_id).length !== 1 ||
      members.some(m => !m.is_voter && m.user_id !== row.creator_user_id) ||
      members.filter(m => m.is_voter).length !== row.voter_count || !Array.isArray(filters) || filters.length > 5 ||
      filters.length !== row.filter_completed_count || filters.some(filter =>
        Object.keys(filter).sort().join(',') !== 'genres,release_year_from,release_year_to,room_member_id,xmin' ||
        !members.some(member => member.id === filter.room_member_id && member.is_voter) ||
        !Array.isArray(filter.genres) || !Number.isInteger(filter.release_year_from) ||
        !Number.isInteger(filter.release_year_to) || filter.release_year_from < 1900 ||
        filter.release_year_from > filter.release_year_to || filter.release_year_to > 9999 ||
        !/^[0-9]+$/.test(filter.xmin))) throw new Error();
    return { row, members, filters, xmin: snapshots[0].xmin as string };
  } catch { throw new Error('E2E_SAFE_FAILURE'); }
}
export function roomSnapshot(room: RoomProjection) {
  const { row, members } = committedRoomSnapshot(room); return { ...row, members };
}
export async function configureCreation(page: Page, configuration: CreationConfiguration) {
  await page.getByLabel('Required voter count', { exact: true }).fill(String(configuration.requiredVoterCount));
  await page.getByRole('button', { name: configuration.creatorIsVoter ? 'Yes, I will vote' : 'No, I will not vote', exact: true }).click();
}

export async function startHost(page: Page, diagnostics: SafeDiagnostics): Promise<PublicApi> {
  observeCandidateRpcZero(page);
  diagnostics.allowAnonymousSignups(1);
  const signupRequest = page.waitForRequest(request => /\/auth\/v1\/signup$/.test(new URL(request.url()).pathname));
  const response = await page.goto('/');
  expect(response?.status() === 200).toBe(true);
  const signup = await signupRequest;
  // Only public connection metadata is selected; never export session storage.
  const publicKey = await signup.headerValue('apikey');
  if (!publicKey) throw new Error('E2E_SAFE_FAILURE');
  await expect(page.getByRole('button', { name: 'Create Room' })).toBeVisible();
  await diagnostics.assertAuthAccounting(1, 1);
  await diagnostics.assertNoCredentialTextUi();
  await configureCreation(page, twoVoters);
  return { origin: new URL(signup.url()).origin, publicKey };
}

export async function ownRooms(page: Page, api: PublicApi, targetId?: string, targetCode?: string): Promise<RoomProjection[]> {
  // A real member-authorized Data API read, never an owner/service-role oracle.
  // Session access stays inside this browser context and only the six public room fields return.
  const rows: unknown = await page.evaluate(async ({ origin, publicKey, targetId, targetCode }) => {
    const key = Object.keys(localStorage).find(name => /^sb-.+-auth-token$/.test(name));
    const session = key ? JSON.parse(localStorage.getItem(key) ?? 'null') : null;
    if (!session?.access_token) throw new Error('E2E_SAFE_FAILURE');
    const filter = targetId ? `&id=eq.${encodeURIComponent(targetId)}` : targetCode ? `&code=eq.${encodeURIComponent(targetCode)}` : '';
    const response = await fetch(`${origin}/rest/v1/rooms?select=id,code,state,voter_count,required_voter_count,filter_completed_count${filter}`, {
      headers: { apikey: publicKey, Authorization: `Bearer ${session.access_token}` },
    });
    if (!response.ok) throw new Error('E2E_SAFE_FAILURE');
    return response.json();
  }, { ...api, targetId, targetCode });
  if (!Array.isArray(rows) || rows.length > 10 || rows.some(row => !row ||
    Object.keys(row).sort().join(',') !== 'code,filter_completed_count,id,required_voter_count,state,voter_count' || typeof row.id !== 'string' ||
    typeof row.code !== 'string' || !/^[0-9A-F]{10}$/.test(row.code) || !Number.isInteger(row.voter_count) || !Number.isInteger(row.required_voter_count) || row.voter_count < 0 ||
    row.required_voter_count < 2 || row.required_voter_count > 2147483647 || row.voter_count > row.required_voter_count ||
    row.state !== (row.voter_count === row.required_voter_count ? 'ready' : 'waiting') ||
    !Number.isInteger(row.filter_completed_count) || row.filter_completed_count < 0 ||
    row.filter_completed_count > row.required_voter_count || row.filter_completed_count > 0 && row.state !== 'ready')) {
    throw new Error('E2E_SAFE_FAILURE');
  }
  return rows;
}

export async function assertWaiting(page: Page, diagnostics: SafeDiagnostics, room: RoomProjection) {
  expect(room.state === 'waiting').toBe(true);
  const expected = new URL(`/room/${room.code}`, page.url());
  await expect(page).toHaveURL(expected.href);
  await expect(page.getByRole('heading', { name: 'Waiting', exact: true })).toBeVisible();
  await expect(page.getByText(`${room.voter_count} of ${room.required_voter_count} voters`, { exact: true })).toBeVisible();
  await expect(page.getByLabel('Room code', { exact: true })).toHaveText(room.code);
  await expect(page.getByLabel('Invitation link', { exact: true })).toHaveText(expected.href);
  const participant = await ownParticipant(page);
  // Boolean-only UI identity checks never print UUIDs, credentials or DOM diffs.
  expect(await page.evaluate(({ id, participant }) => !document.body.innerText.includes(id) && !document.body.innerText.includes(participant), { id: room.id, participant })).toBe(true);
  await diagnostics.assertAuthAccounting(1, 1);
  await diagnostics.assertNoCredentialTextUi();
  expect(observeCandidateRpcZero(page).count()).toBe(0);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
}

export async function ownParticipant(page: import('@playwright/test').Page): Promise<string> {
  // Own-session inspection stays in memory, never an application/debug endpoint.
  const id = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(name => /^sb-.+-auth-token$/.test(name));
    if (!key) return null;
    const value = JSON.parse(localStorage.getItem(key) ?? 'null');
    return typeof value?.user?.id === 'string' && value.user.is_anonymous === true ? value.user.id : null;
  });
  if (!id) throw new Error('E2E_SAFE_FAILURE');
  return id;
}

export async function realtimeBarrier(page: Page, holdInitial = false) {
  type Connection = { browser: WebSocketRoute; server: WebSocketRoute };
  const connections = new Set<Connection>();
  const waiting = new Set<() => void>();
  let held: { connection: Connection; message: string | Buffer }[] = [];
  let hold = holdInitial, paused = false, disposed = false;
  let failed: Error | null = null;
  let holdReady = false, holdUpdates = false;
  let updateFrames: { connection: Connection; message: string | Buffer }[] = [];
  let readyFrames: { connection: Connection; message: string | Buffer }[] = [];
  const dbReady = new Set<Connection>();
  let documentGeneration = 0;
  const readDocuments = new WeakMap<Request, number>();
  const navigation = (frame: Frame) => { if (frame.parentFrame() === null) documentGeneration++; };
  const stats = { held: 0, transportJoins: 0, readiness: 0, readyHeld: 0, prematureReads: 0, readRequests: 0, reads: 0, retiredBodies: 0, readFailures: 0, frameFailures: 0, updates: 0, updateHeld: 0, losses: 0, joins: 0, leaves: 0, leaveAcks: 0 };
  const pendingLeaves = new Map<string, string>(), retiredRooms = new Set<string>();
  const changed = () => { for (const notify of waiting) notify(); };
  const failure = (kind: 'read' | 'frame' = 'frame') => {
    if (!failed) {
      failed = new Error('E2E_SAFE_FAILURE');
      // Retain only our own fixed error and its observation site. The existing
      // safe boundary projects the location; no network exception is retained.
      Error.captureStackTrace(failed, failure);
    }
    stats[kind === 'read' ? 'readFailures' : 'frameFailures']++; changed();
  };
  const wait = (name: keyof typeof stats, minimum: number) => new Promise<void>((resolve, reject) => {
    const done = () => {
      if (!failed && !disposed && stats[name] < minimum) return;
      clearTimeout(deadline); waiting.delete(done);
      if (failed || disposed) reject(failed ?? new Error('E2E_SAFE_FAILURE')); else resolve();
    };
    const deadline = setTimeout(() => { waiting.delete(done); reject(new Error('E2E_SAFE_FAILURE')); }, 15000);
    waiting.add(done); done();
  });
  const decode = (message: string | Buffer) => {
    // Pinned Phoenix JSON serializer; binary broadcast is not a room transport.
    if (typeof message !== 'string' || message.length > 65536) throw new Error('E2E_SAFE_FAILURE');
    const value = JSON.parse(message);
    if (!Array.isArray(value) || value.length !== 5) throw new Error('E2E_SAFE_FAILURE');
    return { ref: value[1], topic: value[2], event: value[3], payload: value[4] };
  };
  const closeConnection = async (c: Connection) => {
    connections.delete(c); dbReady.delete(c);
    await Promise.all([c.browser.close({ code: 1012, reason: 'test transport interruption' }), c.server.close({ code: 1012, reason: 'test transport interruption' })]);
  };
  const socket = (ws: import('@playwright/test').WebSocket) => {
    if (new URL(ws.url()).pathname === '/realtime/v1/websocket') ws.on('close', () => { stats.losses++; changed(); });
  };
  const request = (r: import('@playwright/test').Request) => {
    const url = new URL(r.url());
    if (url.pathname.endsWith('/rpc/join_room')) stats.joins++;
    if (url.pathname === '/rest/v1/rooms' && url.searchParams.get('id') &&
      url.searchParams.get('select')?.replaceAll(' ', '') === 'id,code,state,voter_count,required_voter_count,filter_completed_count') {
      // Dispatch and completion are distinct: a response already in flight can
      // finish after an observed socket loss without issuing any new request.
      stats.readRequests++; readDocuments.set(r, documentGeneration);
      if (dbReady.size === 0) stats.prematureReads++;
      changed();
    }
  };
  const response = async (r: Response) => {
    const url = new URL(r.url());
    if (url.pathname !== '/rest/v1/rooms' || !url.searchParams.get('id') || url.searchParams.get('select')?.replaceAll(' ', '') !== 'id,code,state,voter_count,required_voter_count,filter_completed_count') return;
    let bytes: Buffer;
    try { bytes = await r.body(); }
    catch {
      if (disposed) return;
      const generation = readDocuments.get(r.request());
      // Navigation can retire a request before Playwright retrieves its body.
      // Only that known document lifetime is ignored; current/unknown failures
      // and any available malformed/private projection still fail closed.
      if (generation !== undefined && generation < documentGeneration) {
        stats.retiredBodies++; changed(); return;
      }
      failure('read'); return;
    }
    if (disposed) return;
    try {
      if (bytes.length > 4096) throw new Error('E2E_SAFE_FAILURE');
      const rows = JSON.parse(bytes.toString('utf8'));
      if (!r.ok() || !Array.isArray(rows) || rows.length !== 1 ||
        Object.keys(rows[0]).sort().join(',') !== 'code,filter_completed_count,id,required_voter_count,state,voter_count' || url.searchParams.get('id') !== `eq.${rows[0].id}`) throw new Error('E2E_SAFE_FAILURE');
      stats.reads++; changed();
    } catch { if (!disposed) failure('read'); }
  };
  page.on('websocket', socket); page.on('request', request); page.on('response', response); page.on('framenavigated', navigation);
  await page.context().routeWebSocket('**/realtime/v1/websocket**', async browser => {
    // Every connection is to the real server, including a replacement rejected
    // while the outage gate is shut. No fabricated open/binding/update response.
    const server = browser.connectToServer(), c = { browser, server };
    connections.add(c);
    if (disposed || paused) { await closeConnection(c).catch(() => failure()); return; }
    browser.onClose(async () => { connections.delete(c); dbReady.delete(c); await server.close().catch(() => { if (!disposed) failure(); }); });
    server.onClose(async () => { connections.delete(c); dbReady.delete(c); await browser.close().catch(() => { if (!disposed) failure(); }); });
    browser.onMessage(message => {
      if (disposed || !connections.has(c)) return;
      try {
        const frame = decode(message);
        if (frame.event === 'phx_leave' && /^realtime:room:/.test(frame.topic)) {
          pendingLeaves.set(frame.ref, frame.topic.slice('realtime:room:'.length)); stats.leaves++; changed();
        }
        if (frame.event === 'phx_join' && /^realtime:room:/.test(frame.topic)) {
          const filters = frame.payload?.config?.postgres_changes;
          if (!Array.isArray(filters) || filters.length !== 1 || filters[0].event !== 'UPDATE' ||
            filters[0].schema !== 'public' || filters[0].table !== 'rooms' ||
            filters[0].filter !== `id=eq.${frame.topic.slice('realtime:room:'.length)}` ||
            JSON.stringify(filters[0].select) !== '["id"]' || frame.payload.config.postgres_changes_options !== undefined) throw new Error('E2E_SAFE_FAILURE');
          if (hold) { held.push({ connection: c, message }); stats.held++; changed(); return; }
        }
        server.send(message);
      } catch { failure(); }
    });
    server.onMessage(message => {
      if (disposed || !connections.has(c)) return;
      try {
        const frame = decode(message);
        if (/^realtime:room:/.test(frame.topic)) {
          if (frame.event === 'phx_reply' && frame.payload?.status === 'ok' && pendingLeaves.has(frame.ref)) {
            retiredRooms.add(pendingLeaves.get(frame.ref)!); pendingLeaves.delete(frame.ref); stats.leaveAcks++;
          }
          if (frame.event === 'phx_reply' && frame.payload?.status === 'ok' && Array.isArray(frame.payload.response?.postgres_changes)) stats.transportJoins++;
          if (frame.event === 'system' && frame.payload?.extension === 'postgres_changes') {
            if (frame.payload.status === 'ok') {
              if (frame.payload.message !== 'Subscribed to PostgreSQL') throw new Error('E2E_SAFE_FAILURE');
              if (holdReady) { readyFrames.push({ connection: c, message }); stats.readyHeld++; changed(); return; }
              stats.readiness++; dbReady.add(c);
            } else if (frame.payload.status === 'error') dbReady.delete(c);
          }
          if (frame.event === 'postgres_changes') {
            stats.updates++;
            if (holdUpdates) { updateFrames.push({ connection: c, message }); stats.updateHeld++; changed(); return; }
          }
        }
        browser.send(message); changed(); // Forward the exact real frame unchanged.
      } catch { failure(); }
    });
  });
  return {
    stats, wait,
    assertRetired(id: string) { expect(retiredRooms.has(id)).toBe(true); },
    release() { hold = false; const frames = held; held = []; for (const { connection, message } of frames) connection.server.send(message); },
    async disconnect() { paused = true; const before = stats.losses; await Promise.all([...connections].map(closeConnection)); await wait('losses', before + 1); },
    holdReadiness() { holdReady = true; },
    releaseReadiness() {
      holdReady = false; const frames = readyFrames; readyFrames = [];
      for (const { connection, message } of frames) {
        if (!connections.has(connection)) continue;
        dbReady.add(connection); stats.readiness++; connection.browser.send(message);
      }
      changed();
    },
    holdUpdates() { holdUpdates = true; },
    releaseUpdates() {
      holdUpdates = false; const frames = updateFrames; updateFrames = [];
      for (const { connection, message } of frames) if (connections.has(connection)) connection.browser.send(message);
      changed();
    },
    resume() { paused = false; },
    assertHealthy() {
      if (failed) throw failed;
      expect(!disposed && stats.prematureReads === 0).toBe(true);
    },
    async close() {
      disposed = true; held = []; readyFrames = []; updateFrames = []; dbReady.clear(); pendingLeaves.clear(); retiredRooms.clear(); changed();
      page.removeListener('websocket', socket); page.removeListener('request', request); page.removeListener('response', response); page.removeListener('framenavigated', navigation);
      await Promise.all([...connections].map(closeConnection));
      // Playwright's WS routes have context lifetime; the fixture closes that
      // context in finally. This disposed guard rejects any late replacement.
    },
  };
}

export async function withParticipants(browser: Browser, options: BrowserContextOptions, info: TestInfo,
  count: number, body: (participants: SafeDiagnostics[]) => Promise<void>) {
  const participants: SafeDiagnostics[] = [];
  try {
    for (let index = 0; index < count; index++) {
      const context = await browser.newContext({ ...options, serviceWorkers: 'block' });
      try {
        const participant = await SafeDiagnostics.create(context, { ...options, serviceWorkers: 'block' }, info);
        participant.allowAnonymousSignups(1);
        participants.push(participant);
      } catch { await context.close(); throw new Error('E2E_SAFE_FAILURE'); }
    }
    async function guarded(index: number): Promise<void> {
      if (index === participants.length) return body(participants);
      await safeBody(participants[index], () => guarded(index + 1));
    }
    await guarded(0);
  } finally {
    const closed = await Promise.allSettled(participants.map(participant => participant.close()));
    if (closed.some(result => result.status === 'rejected')) throw new Error('E2E_SAFE_FAILURE');
  }
}

export async function assertAccepted(response: Response, room: RoomProjection, outcome: 'joined' | 'already_member',
  member: { isCreator: boolean; isVoter: boolean }, state: 'waiting' | 'ready', count = state === 'ready' ? room.required_voter_count : room.voter_count) {
  const rows: unknown = await response.json();
  const valid = response.ok() && Array.isArray(rows) && rows.length === 1 && rows[0] &&
    Object.keys(rows[0]).sort().join(',') === 'filter_completed_count,is_creator,is_voter,outcome,required_voter_count,room_code,room_id,room_state,voter_count' &&
    rows[0].outcome === outcome && rows[0].room_id === room.id && rows[0].room_code === room.code &&
    rows[0].is_creator === member.isCreator && rows[0].is_voter === member.isVoter &&
    rows[0].room_state === state && rows[0].voter_count === count && rows[0].required_voter_count === room.required_voter_count &&
    Number.isInteger(rows[0].filter_completed_count) && rows[0].filter_completed_count >= room.filter_completed_count &&
    rows[0].filter_completed_count <= room.required_voter_count;
  expect(!!valid).toBe(true);
}

export async function createWaiting(page: Page, diagnostics: SafeDiagnostics, configuration: CreationConfiguration = twoVoters) {
  const api = await startHost(page, diagnostics);
  await configureCreation(page, configuration);
  const created = page.waitForResponse(response => response.url().endsWith('/rpc/create_room'));
  const recovered = page.waitForResponse(response => response.url().endsWith('/rpc/join_room'));
  await page.getByRole('button', { name: 'Create Room' }).click();
  const response = await created, request = response.request().postDataJSON();
  const rows = await response.json();
  expect(response.ok() && Object.keys(request).sort().join(',') === 'p_creation_request_id,p_creator_is_voter,p_required_voter_count' &&
    request.p_required_voter_count === configuration.requiredVoterCount && request.p_creator_is_voter === configuration.creatorIsVoter &&
    Array.isArray(rows) && rows.length === 1 && rows[0].outcome === 'created' &&
    Object.keys(rows[0]).sort().join(',') === 'filter_completed_count,is_creator,is_voter,outcome,required_voter_count,room_code,room_id,room_state,voter_count' &&
    rows[0].is_creator === true && rows[0].is_voter === configuration.creatorIsVoter && rows[0].room_state === 'waiting' &&
    rows[0].voter_count === Number(configuration.creatorIsVoter) && rows[0].required_voter_count === configuration.requiredVoterCount &&
    rows[0].filter_completed_count === 0).toBe(true);
  const rooms = await ownRooms(page, api);
  expect(rooms.length === 1 && rooms[0].id === rows[0].room_id && rooms[0].code === rows[0].room_code).toBe(true);
  const room = rooms[0];
  await assertAccepted(await recovered, room, 'already_member', { isCreator: true, isVoter: configuration.creatorIsVoter }, 'waiting');
  await assertWaiting(page, diagnostics, room);
  const invitation = await page.getByLabel('Invitation link', { exact: true }).innerText();
  expect(invitation === new URL(`/room/${room.code}`, page.url()).href).toBe(true);
  return { api, room, invitation, participant: await ownParticipant(page) };
}

export async function assertReady(page: Page, diagnostics: SafeDiagnostics, room: RoomProjection, _legacyCandidateWait?: boolean) {
  await expect(page).toHaveURL(new URL(`/room/${room.code}`, page.url()).href);
  await expect(page.getByRole('heading', { name: 'Ready', exact: true })).toBeVisible();
  await expect(page.getByText(`${room.required_voter_count} of ${room.required_voter_count} voters`, { exact: true })).toBeVisible();
  await expect(page.getByLabel('Room code', { exact: true })).toHaveText(room.code);
  const participant = await ownParticipant(page);
  const stored = committedRoomSnapshot(room);
  if (stored.row.creator_user_id === participant) await expect(page.getByLabel('Invitation link', { exact: true })).toHaveText(new URL(`/room/${room.code}`, page.url()).href);
  else await expect(page.getByLabel('Invitation link', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(({ id, participant }) => !document.body.innerText.includes(id) && !document.body.innerText.includes(participant), { id: room.id, participant })).toBe(true);
  await diagnostics.assertAuthAccounting(1, 1);
  await diagnostics.assertNoCredentialTextUi();
  await expect(page.getByText(`${stored.row.filter_completed_count} of ${stored.row.required_voter_count} filters collected`, { exact: true })).toBeVisible();
  await expect(page.getByTestId('candidate-card')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Retry candidate', exact: true })).toHaveCount(0);
  expect(observeCandidateRpcZero(page).count()).toBe(0);
}

export async function linkGuest(guest: SafeDiagnostics, room: RoomProjection, invitation: string) {
  observeCandidateRpcZero(guest.page);
  const joined = guest.page.waitForResponse(response => response.url().endsWith('/rpc/join_room'));
  expect((await guest.page.goto(invitation))?.status() === 200).toBe(true);
  await assertAccepted(await joined, room, 'joined', { isCreator: false, isVoter: true }, 'ready');
  await assertReady(guest.page, guest, room);
}

export function selectCreatedTrial(rows: unknown, rooms: RoomProjection[], request: unknown, priorRequest: string, priorRoom: string) {
  if (typeof request !== 'string' || !/^[0-9a-f-]{36}$/.test(request) || request === priorRequest ||
    !Array.isArray(rows) || rows.length !== 1 || rows[0]?.outcome !== 'created' || rows[0].room_id === priorRoom) throw new Error('E2E_SAFE_FAILURE');
  const matches = rooms.filter(room => room.id === rows[0].room_id && room.code === rows[0].room_code && room.state === 'waiting');
  if (matches.length !== 1) throw new Error('E2E_SAFE_FAILURE');
  return matches[0];
}

// A second logical create via the real UI and retained Auth storage. No signup
// waiter/startHost and no assumption that this participant owns only one room.
export async function createWaitingWithSession(page: Page, diagnostics: SafeDiagnostics, api: PublicApi,
  previous: ReturnType<typeof committedRoomSnapshot>, configuration: CreationConfiguration = twoVoters) {
  await diagnostics.assertAuthAccounting(1, 1);
  const participant = await ownParticipant(page);
  expect((await page.goto('/'))?.status() === 200).toBe(true);
  await expect(page.getByRole('button', { name: 'Create Room' })).toBeVisible();
  await configureCreation(page, configuration);
  const created = page.waitForResponse(response => new URL(response.url()).pathname === '/rest/v1/rpc/create_room');
  const recovered = page.waitForResponse(response => new URL(response.url()).pathname === '/rest/v1/rpc/join_room');
  await page.getByRole('button', { name: 'Create Room' }).click();
  const response = await created;
  expect(response.ok()).toBe(true);
  const request = response.request().postDataJSON();
  const room = selectCreatedTrial(await response.json(), await ownRooms(page, api), request?.p_creation_request_id,
    previous.row.creation_request_id, previous.row.id);
  await assertAccepted(await recovered, room, 'already_member', { isCreator: true, isVoter: configuration.creatorIsVoter }, 'waiting');
  await assertWaiting(page, diagnostics, room);
  await diagnostics.assertAuthAccounting(1, 1);
  expect(await ownParticipant(page) === participant).toBe(true);
  const invitation = await page.getByLabel('Invitation link', { exact: true }).innerText();
  expect(invitation === new URL(`/room/${room.code}`, page.url()).href).toBe(true);
  return { api, room, invitation, participant };
}
