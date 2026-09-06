import { randomUUID } from 'node:crypto';
import { expect, type Page, type Route, type Browser, type BrowserContextOptions, type TestInfo, type Response } from '@playwright/test';
import { test, safeBody, SafeDiagnostics } from './support/safe-diagnostics';

// Binding allocation from quickstart; later cases consume these trials, not
// additional fixture/bootstrap identities. Phase 7 adds entry and bounded
// capacity/isolation smoke, not full US2 convergence or full US3 acceptance.
export const anonymousBudget = Object.freeze({
  E01: 3, E02: 2, E03: 4, E04: 4, E05: 3, E06: 3,
  E07: 5, E08: 4, E09: 2, E10: 2, E11: 1, E12: 11, auth: 3,
});

type PublicApi = { origin: string; publicKey: string };
type RoomProjection = { id: string; code: string; state: string };
const createEndpoint = '**/rest/v1/rpc/create_room';

async function startHost(page: Page, diagnostics: SafeDiagnostics): Promise<PublicApi> {
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
  await diagnostics.assertNoCredentialUi();
  return { origin: new URL(signup.url()).origin, publicKey };
}

async function ownRooms(page: Page, api: PublicApi, targetId?: string): Promise<RoomProjection[]> {
  // A real member-authorized Data API read, never an owner/service-role oracle.
  // Session access stays inside this browser context and only id/code/state return.
  const rows: unknown = await page.evaluate(async ({ origin, publicKey, targetId }) => {
    const key = Object.keys(localStorage).find(name => /^sb-.+-auth-token$/.test(name));
    const session = key ? JSON.parse(localStorage.getItem(key) ?? 'null') : null;
    if (!session?.access_token) throw new Error('E2E_SAFE_FAILURE');
    const filter = targetId ? `&id=eq.${encodeURIComponent(targetId)}` : '';
    const response = await fetch(`${origin}/rest/v1/rooms?select=id,code,state${filter}`, {
      headers: { apikey: publicKey, Authorization: `Bearer ${session.access_token}` },
    });
    if (!response.ok) throw new Error('E2E_SAFE_FAILURE');
    return response.json();
  }, { ...api, targetId });
  if (!Array.isArray(rows) || rows.length > 10 || rows.some(row => !row ||
    Object.keys(row).sort().join(',') !== 'code,id,state' || typeof row.id !== 'string' ||
    typeof row.code !== 'string' || !/^[0-9A-F]{10}$/.test(row.code) || !['waiting', 'ready'].includes(row.state))) {
    throw new Error('E2E_SAFE_FAILURE');
  }
  return rows;
}

async function assertWaiting(page: Page, diagnostics: SafeDiagnostics, room: RoomProjection) {
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
  await diagnostics.assertNoCredentialUi();
}

async function assertHostRecovery(response: import('@playwright/test').Response, room: RoomProjection) {
  const rows = await response.json();
  expect(response.ok() && Array.isArray(rows) && rows.length === 1 &&
    rows[0].outcome === 'already_member' && rows[0].participant_role === 'host' &&
    rows[0].room_state === 'waiting' && rows[0].participant_count === 1 &&
    rows[0].room_id === room.id && rows[0].room_code === room.code).toBe(true);
}

