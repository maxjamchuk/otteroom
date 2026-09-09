import { spawnSync } from 'node:child_process';
import { expect, type Page, type Browser, type BrowserContextOptions, type TestInfo, type Response, type WebSocketRoute } from '@playwright/test';
import { safeBody, SafeDiagnostics } from './safe-diagnostics.ts';

export type PublicApi = { origin: string; publicKey: string };
export type RoomProjection = { id: string; code: string; state: string };

// Shared real-stack helpers only. SafeDiagnostics owns every context, registers
// credentials before Auth delivery and records its original per-context cap.
// SQL snapshots use local owner access for read-only postconditions, never as
// browser credentials or a normal application surface.
export function committedRoomSnapshot(room: RoomProjection) {
  if (!/^[0-9a-f-]{36}$/.test(room.id) || !/^[0-9A-F]{10}$/.test(room.code)) throw new Error('E2E_SAFE_FAILURE');
  const result = spawnSync('docker', ['exec', 'supabase_db_otteroom-room-session',
    'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-At', '-c',
    `SELECT coalesce(json_agg(json_build_object('row', row_to_json(r), 'xmin', r.xmin::text) ORDER BY id), '[]'::json) FROM public.rooms r WHERE id = '${room.id}'::uuid OR code = '${room.code}';`],
  { encoding: 'utf8', maxBuffer: 65536, timeout: 10000 });
  if (result.status !== 0 || result.error) throw new Error('E2E_SAFE_FAILURE');
  try {
    const snapshots = JSON.parse(result.stdout);
    if (!Array.isArray(snapshots) || snapshots.length !== 1 || !/^[0-9]+$/.test(snapshots[0].xmin)) throw new Error();
    const rows = snapshots.map(snapshot => snapshot.row);
    if (!Array.isArray(rows) || rows.length !== 1 || rows[0].id !== room.id || rows[0].code !== room.code ||
      Object.keys(rows[0]).sort().join(',') !== 'code,created_at,creation_request_id,guest_user_id,host_user_id,id,movie_candidate_id,state,updated_at') throw new Error();
    const row = rows[0] as { id: string; code: string; state: string; host_user_id: string; guest_user_id: string | null; creation_request_id: string; created_at: string; updated_at: string; movie_candidate_id: string | null };
    if (row.movie_candidate_id !== null && typeof row.movie_candidate_id !== 'string') throw new Error();
    return { row, xmin: snapshots[0].xmin as string };
  } catch { throw new Error('E2E_SAFE_FAILURE'); }
}

export function roomSnapshot(room: RoomProjection) { return committedRoomSnapshot(room).row; }

export async function startHost(page: Page, diagnostics: SafeDiagnostics): Promise<PublicApi> {
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
  return { origin: new URL(signup.url()).origin, publicKey };
}

export async function ownRooms(page: Page, api: PublicApi, targetId?: string, targetCode?: string): Promise<RoomProjection[]> {
  // A real member-authorized Data API read, never an owner/service-role oracle.
  // Session access stays inside this browser context and only id/code/state return.
  const rows: unknown = await page.evaluate(async ({ origin, publicKey, targetId, targetCode }) => {
    const key = Object.keys(localStorage).find(name => /^sb-.+-auth-token$/.test(name));
    const session = key ? JSON.parse(localStorage.getItem(key) ?? 'null') : null;
    if (!session?.access_token) throw new Error('E2E_SAFE_FAILURE');
    const filter = targetId ? `&id=eq.${encodeURIComponent(targetId)}` : targetCode ? `&code=eq.${encodeURIComponent(targetCode)}` : '';
    const response = await fetch(`${origin}/rest/v1/rooms?select=id,code,state${filter}`, {
      headers: { apikey: publicKey, Authorization: `Bearer ${session.access_token}` },
    });
    if (!response.ok) throw new Error('E2E_SAFE_FAILURE');
    return response.json();
  }, { ...api, targetId, targetCode });
  if (!Array.isArray(rows) || rows.length > 10 || rows.some(row => !row ||
    Object.keys(row).sort().join(',') !== 'code,id,state' || typeof row.id !== 'string' ||
    typeof row.code !== 'string' || !/^[0-9A-F]{10}$/.test(row.code) || !['waiting', 'ready'].includes(row.state))) {
    throw new Error('E2E_SAFE_FAILURE');
  }
  return rows;
}

