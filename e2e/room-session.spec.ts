import { expect, type Page, type Route } from '@playwright/test';
import { test, safeBody, SafeDiagnostics } from './support/safe-diagnostics';

// Binding allocation from quickstart; later cases consume these trials, not
// additional fixture/bootstrap identities. Phase 6 implements only the E01 trials alongside the existing Auth row.
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

async function ownRooms(page: Page, api: PublicApi): Promise<RoomProjection[]> {
  // A real member-authorized Data API read, never an owner/service-role oracle.
  // Session access stays inside this browser context and only id/code/state return.
  const rows: unknown = await page.evaluate(async ({ origin, publicKey }) => {
    const key = Object.keys(localStorage).find(name => /^sb-.+-auth-token$/.test(name));
    const session = key ? JSON.parse(localStorage.getItem(key) ?? 'null') : null;
    if (!session?.access_token) throw new Error('E2E_SAFE_FAILURE');
    const response = await fetch(`${origin}/rest/v1/rooms?select=id,code,state`, {
      headers: { apikey: publicKey, Authorization: `Bearer ${session.access_token}` },
    });
    if (!response.ok) throw new Error('E2E_SAFE_FAILURE');
    return response.json();
  }, api);
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