test('@us1 E01 create host Waiting and suppress rapid duplicate action', async ({ page, diagnostics }) => {
  await safeBody(diagnostics, async () => {
    const api = await startHost(page, diagnostics);
    let release!: () => void;
    let arrived!: () => void;
    const barrier = new Promise<void>(resolve => { arrived = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    let requests = 0;
    let interceptionFailed = false;
    const hold = async (route: Route) => {
      try { requests++; arrived(); await gate; await route.continue(); }
      catch { interceptionFailed = true; await route.abort().catch(() => {}); }
    };
    await page.route(createEndpoint, hold);
    try {
      const createdResponse = page.waitForResponse(response => response.url().endsWith('/rpc/create_room'));
      const recoveredResponse = page.waitForResponse(response => response.url().endsWith('/rpc/join_room'));
      await page.getByRole('button', { name: 'Create Room' }).evaluate(element => {
        (element as HTMLElement).click(); (element as HTMLElement).click();
      });
      await barrier;
      await expect(page.getByRole('button', { name: 'Creating room…' })).toBeDisabled();
      release();
      const created = await (await createdResponse).json();
      expect(Array.isArray(created) && created.length === 1 && created[0].outcome === 'created').toBe(true);
      const recovered = await recoveredResponse;
      const rooms = await ownRooms(page, api);
      expect(!interceptionFailed && rooms.length === 1 && requests === 1 && rooms[0].id === created[0].room_id && rooms[0].code === created[0].room_code).toBe(true);
      await assertHostRecovery(recovered, rooms[0]);
      await assertWaiting(page, diagnostics, rooms[0]);
      await diagnostics.record({ scenario: 'E01', outcome: 'created; already_member; host; waiting; owned-rooms=1; create-requests=1' });
    } finally { release(); await page.unroute(createEndpoint, hold); }
  });
});

test('@us1 E01 pre-acceptance create failure preserves zero rooms', async ({ page, diagnostics }) => {
  await safeBody(diagnostics, async () => {
    const api = await startHost(page, diagnostics);
    let aborted = 0;
    let interceptionFailed = false;
    const abort = async (route: Route) => {
      try { aborted++; await route.abort('failed'); }
      catch { interceptionFailed = true; }
    };
    await page.route(createEndpoint, abort, { times: 1 });
    try {
      await page.getByRole('button', { name: 'Create Room' }).click();
      await expect(page.getByText('Unable to create your room. Please try again.', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Retry create' })).toBeEnabled();
      await expect(page.getByLabel('Invitation link', { exact: true })).toHaveCount(0);
      await expect(page.getByLabel('Room code', { exact: true })).toHaveCount(0);
      expect(!interceptionFailed && new URL(page.url()).pathname === '/' && aborted === 1 && (await ownRooms(page, api)).length === 0).toBe(true);
      await diagnostics.assertAuthAccounting(1, 1);
      await diagnostics.record({ scenario: 'E01', outcome: 'pre-acceptance failure; owned-rooms=0' });
    } finally { await page.unroute(createEndpoint, abort); }
  });
});

test('@us1 E01 committed response loss reuses request and recovers same host', async ({ page, diagnostics }) => {
  await safeBody(diagnostics, async () => {
    const api = await startHost(page, diagnostics);
    const participant = await ownParticipant(page);
    let originalRequest: string | undefined;
    let committed: { room_id: string; room_code: string } | undefined;
    let intercepted = 0;
    let interceptionFailed = false;
    const loseResponse = async (route: Route) => {
      try {
        intercepted++;
        originalRequest = route.request().postDataJSON()?.p_creation_request_id;
        const response = await route.fetch({ maxRetries: 0, maxRedirects: 0, timeout: 15000 });
        try {
          const rows = await response.json();
          if (response.ok() && Array.isArray(rows) && rows.length === 1 && rows[0].outcome === 'created') {
            committed = { room_id: rows[0].room_id, room_code: rows[0].room_code };
          }
          // The unchanged real response proves commit, but is not delivered to UI.
          await route.abort('failed');
        } finally { await response.dispose(); }
      } catch { interceptionFailed = true; await route.abort().catch(() => {}); }
    };
    await page.route(createEndpoint, loseResponse, { times: 1 });
    try {
      await page.getByRole('button', { name: 'Create Room' }).click();
      await expect(page.getByRole('button', { name: 'Retry create' })).toBeVisible();
      await expect(page.getByLabel('Invitation link', { exact: true })).toHaveCount(0);
      const before = await ownRooms(page, api);
      expect(!interceptionFailed && intercepted === 1 && !!originalRequest && !!committed && before.length === 1 && before[0].id === committed.room_id && before[0].code === committed.room_code).toBe(true);
      await page.unroute(createEndpoint, loseResponse);
      const retryRequest = page.waitForRequest(request => request.url().endsWith('/rpc/create_room'));
      const retryResponse = page.waitForResponse(response => response.url().endsWith('/rpc/create_room'));
      const recovery = page.waitForResponse(response => response.url().endsWith('/rpc/join_room'));
      await page.getByRole('button', { name: 'Retry create' }).click();
      expect((await retryRequest).postDataJSON()?.p_creation_request_id === originalRequest).toBe(true);
      const retry = await (await retryResponse).json();
      expect(Array.isArray(retry) && retry.length === 1 && retry[0].outcome === 'already_created' && retry[0].room_id === before[0].id && retry[0].room_code === before[0].code).toBe(true);
      await assertHostRecovery(await recovery, before[0]);
      await assertWaiting(page, diagnostics, before[0]);
      const reloadRecovery = page.waitForResponse(response => response.url().endsWith('/rpc/join_room'));
      const reload = await page.reload();
      expect(reload?.status() === 200).toBe(true);
      await assertHostRecovery(await reloadRecovery, before[0]);
      await assertWaiting(page, diagnostics, before[0]);
      const after = await ownRooms(page, api);
      expect(after.length === 1 && after[0].id === before[0].id && (await ownParticipant(page)) === participant).toBe(true);
      await diagnostics.record({ scenario: 'E01', outcome: 'already_created; same-request; same-room; reload already_member; owned-rooms=1' });
    } finally { await page.unroute(createEndpoint, loseResponse); originalRequest = undefined; committed = undefined; }
  });
});

async function ownParticipant(page: import('@playwright/test').Page): Promise<string> {
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

test('@auth persisted participant and isolated identity without room actions', async ({ page, browser, baseURL, viewport, diagnostics }, info) => {
  await safeBody(diagnostics, async () => {
    expect(Object.values(anonymousBudget).reduce((sum, cap) => sum + cap, 0) === 47).toBe(true);
    diagnostics.allowAnonymousSignups(anonymousBudget.auth - 1);
    const home = await page.goto('/');
    expect(home?.status()).toBe(200);
    await expect(page.getByRole('button', { name: 'Create Room' })).toBeVisible();
    await diagnostics.assertAuthAccounting(1, 1);
    const original = await ownParticipant(page);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Create Room' })).toBeVisible();
    expect((await ownParticipant(page)) === original).toBe(true);
    await diagnostics.assertAuthAccounting(1, 1);
    await diagnostics.assertNoCredentialUi();

    const options = { baseURL, viewport, serviceWorkers: 'block' as const };
    const context = await browser.newContext(options);
    let fresh: SafeDiagnostics | undefined;
    try {
      fresh = await SafeDiagnostics.create(context, options, info);
      fresh.allowAnonymousSignups(1);
      await safeBody(fresh, async () => {
        await fresh!.page.goto('/');
        await expect(fresh!.page.getByRole('button', { name: 'Create Room' })).toBeVisible();
        await fresh!.assertAuthAccounting(1, 1);
        const separate = await ownParticipant(fresh!.page);
        expect(separate !== original).toBe(true);
        await fresh!.assertNoCredentialUi();

        // Explicit user/test storage clearing, never recovery or quota evasion.
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await expect(page.getByRole('button', { name: 'Create Room' })).toBeVisible();
        const cleared = await ownParticipant(page);
        expect(cleared !== original && cleared !== separate).toBe(true);
        await diagnostics.assertAuthAccounting(2, 2);
        expect(diagnostics.signupAttempts + fresh!.signupAttempts === 3).toBe(true);
        await diagnostics.assertNoCredentialUi();
      });
    } finally {
      if (fresh) await fresh.close(); else await context.close();
    }
  });
});

const joinEndpoint = '**/rest/v1/rpc/join_room';
const malformedMessage = 'Malformed invitation. Enter a valid room code.';
const missingMessage = 'Room not found. Check your invitation.';
const fullMessage = 'Room Full. This room already has two participants.';

// Test-only ownership: every extra isolated context gets the same registry,
// capture policy, one-signup cap and finally cleanup as the primary fixture.
async function withParticipants(browser: Browser, options: BrowserContextOptions, info: TestInfo,
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

async function assertAccepted(response: Response, room: RoomProjection, outcome: 'joined' | 'already_member', role: 'host' | 'guest', state: 'waiting' | 'ready') {
  const rows: unknown = await response.json();
  const valid = response.ok() && Array.isArray(rows) && rows.length === 1 && rows[0] &&
    Object.keys(rows[0]).sort().join(',') === 'outcome,participant_count,participant_role,room_code,room_id,room_state' &&
    rows[0].outcome === outcome && rows[0].room_id === room.id && rows[0].room_code === room.code &&
    rows[0].participant_role === role && rows[0].room_state === state && rows[0].participant_count === (state === 'waiting' ? 1 : 2);
  expect(!!valid).toBe(true);
}

async function assertRejected(response: Response, outcome: 'not_found' | 'full') {
  const rows: unknown = await response.json();
  expect(response.ok() && Array.isArray(rows) && rows.length === 1 && rows[0] &&
    Object.keys(rows[0]).sort().join(',') === 'outcome,participant_count,participant_role,room_code,room_id,room_state' &&
    rows[0].outcome === outcome && ['room_id', 'room_code', 'room_state', 'participant_role', 'participant_count'].every(key => rows[0][key] === null)).toBe(true);
}

async function createWaiting(page: Page, diagnostics: SafeDiagnostics) {
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

async function assertReady(page: Page, diagnostics: SafeDiagnostics, room: RoomProjection) {
  await expect(page).toHaveURL(new URL(`/room/${room.code}`, page.url()).href);
  await expect(page.getByRole('heading', { name: 'Ready', exact: true })).toBeVisible();
  await expect(page.getByText('2 of 2', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Room code', { exact: true })).toHaveText(room.code);
  await expect(page.getByLabel('Invitation link', { exact: true })).toHaveCount(0);
  const participant = await ownParticipant(page);
  expect(await page.evaluate(({ id, participant }) => !document.body.innerText.includes(id) && !document.body.innerText.includes(participant), { id: room.id, participant })).toBe(true);
  await diagnostics.assertAuthAccounting(1, 1);
  await diagnostics.assertNoCredentialUi();
}

async function assertNoRoomDetails(page: Page, diagnostics: SafeDiagnostics, message: string) {
  await expect(page.getByText(message, { exact: true })).toBeVisible();
  await expect(page.getByLabel('Room code', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Invitation link', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/^[12] of 2$/)).toHaveCount(0);
  await diagnostics.assertAuthAccounting(1, 1);
  await diagnostics.assertNoCredentialUi();
}

async function linkGuest(guest: SafeDiagnostics, room: RoomProjection, invitation: string) {
  const joined = guest.page.waitForResponse(response => response.url().endsWith('/rpc/join_room'));
  expect((await guest.page.goto(invitation))?.status() === 200).toBe(true);
  await assertAccepted(await joined, room, 'joined', 'guest', 'ready');
  await assertReady(guest.page, guest, room);
}

async function repeatReady(page: Page, diagnostics: SafeDiagnostics, api: PublicApi, room: RoomProjection, role: 'host' | 'guest') {
  const participant = await ownParticipant(page);
  const joined = page.waitForResponse(response => response.url().endsWith('/rpc/join_room'));
  expect((await page.reload())?.status() === 200).toBe(true);
  await assertAccepted(await joined, room, 'already_member', role, 'ready');
  await assertReady(page, diagnostics, room);
  const rooms = await ownRooms(page, api);
  expect(rooms.length === 1 && rooms[0].id === room.id && rooms[0].code === room.code && rooms[0].state === 'ready' &&
    (await ownParticipant(page)) === participant).toBe(true);
}

test('@us2-join E02 actual invitation and same-member host guest re-entry', async ({ page, diagnostics, browser, baseURL, viewport }, info) => {
  await safeBody(diagnostics, async () => {
    const { api, room, invitation, participant } = await createWaiting(page, diagnostics);
    await withParticipants(browser, { baseURL, viewport }, info, 1, async ([guest]) => {
      await linkGuest(guest, room, invitation);
      expect((await ownParticipant(guest.page)) !== participant).toBe(true);
      // Phase 7 has no subscription. The authoritative DB is Ready, not this
      // host's unchanged initial UI; explicit re-entry below is intentional.
      await expect(page.getByRole('heading', { name: 'Waiting', exact: true })).toBeVisible();
      expect((await ownRooms(page, api))[0].state === 'ready').toBe(true);
      await repeatReady(page, diagnostics, api, room, 'host');
      await repeatReady(guest.page, guest, api, room, 'guest');
      expect(diagnostics.signupAttempts + guest.signupAttempts === anonymousBudget.E02).toBe(true);
      await diagnostics.record({ scenario: 'E02', outcome: 'joined guest ready; repeated host/guest already_member; two seats; host refreshed explicitly' });
    });
  });
});

test('@us2-join E04 manual whitespace lowercase converges on shared join', async ({ page, diagnostics, browser, baseURL, viewport }, info) => {
  await safeBody(diagnostics, async () => {
    const { api, room, participant } = await createWaiting(page, diagnostics);
    await withParticipants(browser, { baseURL, viewport }, info, 1, async ([guest]) => {
      await startHost(guest.page, guest); // Home readiness only; this caller never creates.
      const joined = guest.page.waitForResponse(response => response.url().endsWith('/rpc/join_room'));
      const request = guest.page.waitForRequest(request => request.url().endsWith('/rpc/join_room'));
      await guest.page.getByLabel('Room code input', { exact: true }).fill(`  ${room.code.toLowerCase()}  `);
      await guest.page.getByRole('button', { name: 'Join Room', exact: true }).click();
      expect((await request).postDataJSON()?.p_room_code === room.code).toBe(true);
      await assertAccepted(await joined, room, 'joined', 'guest', 'ready');
      await assertReady(guest.page, guest, room);
      expect((await ownParticipant(guest.page)) !== participant).toBe(true);
      expect((await ownRooms(page, api))[0].state === 'ready').toBe(true);
      await expect(page.getByRole('heading', { name: 'Waiting', exact: true })).toBeVisible();
      expect(diagnostics.signupAttempts + guest.signupAttempts === 2).toBe(true);
      await diagnostics.record({ scenario: 'E04', outcome: 'manual canonical join; guest ready; two seats' });
    });
  });
});

test('@us2-join E10 malformed manual code performs no RPC', async ({ page, diagnostics }) => {
  await safeBody(diagnostics, async () => {
    const api = await startHost(page, diagnostics);
    let calls = 0;
    const observe = (request: import('@playwright/test').Request) => { if (/\/rpc\/(?:create_room|join_room)$/.test(request.url())) calls++; };
    page.on('request', observe);
    try {
      await page.getByLabel('Room code input', { exact: true }).fill('not-an-invitation');
      await page.getByRole('button', { name: 'Join Room', exact: true }).click();
      await assertNoRoomDetails(page, diagnostics, malformedMessage);
      expect(new URL(page.url()).pathname === '/' && calls === 0 && (await ownRooms(page, api)).length === 0).toBe(true);
    } finally { page.removeListener('request', observe); }
  });
});

test('@us2-join E10 malformed direct invitation performs no RPC', async ({ page, diagnostics }) => {
  await safeBody(diagnostics, async () => {
    diagnostics.allowAnonymousSignups(1);
    const signup = page.waitForRequest(request => request.url().endsWith('/auth/v1/signup'));
    let calls = 0;
    const observe = (request: import('@playwright/test').Request) => { if (/\/rpc\/(?:create_room|join_room)$/.test(request.url())) calls++; };
    page.on('request', observe);
    try {
      expect((await page.goto('/room/invalid'))?.status() === 200).toBe(true);
      await assertNoRoomDetails(page, diagnostics, malformedMessage);
      const request = await signup, publicKey = await request.headerValue('apikey');
      expect(!!publicKey && calls === 0).toBe(true);
      expect((await ownRooms(page, { origin: new URL(request.url()).origin, publicKey: publicKey! })).length === 0).toBe(true);
    } finally { page.removeListener('request', observe); }
  });
});

test('@us2-join E11 random unknown canonical code returns real not_found', async ({ page, diagnostics }) => {
  await safeBody(diagnostics, async () => {
    const api = await startHost(page, diagnostics);
    const code = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
    const rejected = page.waitForResponse(response => response.url().endsWith('/rpc/join_room'));
    await page.goto(`/room/${code}`);
    // A random collision fails this trial; no privileged existence oracle or retry.
    await assertRejected(await rejected, 'not_found');
    await assertNoRoomDetails(page, diagnostics, missingMessage);
    expect((await ownRooms(page, api)).length === 0).toBe(true);
  });
});

test('@us2-join E04 pre-acceptance failure preserves Waiting then same-code retry joins', async ({ page, diagnostics, browser, baseURL, viewport }, info) => {
  await safeBody(diagnostics, async () => {
    const { api, room } = await createWaiting(page, diagnostics);
    await withParticipants(browser, { baseURL, viewport }, info, 1, async ([guest]) => {
      await startHost(guest.page, guest);
      const participant = await ownParticipant(guest.page);
      let aborted = 0, interceptionFailed = false;
      const abort = async (route: Route) => {
        try { aborted++; await route.abort('failed'); } catch { interceptionFailed = true; }
      };
      await guest.page.route(joinEndpoint, abort, { times: 1 });
      try {
        await guest.page.getByLabel('Room code input', { exact: true }).fill(room.code);
        await guest.page.getByRole('button', { name: 'Join Room', exact: true }).click();
        await assertNoRoomDetails(guest.page, guest, 'Unable to open this room. Please try again.');
        expect(aborted === 1 && !interceptionFailed).toBe(true);
        const before = await ownRooms(page, api);
        expect(before.length === 1 && before[0].id === room.id && before[0].code === room.code && before[0].state === 'waiting').toBe(true);
        expect((await ownRooms(guest.page, api)).length === 0).toBe(true);
        await guest.page.unroute(joinEndpoint, abort);
        const retry = guest.page.waitForResponse(response => response.url().endsWith('/rpc/join_room'));
        const request = guest.page.waitForRequest(request => request.url().endsWith('/rpc/join_room'));
        await guest.page.getByRole('button', { name: 'Retry room', exact: true }).click();
        expect((await request).postDataJSON()?.p_room_code === room.code).toBe(true);
        await assertAccepted(await retry, room, 'joined', 'guest', 'ready');
        await assertReady(guest.page, guest, room);
        expect((await ownParticipant(guest.page)) === participant && (await ownRooms(page, api))[0].state === 'ready').toBe(true);
        await diagnostics.record({ scenario: 'E04', outcome: 'pre-acceptance abort; Waiting unchanged; same-code retry joined guest ready' });
      } finally { await guest.page.unroute(joinEndpoint, abort); }
    });
  });
});

test('@capacity-smoke E05 minimal third identity rejection preserves admitted seats', async ({ page, diagnostics, browser, baseURL, viewport }, info) => {
  await safeBody(diagnostics, async () => {
    const { api, room, invitation, participant } = await createWaiting(page, diagnostics);
    await withParticipants(browser, { baseURL, viewport }, info, 2, async ([guest, third]) => {
      await linkGuest(guest, room, invitation);
      const guestId = await ownParticipant(guest.page);
      const rejected = third.page.waitForResponse(response => response.url().endsWith('/rpc/join_room'));
      await third.page.goto(invitation);
      await assertRejected(await rejected, 'full');
      await assertNoRoomDetails(third.page, third, fullMessage);
      const thirdId = await ownParticipant(third.page);
      expect(new Set([participant, guestId, thirdId]).size === 3 && (await ownRooms(third.page, api)).length === 0).toBe(true);
      await expect(page.getByRole('heading', { name: 'Waiting', exact: true })).toBeVisible();
      await repeatReady(page, diagnostics, api, room, 'host');
      await repeatReady(guest.page, guest, api, room, 'guest');
      expect((await ownParticipant(page)) === participant && (await ownParticipant(guest.page)) === guestId).toBe(true);
      expect(diagnostics.signupAttempts + guest.signupAttempts + third.signupAttempts === anonymousBudget.E05).toBe(true);
      await diagnostics.record({ scenario: 'E05', outcome: 'minimal full smoke; third rejected; same admitted host guest' });
    });
  });
});

test('@capacity-smoke E12 minimal known-ID RLS read preserves two own rooms', async ({ page, diagnostics, browser, baseURL, viewport }, info) => {
  await safeBody(diagnostics, async () => {
    const owner = await createWaiting(page, diagnostics);
    await withParticipants(browser, { baseURL, viewport }, info, 1, async ([unrelated]) => {
      const other = await createWaiting(unrelated.page, unrelated);
      expect(owner.participant !== other.participant && owner.room.id !== other.room.id).toBe(true);
      const beforeOwner = await ownRooms(page, owner.api), beforeOther = await ownRooms(unrelated.page, other.api);
      // Internal ID came only from its owner's accepted real create/re-entry.
      // This request uses the unrelated browser's own ordinary Auth and RLS.
      expect((await ownRooms(unrelated.page, other.api, owner.room.id)).length === 0).toBe(true);
      expect(JSON.stringify(await ownRooms(page, owner.api)) === JSON.stringify(beforeOwner)).toBe(true);
      expect(JSON.stringify(await ownRooms(unrelated.page, other.api)) === JSON.stringify(beforeOther)).toBe(true);
      await assertWaiting(page, diagnostics, owner.room);
      await assertWaiting(unrelated.page, unrelated, other.room);
      expect(diagnostics.signupAttempts + unrelated.signupAttempts === 2).toBe(true);
      await diagnostics.record({ scenario: 'E12', outcome: 'minimal known-id exact-column read zero rows; both own rooms unchanged; not full US3' });
    });
  });
});