export async function assertWaiting(page: Page, diagnostics: SafeDiagnostics, room: RoomProjection) {
  expect(room.state === 'waiting').toBe(true);
  const expected = new URL(`/room/${room.code}`, page.url());
  await expect(page).toHaveURL(expected.href);
  await expect(page.getByRole('heading', { name: 'Waiting', exact: true })).toBeVisible();
  await expect(page.getByText('1 of 2', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Room code', { exact: true })).toHaveText(room.code);
  await expect(page.getByLabel('Invitation link', { exact: true })).toHaveText(expected.href);
  const participant = await ownParticipant(page);
  // Boolean-only UI identity checks never print UUIDs, credentials or DOM diffs.
  expect(await page.evaluate(({ id, participant }) => !document.body.innerText.includes(id) && !document.body.innerText.includes(participant), { id: room.id, participant })).toBe(true);
  await diagnostics.assertAuthAccounting(1, 1);
  await diagnostics.assertNoCredentialTextUi();
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
  let hold = holdInitial, paused = false, disposed = false, failed = false;
  let holdReady = false, holdUpdates = false;
  let updateFrames: { connection: Connection; message: string | Buffer }[] = [];
  let readyFrames: { connection: Connection; message: string | Buffer }[] = [];
  const dbReady = new Set<Connection>();
  const stats = { held: 0, transportJoins: 0, readiness: 0, readyHeld: 0, prematureReads: 0, reads: 0, updates: 0, updateHeld: 0, losses: 0, joins: 0, leaves: 0, leaveAcks: 0 };
  const pendingLeaves = new Map<string, string>(), retiredRooms = new Set<string>();
  const changed = () => { for (const notify of waiting) notify(); };
  const failure = () => { failed = true; changed(); };
  const wait = (name: keyof typeof stats, minimum: number) => new Promise<void>((resolve, reject) => {
    const done = () => {
      if (!failed && !disposed && stats[name] < minimum) return;
      clearTimeout(deadline); waiting.delete(done);
      if (failed || disposed) reject(new Error('E2E_SAFE_FAILURE')); else resolve();
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
      url.searchParams.get('select')?.replaceAll(' ', '') === 'id,code,state' && dbReady.size === 0) stats.prematureReads++;
  };
  const response = async (r: Response) => {
    const url = new URL(r.url());
    if (url.pathname !== '/rest/v1/rooms' || !url.searchParams.get('id') || url.searchParams.get('select')?.replaceAll(' ', '') !== 'id,code,state') return;
    try {
      const rows = await r.json();
      if (!r.ok() || !Array.isArray(rows) || rows.length !== 1 ||
        Object.keys(rows[0]).sort().join(',') !== 'code,id,state' || url.searchParams.get('id') !== `eq.${rows[0].id}`) throw new Error('E2E_SAFE_FAILURE');
      stats.reads++; changed();
    } catch { if (!disposed) failure(); }
  };
  page.on('websocket', socket); page.on('request', request); page.on('response', response);
  await page.context().routeWebSocket('**/realtime/v1/websocket**', async browser => {
    // Every connection is to the real server, including a replacement rejected
    // while the outage gate is shut. No fabricated open/binding/update response.
    const server = browser.connectToServer(), c = { browser, server };
    connections.add(c);
    if (disposed || paused) { await closeConnection(c).catch(failure); return; }
    browser.onClose(async () => { connections.delete(c); dbReady.delete(c); await server.close().catch(() => { if (!disposed) failure(); }); });
    server.onClose(async () => { connections.delete(c); dbReady.delete(c); await browser.close().catch(() => { if (!disposed) failure(); }); });
    browser.onMessage(message => {
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
    assertHealthy() { expect(!failed && !disposed && stats.prematureReads === 0).toBe(true); },
    async close() {
      disposed = true; held = []; readyFrames = []; updateFrames = []; dbReady.clear(); pendingLeaves.clear(); retiredRooms.clear(); changed();
      page.removeListener('websocket', socket); page.removeListener('request', request); page.removeListener('response', response);
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

export async function assertAccepted(response: Response, room: RoomProjection, outcome: 'joined' | 'already_member', role: 'host' | 'guest', state: 'waiting' | 'ready') {
  const rows: unknown = await response.json();
  const valid = response.ok() && Array.isArray(rows) && rows.length === 1 && rows[0] &&
    Object.keys(rows[0]).sort().join(',') === 'outcome,participant_count,participant_role,room_code,room_id,room_state' &&
    rows[0].outcome === outcome && rows[0].room_id === room.id && rows[0].room_code === room.code &&
    rows[0].participant_role === role && rows[0].room_state === state && rows[0].participant_count === (state === 'waiting' ? 1 : 2);
  expect(!!valid).toBe(true);
}

export async function createWaiting(page: Page, diagnostics: SafeDiagnostics) {
  const api = await startHost(page, diagnostics);
  const created = page.waitForResponse(response => response.url().endsWith('/rpc/create_room'));
  const recovered = page.waitForResponse(response => response.url().endsWith('/rpc/join_room'));
  await page.getByRole('button', { name: 'Create Room' }).click();
  const rows = await (await created).json();
  expect(Array.isArray(rows) && rows.length === 1 && rows[0].outcome === 'created').toBe(true);
  const rooms = await ownRooms(page, api);
  expect(rooms.length === 1 && rooms[0].id === rows[0].room_id && rooms[0].code === rows[0].room_code).toBe(true);
  const room = rooms[0];
  await assertAccepted(await recovered, room, 'already_member', 'host', 'waiting');
  await assertWaiting(page, diagnostics, room);
  const invitation = await page.getByLabel('Invitation link', { exact: true }).innerText();
  expect(invitation === new URL(`/room/${room.code}`, page.url()).href).toBe(true);
  return { api, room, invitation, participant: await ownParticipant(page) };
}

export async function assertReady(page: Page, diagnostics: SafeDiagnostics, room: RoomProjection, settleCandidate = true) {
  await expect(page).toHaveURL(new URL(`/room/${room.code}`, page.url()).href);
  await expect(page.getByRole('heading', { name: 'Ready', exact: true })).toBeVisible();
  await expect(page.getByText('2 of 2', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Room code', { exact: true })).toHaveText(room.code);
  await expect(page.getByLabel('Invitation link', { exact: true })).toHaveCount(0);
  const participant = await ownParticipant(page);
  expect(await page.evaluate(({ id, participant }) => !document.body.innerText.includes(id) && !document.body.innerText.includes(participant), { id: room.id, participant })).toBe(true);
  await diagnostics.assertAuthAccounting(1, 1);
  await diagnostics.assertNoCredentialTextUi();
  // Complete the assignment before full-row equality baselines in legacy tests.
  // F01 opts out only while its outgoing first-acquisition barrier is held.
  if (settleCandidate) {
    await expect(page.getByTestId('candidate-poster')).toBeVisible();
    await expect(page.getByTestId('candidate-status')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Retry candidate', exact: true })).toHaveCount(0);
  }
}

export async function linkGuest(guest: SafeDiagnostics, room: RoomProjection, invitation: string) {
  const joined = guest.page.waitForResponse(response => response.url().endsWith('/rpc/join_room'));
  expect((await guest.page.goto(invitation))?.status() === 200).toBe(true);
  await assertAccepted(await joined, room, 'joined', 'guest', 'ready');
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
  previous: ReturnType<typeof committedRoomSnapshot>) {
  await diagnostics.assertAuthAccounting(1, 1);
  const participant = await ownParticipant(page);
  expect((await page.goto('/'))?.status() === 200).toBe(true);
  await expect(page.getByRole('button', { name: 'Create Room' })).toBeVisible();
  const created = page.waitForResponse(response => new URL(response.url()).pathname === '/rest/v1/rpc/create_room');
  const recovered = page.waitForResponse(response => new URL(response.url()).pathname === '/rest/v1/rpc/join_room');
  await page.getByRole('button', { name: 'Create Room' }).click();
  const response = await created;
  expect(response.ok()).toBe(true);
  const request = response.request().postDataJSON();
  const room = selectCreatedTrial(await response.json(), await ownRooms(page, api), request?.p_creation_request_id,
    previous.row.creation_request_id, previous.row.id);
  await assertAccepted(await recovered, room, 'already_member', 'host', 'waiting');
  await assertWaiting(page, diagnostics, room);
  await diagnostics.assertAuthAccounting(1, 1);
  expect(await ownParticipant(page) === participant).toBe(true);
  const invitation = await page.getByLabel('Invitation link', { exact: true }).innerText();
  expect(invitation === new URL(`/room/${room.code}`, page.url()).href).toBe(true);
  return { api, room, invitation, participant };
}
