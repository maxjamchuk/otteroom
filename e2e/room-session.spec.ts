import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { expect, type Page, type Route, type Response } from '@playwright/test';
import { test, safeBody, SafeDiagnostics } from './support/safe-diagnostics';
import { roomSnapshot, startHost, ownRooms, assertWaiting, ownParticipant, realtimeBarrier, withParticipants, assertAccepted, createWaiting, assertReady, linkGuest, type PublicApi, type RoomProjection } from './support/room-harness';

// Binding allocation from quickstart; later cases consume these trials, not
// additional fixture/bootstrap identities. US3 strengthens the existing smokes
// in place and uses exactly the separately allocated E06/E12 trials.
export const anonymousBudget = Object.freeze({
  E01: 3, E02: 2, E03: 4, E04: 4, E05: 3, E06: 3,
  E07: 5, E08: 4, E09: 2, E10: 2, E11: 1, E12: 11, auth: 3,
});

const createEndpoint = '**/rest/v1/rpc/create_room';

async function assertHostRecovery(response: import('@playwright/test').Response, room: RoomProjection) {
  const rows = await response.json();
  expect(response.ok() && Array.isArray(rows) && rows.length === 1 &&
    rows[0].outcome === 'already_member' && rows[0].is_creator === true && rows[0].is_voter === true &&
    rows[0].room_state === 'waiting' && rows[0].voter_count === 1 && rows[0].required_voter_count === 2 && rows[0].filter_completed_count === 0 &&
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
    await diagnostics.assertNoCredentialTextUi();

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
        await fresh!.assertNoCredentialTextUi();

        // Explicit user/test storage clearing, never recovery or quota evasion.
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await expect(page.getByRole('button', { name: 'Create Room' })).toBeVisible();
        const cleared = await ownParticipant(page);
        expect(cleared !== original && cleared !== separate).toBe(true);
        await diagnostics.assertAuthAccounting(2, 2);
        expect(diagnostics.signupAttempts + fresh!.signupAttempts === 3).toBe(true);
        await diagnostics.assertNoCredentialTextUi();
      });
    } finally {
      if (fresh) await fresh.close(); else await context.close();
    }
  });
});

const joinEndpoint = '**/rest/v1/rpc/join_room';
const malformedMessage = 'Malformed invitation. Enter a valid room code.';
const missingMessage = 'Room not found. Check your invitation.';
const fullMessage = 'Room Full. The voting group is already assembled.';

async function assertRejected(response: Response, outcome: 'not_found' | 'full') {
  const rows: unknown = await response.json();
  expect(response.ok() && Array.isArray(rows) && rows.length === 1 && rows[0] &&
    Object.keys(rows[0]).sort().join(',') === 'filter_completed_count,is_creator,is_voter,outcome,required_voter_count,room_code,room_id,room_state,voter_count' &&
    rows[0].outcome === outcome && ['room_id', 'room_code', 'room_state', 'is_creator', 'is_voter', 'voter_count', 'required_voter_count', 'filter_completed_count'].every(key => rows[0][key] === null)).toBe(true);
}

async function assertNoRoomDetails(page: Page, diagnostics: SafeDiagnostics, message: string) {
  await expect(page.getByText(message, { exact: true })).toBeVisible();
  await expect(page.getByLabel('Room code', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Invitation link', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/^[12] of 2 voters$/)).toHaveCount(0);
  await diagnostics.assertAuthAccounting(1, 1);
  await diagnostics.assertNoCredentialTextUi();
}

async function repeatReady(page: Page, diagnostics: SafeDiagnostics, api: PublicApi, room: RoomProjection, role: 'host' | 'guest') {
  const participant = await ownParticipant(page);
  const joined = page.waitForResponse(response => response.url().endsWith('/rpc/join_room'));
  expect((await page.reload())?.status() === 200).toBe(true);
  await assertAccepted(await joined, room, 'already_member', { isCreator: role === 'host', isVoter: true }, 'ready');
  await assertReady(page, diagnostics, room);
  const rooms = await ownRooms(page, api);
  expect(rooms.length === 1 && rooms[0].id === room.id && rooms[0].code === room.code && rooms[0].state === 'ready' &&
    (await ownParticipant(page)) === participant).toBe(true);
}

test('@us2-join E02 actual invitation and same-member host guest re-entry', async ({ page, diagnostics, browser, baseURL, viewport }, info) => {
  await safeBody(diagnostics, async () => {
    const transport = await realtimeBarrier(page);
    try {
      const { api, room, invitation, participant } = await createWaiting(page, diagnostics);
      await transport.wait('transportJoins', 1);
      await transport.wait('readiness', 1);
      await transport.wait('reads', 1);
      const before = { ...transport.stats };
      await withParticipants(browser, { baseURL, viewport }, info, 1, async ([guest]) => {
        await linkGuest(guest, room, invitation); // Only after real DB subscription readiness.
        expect((await ownParticipant(guest.page)) !== participant).toBe(true);
        await transport.wait('updates', before.updates + 1);
        await transport.wait('reads', before.reads + 1);
        await assertReady(page, diagnostics, room); // No host navigation/reload.
        expect((await ownRooms(page, api))[0].state === 'ready').toBe(true);
        transport.assertHealthy();
        await repeatReady(page, diagnostics, api, room, 'host');
        await repeatReady(guest.page, guest, api, room, 'guest');
        expect(diagnostics.signupAttempts + guest.signupAttempts === anonymousBudget.E02).toBe(true);
        await diagnostics.record({ scenario: 'E02', outcome: 'transport joined; postgres system-ok; guest commit; real UPDATE; refetch; host Ready; same-member re-entry' });
      });
    } finally { await transport.close(); }
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
      await assertAccepted(await joined, room, 'joined', { isCreator: false, isVoter: true }, 'ready');
      await assertReady(guest.page, guest, room);
      expect((await ownParticipant(guest.page)) !== participant).toBe(true);
      expect((await ownRooms(page, api))[0].state === 'ready').toBe(true);
      await assertReady(page, diagnostics, room);
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
        await assertAccepted(await retry, room, 'joined', { isCreator: false, isVoter: true }, 'ready');
        await assertReady(guest.page, guest, room);
        await assertReady(page, diagnostics, room);
        expect((await ownParticipant(guest.page)) === participant && (await ownRooms(page, api))[0].state === 'ready').toBe(true);
        await diagnostics.record({ scenario: 'E04', outcome: 'pre-acceptance abort; Waiting unchanged; same-code retry joined guest ready' });
      } finally { await guest.page.unroute(joinEndpoint, abort); }
    });
  });
});

test('@us3 E05 full-room repeated rejection preserves admitted seats @capacity-smoke', async ({ page, diagnostics, browser, baseURL, viewport }, info) => {
  await safeBody(diagnostics, async () => {
    const { api, room, invitation, participant } = await createWaiting(page, diagnostics);
    await withParticipants(browser, { baseURL, viewport }, info, 2, async ([guest, third]) => {
      await linkGuest(guest, room, invitation);
      await assertReady(page, diagnostics, room);
      const guestId = await ownParticipant(guest.page);
      const before = roomSnapshot(room);
      expect(before.creator_user_id === participant && before.members.some(m => m.user_id === guestId && m.is_voter) && before.state === 'ready').toBe(true);
      const rejected = third.page.waitForResponse(response => response.url().endsWith('/rpc/join_room'));
      await third.page.goto(invitation);
      await assertRejected(await rejected, 'full');
      await assertNoRoomDetails(third.page, third, fullMessage);
      const thirdId = await ownParticipant(third.page);
      expect(new Set([participant, guestId, thirdId]).size === 3 && (await ownRooms(third.page, api)).length === 0).toBe(true);
      for (let attempt = 0; attempt < 2; attempt++) {
        const repeated = third.page.waitForResponse(response => response.url().endsWith('/rpc/join_room'));
        await third.page.reload();
        await assertRejected(await repeated, 'full');
        await assertNoRoomDetails(third.page, third, fullMessage);
        expect((await ownParticipant(third.page)) === thirdId && JSON.stringify(roomSnapshot(room)) === JSON.stringify(before)).toBe(true);
        expect(await third.page.evaluate(values => values.every(value => !document.body.innerText.includes(value)), [room.id, participant, guestId, thirdId])).toBe(true);
      }
      await assertReady(page, diagnostics, room);
      await repeatReady(page, diagnostics, api, room, 'host');
      await repeatReady(guest.page, guest, api, room, 'guest');
      expect((await ownParticipant(page)) === participant && (await ownParticipant(guest.page)) === guestId).toBe(true);
      expect(JSON.stringify(roomSnapshot(room)) === JSON.stringify(before)).toBe(true);
      expect(diagnostics.signupAttempts + guest.signupAttempts + third.signupAttempts === anonymousBudget.E05).toBe(true);
      await diagnostics.record({ scenario: 'E05', outcome: 'full; all projection fields null; three rejections; admitted host guest Ready; complete row unchanged' });
    });
  });
});

test('@us3 E06 overlapping final-seat requests accept exactly one guest', async ({ page, diagnostics, browser, baseURL, viewport }, info) => {
  await safeBody(diagnostics, async () => {
    const transport = await realtimeBarrier(page);
    try {
      const { api, room, participant } = await createWaiting(page, diagnostics);
      await transport.wait('readiness', 1); await transport.wait('reads', 1);
      const before = roomSnapshot(room);
      expect(before.creator_user_id === participant && before.voter_count === 1 && before.members.length === 1 && before.state === 'waiting').toBe(true);
      await withParticipants(browser, { baseURL, viewport }, info, 2, async guests => {
        for (const guest of guests) await startHost(guest.page, guest);
        const identities = await Promise.all(guests.map(guest => ownParticipant(guest.page)));
        expect(new Set([participant, ...identities]).size === 3).toBe(true);
        let release!: () => void, arrived!: () => void, timedOut = false;
        const gate = new Promise<void>(resolve => { release = resolve; });
        const barrier = new Promise<void>(resolve => { arrived = resolve; });
        const held = new Set<number>(), forwarded = new Set<number>();
        let interceptionFailed = false;
        const deadline = setTimeout(() => { timedOut = true; arrived(); release(); }, 10000);
        const handlers = guests.map((_, index) => async (route: Route) => {
          try {
            if (held.has(index) || route.request().postDataJSON()?.p_room_code !== room.code) throw new Error();
            held.add(index); if (held.size === 2) arrived();
            await gate;
            if (timedOut || held.size !== 2) { await route.abort(); return; }
            forwarded.add(index); await route.continue();
          } catch { interceptionFailed = true; await route.abort().catch(() => {}); }
        });
        const monitors = [];
        try {
          // Both routes precede navigation. Both callers are already authenticated.
          for (let index = 0; index < guests.length; index++) {
            await guests[index].page.route(joinEndpoint, handlers[index], { times: 1 });
            monitors.push(await monitorRendered(guests[index].page));
            await guests[index].page.getByLabel('Room code input', { exact: true }).fill(room.code);
          }
          const pending = guests.map(guest => guest.page.waitForResponse(response => response.url().endsWith('/rpc/join_room')));
          // Dispatch both actions before observing either RPC outcome.
          await Promise.all(guests.map(guest => guest.page.getByRole('button', { name: 'Join Room', exact: true }).click()));
          await barrier;
          expect(!timedOut && held.size === 2 && forwarded.size === 0).toBe(true);
          clearTimeout(deadline); release();
          const responses = await Promise.all(pending);
          const outcomes = await Promise.all(responses.map(async response => (await response.json())[0]?.outcome));
          expect(!interceptionFailed && forwarded.size === 2 && outcomes.filter(outcome => outcome === 'joined').length === 1 && outcomes.filter(outcome => outcome === 'full').length === 1).toBe(true);
          const winnerIndex = outcomes.indexOf('joined'), loserIndex = outcomes.indexOf('full');
          const winner = guests[winnerIndex], loser = guests[loserIndex];
          await assertAccepted(responses[winnerIndex], room, 'joined', { isCreator: false, isVoter: true }, 'ready');
          await assertRejected(responses[loserIndex], 'full');
          await transport.wait('updates', 1); await transport.wait('reads', 2);
          const joinedRow = roomSnapshot(room);
          expect(transport.stats.updates === 1 && joinedRow.members.some(m => m.user_id === identities[winnerIndex] && m.is_voter) &&
            joinedRow.state === 'ready' && joinedRow.movie_candidate_id === null).toBe(true);
          await assertReady(winner.page, winner, room);
          await assertNoRoomDetails(loser.page, loser, fullMessage);
          expect(!await monitors[loserIndex].violated()).toBe(true);
          await transport.wait('updates', 1); await transport.wait('reads', 2);
          await assertReady(page, diagnostics, room);
          const committed = roomSnapshot(room);
          expect(committed.creator_user_id === before.creator_user_id && committed.members.some(m => m.user_id === identities[winnerIndex] && m.is_voter) &&
            committed.state === 'ready' && committed.creation_request_id === before.creation_request_id && committed.created_at === before.created_at).toBe(true);
          await monitors[loserIndex].close();
          const rejected = loser.page.waitForResponse(response => response.url().endsWith('/rpc/join_room'));
          await loser.page.reload(); await assertRejected(await rejected, 'full');
          await assertNoRoomDetails(loser.page, loser, fullMessage);
          expect((await ownRooms(loser.page, api)).length === 0).toBe(true);
          expect(transport.stats.joins === 1).toBe(true);
          await repeatJoin(page, api, room, 'host'); await repeatJoin(winner.page, api, room, 'guest');
          expect(JSON.stringify(roomSnapshot(room)) === JSON.stringify(committed)).toBe(true);
          expect(!interceptionFailed && transport.stats.updates === 1 && transport.stats.joins === 2 &&
            committed.movie_candidate_id === null).toBe(true);
          for (let index = 0; index < guests.length; index++) {
            expect((await ownParticipant(guests[index].page)) === identities[index]).toBe(true);
            await guests[index].assertAuthAccounting(1, 1);
          }
          transport.assertHealthy();
          await diagnostics.record({ scenario: 'E06', outcome: 'two authenticated requests held then forwarded; exactly joined/full; one membership UPDATE; no transient loser Ready; stable committed winner; candidate requests0; SQL lock evidence paired' });
        } finally {
          clearTimeout(deadline); release();
          for (let index = 0; index < guests.length; index++) {
            await guests[index].page.unroute(joinEndpoint, handlers[index]);
            await monitors[index]?.close();
          }
        }
      });
    } finally { await transport.close(); }
  });
});

// Read-only browser observer: no production state injection or DOM persistence.
// Used before a race to catch even transient false Ready, or after navigation to
// detect stale projection. Only a boolean crosses the diagnostics boundary.
async function monitorRendered(page: Page, forbiddenCode?: string) {
  const handle = await page.evaluateHandle(code => {
    let violation = false;
    const inspect = () => {
      if (code) violation ||= document.querySelector('[aria-label="Room code"]')?.textContent === code;
      else violation ||= [...document.querySelectorAll('[role="heading"]')].some(node => node.textContent === 'Ready') || /2 of 2 voters/.test(document.body.innerText);
    };
    const observer = new MutationObserver(inspect);
    observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true }); inspect();
    return { violated: () => { inspect(); return violation; }, close: () => observer.disconnect() };
  }, forbiddenCode);
  let closed = false;
  return {
    violated: () => handle.evaluate(observer => observer.violated()),
    async close() {
      if (closed) return;
      closed = true;
      try { await handle.evaluate(observer => observer.close()); }
      finally { await handle.dispose(); }
    },
  };
}

test('@us3 E12 known-ID and code RLS reads preserve two own rooms @capacity-smoke', async ({ page, diagnostics, browser, baseURL, viewport }, info) => {
  await safeBody(diagnostics, async () => {
    const owner = await createWaiting(page, diagnostics);
    await withParticipants(browser, { baseURL, viewport }, info, 1, async ([unrelated]) => {
      const other = await createWaiting(unrelated.page, unrelated);
      expect(owner.participant !== other.participant && owner.room.id !== other.room.id).toBe(true);
      const beforeOwner = await ownRooms(page, owner.api), beforeOther = await ownRooms(unrelated.page, other.api);
      const snapshotOwner = roomSnapshot(owner.room), snapshotOther = roomSnapshot(other.room);
      // Internal ID came only from its owner's accepted real create/re-entry.
      // This request uses the unrelated browser's own ordinary Auth and RLS.
      expect((await ownRooms(unrelated.page, other.api, owner.room.id)).length === 0).toBe(true);
      expect((await ownRooms(unrelated.page, other.api, undefined, owner.room.code)).length === 0).toBe(true);
      await assertDenied(unrelated.page, other.api, { method: 'GET', query: `select=creator_user_id,creation_request_id&id=eq.${owner.room.id}` });
      await assertDenied(page, owner.api, { method: 'GET', query: `select=creator_user_id,creation_request_id&id=eq.${owner.room.id}` });
      for (const caller of [diagnostics, unrelated]) await assertDenied(caller.page, owner.api, { table:'room_members',method:'GET',query:`select=*&room_id=eq.${owner.room.id}` });
      expect(JSON.stringify(await ownRooms(page, owner.api)) === JSON.stringify(beforeOwner)).toBe(true);
      expect(JSON.stringify(await ownRooms(unrelated.page, other.api)) === JSON.stringify(beforeOther)).toBe(true);
      await assertWaiting(page, diagnostics, owner.room);
      await assertWaiting(unrelated.page, unrelated, other.room);
      expect(JSON.stringify(roomSnapshot(owner.room)) === JSON.stringify(snapshotOwner) && JSON.stringify(roomSnapshot(other.room)) === JSON.stringify(snapshotOther)).toBe(true);
      expect(await unrelated.page.evaluate(values => values.every(value => !document.body.innerText.includes(value)), [owner.room.id, owner.room.code, owner.participant])).toBe(true);
      expect(diagnostics.signupAttempts + unrelated.signupAttempts === 2).toBe(true);
      await diagnostics.record({ scenario: 'E12', outcome: 'known-id and code exact-column reads zero rows; private columns denied; both complete own rows unchanged' });
    });
  });
});

// Every attack uses the originating browser's ordinary session. Raw responses
// stay in that context; only HTTP status and the exact permission category return.
async function assertDenied(page: Page, api: PublicApi, operation: { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; query?: string; body?: Record<string, unknown>; table?: 'room_members' }, expected: 'permission' | 'generated-state' = 'permission') {
  const result = await page.evaluate(async ({ api, operation }) => {
    const key = Object.keys(localStorage).find(name => /^sb-.+-auth-token$/.test(name));
    const session = key ? JSON.parse(localStorage.getItem(key) ?? 'null') : null;
    if (!session?.access_token) throw new Error('E2E_SAFE_FAILURE');
    const response = await fetch(`${api.origin}/rest/v1/${operation.table ?? 'rooms'}${operation.query ? '?' + operation.query : ''}`, {
      method: operation.method,
      headers: { apikey: api.publicKey, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      ...(operation.body ? { body: JSON.stringify(operation.body) } : {}),
    });
    const value = await response.json();
    return { status: response.status, permissionDenied: value?.code === '42501', generatedDenied: value?.code === '428C9' };
  }, { api, operation });
  if (expected === 'generated-state') {
    // Existing Phase 3 pgTAP separately proves missing UPDATE privileges: PG
    // rejects an explicit generated-column assignment before checking that ACL.
    expect(operation.method === 'PATCH' && Object.keys(operation.body ?? {}).join(',') === 'state').toBe(true);
    expect(result.status === 400 && result.generatedDenied).toBe(true);
  } else expect(result.status === 403 && result.permissionDenied).toBe(true);
}

test('@us3 E12 live unrelated subscription receives no authorized target UPDATE', async ({ page, diagnostics, browser, baseURL, viewport }, info) => {
  await safeBody(diagnostics, async () => {
    const transport = await realtimeBarrier(page);
    try {
      const target = await createWaiting(page, diagnostics);
      await transport.wait('readiness', 1); await transport.wait('reads', 1);
      await withParticipants(browser, { baseURL, viewport }, info, 2, async ([unrelated, guest]) => {
        const other = await createWaiting(unrelated.page, unrelated);
        const before = roomSnapshot(other.room);
        expect((await ownRooms(unrelated.page, other.api, target.room.id)).length === 0).toBe(true);
        // Select only this context's access token, register it in memory, and use
        // the pinned ordinary SDK. No session export, privileged caller or signup.
        let token: string | undefined = await unrelated.page.evaluate(() => {
          const key = Object.keys(localStorage).find(name => /^sb-.+-auth-token$/.test(name));
          return key ? JSON.parse(localStorage.getItem(key) ?? 'null')?.access_token : undefined;
        });
        if (typeof token !== 'string' || !token) throw new Error('E2E_SAFE_FAILURE');
        await unrelated.register([token]);
        const client = createClient(other.api.origin, other.api.publicKey, {
          accessToken: async () => token ?? null,
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          realtime: { disconnectOnEmptyChannelsAfterMs: 0, logger: () => {} },
        });
        // This test-owned SDK has no application bootstrap/auth listener. Finish
        // installing the existing caller token before constructing its join.
        await client.realtime.setAuth(token);
        expect(client.realtime.accessTokenValue === token).toBe(true);
        let transportJoined = false, live = false, failed = false, payloads = 0;
        let expired = false, channelError = false, systemError = false;
        let ready!: () => void;
        const barrier = new Promise<void>(resolve => { ready = resolve; });
        const deadline = setTimeout(() => { expired = true; failed = true; ready(); }, 15000);
        const channel = client.channel(`isolation:${target.room.id}`)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${target.room.id}`, select: ['id'] }, () => { payloads++; })
          .on('system', {}, payload => {
            if (payload.extension !== 'postgres_changes') return;
            if (payload.status === 'ok') live = true; else { systemError = true; failed = true; }
            ready();
          }).subscribe(status => {
            if (status === 'SUBSCRIBED') transportJoined = true;
            else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) { channelError = true; failed = true; ready(); }
          });
        try {
          await barrier; clearTimeout(deadline);
          // A timeout/system error is failure, NOT isolation evidence. This trial
          // requires the allowed-but-RLS-filtered live stream path explicitly.
          expect(!expired).toBe(true);
          expect(!channelError).toBe(true);
          expect(!systemError).toBe(true);
          expect(transportJoined).toBe(true);
          expect(!failed && live).toBe(true);
          await linkGuest(guest, target.room, target.invitation);
          await transport.wait('updates', 1); await transport.wait('reads', 2);
          await assertReady(page, diagnostics, target.room);
          // Negative observation window required by T110, only AFTER confirmed
          // readiness and an authorized observer's genuine committed UPDATE.
          await new Promise<void>(resolve => setTimeout(resolve, 1500));
          expect(!failed && live && payloads === 0).toBe(true);
          expect((await ownRooms(unrelated.page, other.api, target.room.id)).length === 0).toBe(true);
          expect(JSON.stringify(roomSnapshot(other.room)) === JSON.stringify(before)).toBe(true);
          const admitted = roomSnapshot(target.room), admittedId = await ownParticipant(guest.page);
          expect(admitted.creator_user_id === target.participant && admitted.members.some(m => m.user_id === admittedId && m.is_voter) && admitted.state === 'ready').toBe(true);
          await assertWaiting(unrelated.page, unrelated, other.room);
          expect(await unrelated.page.evaluate(values => values.every(value => !document.body.innerText.includes(value)), [target.room.id, target.room.code, target.participant])).toBe(true);
          transport.assertHealthy();
          await diagnostics.record({ scenario: 'E12', outcome: 'unrelated ordinary authenticated subscription system-ok; live empty stream; authorized observer UPDATE and Ready; 1500ms negative window; zero disclosure' });
        } finally {
          clearTimeout(deadline);
          try { expect(await client.removeChannel(channel) === 'ok').toBe(true); }
          finally { await client.realtime.disconnect(); token = undefined; }
        }
      });
    } finally { await transport.close(); }
  });
});

test('@us3 E12 delayed old-room response cannot contaminate legitimate new navigation', async ({ page, diagnostics, browser, baseURL, viewport }, info) => {
  await safeBody(diagnostics, async () => {
    const old = await createWaiting(page, diagnostics);
    await withParticipants(browser, { baseURL, viewport }, info, 2, async ([otherHost, guest]) => {
      const next = await createWaiting(otherHost.page, otherHost);
      const transport = await realtimeBarrier(guest.page);
      const matchesOld = (url: URL) => url.pathname === '/rest/v1/rooms' && url.searchParams.get('id') === `eq.${old.room.id}`;
      let release!: () => void, captured!: () => void, delivered!: () => void;
      let failed = false, held = 0;
      const gate = new Promise<void>(resolve => { release = resolve; });
      const capturedResponse = new Promise<void>(resolve => { captured = resolve; });
      const deliveredResponse = new Promise<void>(resolve => { delivered = resolve; });
      const deadline = setTimeout(() => { failed = true; captured(); delivered(); release(); }, 15000);
      const hold = async (route: Route) => {
        try {
          const response = await route.fetch({ maxRetries: 0, maxRedirects: 0, timeout: 10000 });
          try {
            const rows = await response.json();
            if (!response.ok() || !Array.isArray(rows) || rows.length !== 1 || rows[0].id !== old.room.id || rows[0].state !== 'ready') throw new Error();
            held++; captured(); await gate;
            await route.fulfill({ response }); delivered();
          } finally { await response.dispose(); }
        } catch { failed = true; captured(); delivered(); await route.abort().catch(() => {}); }
      };
      let monitor: Awaited<ReturnType<typeof monitorRendered>> | undefined;
      await guest.page.route(matchesOld, hold, { times: 1 });
      try {
        await linkGuest(guest, old.room, old.invitation);
        const participant = await ownParticipant(guest.page);
        await transport.wait('readiness', 1); await capturedResponse;
        expect(!failed && held === 1 && transport.stats.reads === 0).toBe(true);
        // Actual SPA route change keeps the old fetch alive, unlike a document
        // reload which would destroy the old JS generation instead of testing it.
        await guest.page.getByRole('link', { name: 'Back to home', exact: true }).click();
        await expect(guest.page.getByRole('button', { name: 'Join Room', exact: true })).toBeVisible();
        const joined = guest.page.waitForResponse(response => response.url().endsWith('/rpc/join_room'));
        await guest.page.getByLabel('Room code input', { exact: true }).fill(next.room.code);
        await guest.page.getByRole('button', { name: 'Join Room', exact: true }).click();
        await assertAccepted(await joined, next.room, 'joined', { isCreator: false, isVoter: true }, 'ready');
        await assertReady(guest.page, guest, next.room);
        await transport.wait('leaveAcks', 1); transport.assertRetired(old.room.id);
        await transport.wait('readiness', 2); await transport.wait('reads', 1);
        monitor = await monitorRendered(guest.page, old.room.code);
        const beforeOld = roomSnapshot(old.room), beforeNew = roomSnapshot(next.room);
        const observed = guest.page.waitForResponse(response => matchesOld(new URL(response.url())));
        release(); await deliveredResponse;
        const stale = await observed; expect(await stale.finished() === null).toBe(true);
        // Flush actual browser rendering turns after delivery, not a fixed sleep.
        await guest.page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        expect(!failed && !await monitor.violated()).toBe(true);
        await assertReady(guest.page, guest, next.room);
        expect((await ownParticipant(guest.page)) === participant && beforeOld.members.some(m => m.user_id === participant && m.is_voter) && beforeNew.members.some(m => m.user_id === participant && m.is_voter)).toBe(true);
        expect(JSON.stringify(roomSnapshot(old.room)) === JSON.stringify(beforeOld) && JSON.stringify(roomSnapshot(next.room)) === JSON.stringify(beforeNew)).toBe(true);
        await assertReady(page, diagnostics, old.room); await assertReady(otherHost.page, otherHost, next.room);
        transport.assertHealthy();
        await diagnostics.record({ scenario: 'E12', outcome: 'real old response held; authorized SPA navigation; old channel leave acknowledged; unchanged response released; only new room; same participant' });
      } finally {
        clearTimeout(deadline); release();
        await guest.page.unroute(matchesOld, hold);
        await monitor?.close(); await transport.close();
      }
    });
  });
});

test('@us3 E12 direct writes and participant spoofing cannot change Ready membership', async ({ page, diagnostics, browser, baseURL, viewport }, info) => {
  await safeBody(diagnostics, async () => {
    const { api, room, invitation, participant } = await createWaiting(page, diagnostics);
    await withParticipants(browser, { baseURL, viewport }, info, 2, async ([guest, outsider]) => {
      await linkGuest(guest, room, invitation); await assertReady(page, diagnostics, room);
      await startHost(outsider.page, outsider);
      const guestId = await ownParticipant(guest.page), outsiderId = await ownParticipant(outsider.page);
      expect(new Set([participant, guestId, outsiderId]).size === 3).toBe(true);
      const before = roomSnapshot(room);
      for (const caller of [diagnostics, guest, outsider]) {
        const code = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
        await assertDenied(caller.page, api, { method: 'POST', body: {
          code, creation_request_id: randomUUID(), creator_user_id: participant, required_voter_count: 2, voter_count: 2,
        } });
        for (const body of [
          { creator_user_id: outsiderId }, { required_voter_count: 3 },
          { voter_count: 3 }, { voter_count: 0 },
        ]) await assertDenied(caller.page, api, { method: 'PATCH', query: `id=eq.${room.id}`, body });
        for (const state of ['waiting', 'ready']) await assertDenied(caller.page, api, { method: 'PATCH', query: `id=eq.${room.id}`, body: { state } }, 'generated-state');
        await assertDenied(caller.page, api, { method: 'DELETE', query: `id=eq.${room.id}` });
        await assertDenied(caller.page, api, {table:'room_members',method:'POST',body:{room_id:room.id,user_id:outsiderId,is_voter:true}});
        for(const body of [{user_id:outsiderId},{is_voter:false}])
          await assertDenied(caller.page, api, {table:'room_members',method:'PATCH',query:`room_id=eq.${room.id}`,body});
        await assertDenied(caller.page, api, {table:'room_members',method:'DELETE',query:`room_id=eq.${room.id}`});
        expect(JSON.stringify(roomSnapshot(room)) === JSON.stringify(before)).toBe(true);
        await caller.assertAuthAccounting(1, 1);
      }
      expect((await ownRooms(outsider.page, api)).length === 0 && before.creator_user_id === participant && before.members.some(m => m.user_id === guestId && m.is_voter) && before.state === 'ready').toBe(true);
      await repeatJoin(page, api, room, 'host'); await repeatJoin(guest.page, api, room, 'guest');
      for (const caller of [diagnostics, guest]) {
        await assertReady(caller.page, caller, room);
        expect((await ownRooms(caller.page, api)).length === 1).toBe(true);
      }
      expect(JSON.stringify(roomSnapshot(room)) === JSON.stringify(before)).toBe(true);
      await diagnostics.record({ scenario: 'E12', outcome: 'host guest outsider ordinary credentials; 30 HTTP403 permission denials; 6 HTTP400 generated-state denials; UPDATE ACL separately proven in pgTAP; complete row unchanged' });
    });
  });
});

for (const missedInitial of [false, true]) {
  test(`@us2-realtime E03 ${missedInitial ? 'first binding recovers missed initial commit' : 'bound UPDATE converges both browsers'}`, async ({ page, diagnostics, browser, baseURL, viewport }, info) => {
    await safeBody(diagnostics, async () => {
      const transport = await realtimeBarrier(page, missedInitial); // Before navigation.
      try {
        const { api, room, invitation, participant } = await createWaiting(page, diagnostics);
        if (missedInitial) await transport.wait('held', 1);
        else { await transport.wait('readiness', 1); await transport.wait('reads', 1); }
        const reads = transport.stats.reads;
        await withParticipants(browser, { baseURL, viewport }, info, 1, async ([guest]) => {
          await linkGuest(guest, room, invitation); // Real committed join response.
          expect((await ownParticipant(guest.page)) !== participant && (await ownRooms(page, api))[0].state === 'ready').toBe(true);
          if (missedInitial) {
            expect(transport.stats.readiness === 0 && transport.stats.reads === 0 && transport.stats.updates === 0).toBe(true);
            await expect(page.getByRole('heading', { name: 'Waiting', exact: true })).toBeVisible();
            transport.release();
          } else await transport.wait('updates', 1);
          await transport.wait('readiness', 1); await transport.wait('reads', reads + 1);
          await assertReady(page, diagnostics, room); await assertReady(guest.page, guest, room);
          expect(transport.stats.joins === 1 && (await ownParticipant(page)) === participant && diagnostics.signupAttempts + guest.signupAttempts === 2).toBe(true);
          transport.assertHealthy();
          await diagnostics.record({ scenario: 'E03', outcome: missedInitial ? 'guest committed before first binding; real postgres system-ok; authoritative refetch; both ready; no host reload' : 'postgres system-ok; UPDATE invalidation; authoritative refetch; both ready; no host reload' });
        });
      } finally { await transport.close(); }
    });
  });
}

test('@us4 E07 host Waiting reload retains identity and seat', async ({ page, diagnostics }) => {
  await safeBody(diagnostics, async () => {
    const { api, room, participant } = await createWaiting(page, diagnostics);
    const recovered = page.waitForResponse(response => response.url().endsWith('/rpc/join_room'));
    expect((await page.reload())?.status() === 200).toBe(true);
    await assertAccepted(await recovered, room, 'already_member', { isCreator: true, isVoter: true }, 'waiting');
    await assertWaiting(page, diagnostics, room);
    const rows = await ownRooms(page, api);
    expect(rows.length === 1 && rows[0].id === room.id && rows[0].code === room.code && rows[0].state === 'waiting' && (await ownParticipant(page)) === participant).toBe(true);
    await diagnostics.record({ scenario: 'E07', outcome: 'host Waiting reload; same identity/code/role; one seat; no new signup' });
  });
});

for (const role of ['host', 'guest'] as const) {
  test(`@us4 ${role === 'host' ? 'E07' : 'E08'} ${role} Ready reload retains identity and seat`, async ({ page, diagnostics, browser, baseURL, viewport }, info) => {
    await safeBody(diagnostics, async () => {
      const { api, room, invitation } = await createWaiting(page, diagnostics);
      await withParticipants(browser, { baseURL, viewport }, info, 1, async ([guest]) => {
        await linkGuest(guest, room, invitation); await assertReady(page, diagnostics, room);
        const target = role === 'host' ? diagnostics : guest;
        await repeatReady(target.page, target, api, room, role);
        await assertReady(page, diagnostics, room); await assertReady(guest.page, guest, room);
        expect(diagnostics.signupAttempts + guest.signupAttempts === 2).toBe(true);
        await target.record({ scenario: role === 'host' ? 'E07' : 'E08', outcome: 'Ready reload; already_member; same identity/code/role; two seats; no new signup' });
      });
    });
  });
}

// Own-session credentials stay inside the originating browser, never returned to
// the runner. Both overlapping fetches are dispatched before awaiting either.
async function repeatJoin(page: Page, api: PublicApi, room: RoomProjection, role: 'host' | 'guest', overlap = false) {
  const valid = await page.evaluate(async ({ api, room, role, overlap }) => {
    const key = Object.keys(localStorage).find(name => /^sb-.+-auth-token$/.test(name));
    const session = key ? JSON.parse(localStorage.getItem(key) ?? 'null') : null;
    if (!session?.access_token) return false;
    const send = () => fetch(`${api.origin}/rest/v1/rpc/join_room`, {
      method: 'POST', headers: { apikey: api.publicKey, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_room_code: room.code }),
    });
    const pending = overlap ? [send(), send()] : [send()];
    const responses = await Promise.all(pending);
    return (await Promise.all(responses.map(async response => {
      const rows = await response.json();
      return response.ok && Array.isArray(rows) && rows.length === 1 &&
        Object.keys(rows[0]).sort().join(',') === 'filter_completed_count,is_creator,is_voter,outcome,required_voter_count,room_code,room_id,room_state,voter_count' &&
        rows[0].outcome === 'already_member' && rows[0].is_creator === (role === 'host') && rows[0].is_voter === true && rows[0].voter_count === 2 && rows[0].required_voter_count === 2 && Number.isInteger(rows[0].filter_completed_count) &&
        rows[0].room_id === room.id && rows[0].room_code === room.code && rows[0].room_state === 'ready';
    }))).every(Boolean);
  }, { api, room, role, overlap });
  expect(valid).toBe(true);
}

test('@us4 E09 repeated host guest and overlapping guest joins stay idempotent', async ({ page, diagnostics, browser, baseURL, viewport }, info) => {
  await safeBody(diagnostics, async () => {
    const { api, room, invitation, participant } = await createWaiting(page, diagnostics);
    await withParticipants(browser, { baseURL, viewport }, info, 1, async ([guest]) => {
      await linkGuest(guest, room, invitation); await assertReady(page, diagnostics, room);
      const guestId = await ownParticipant(guest.page);
      await repeatJoin(page, api, room, 'host'); await repeatJoin(guest.page, api, room, 'guest');
      await repeatJoin(guest.page, api, room, 'guest', true);
      for (const target of [diagnostics, guest]) {
        const rows = await ownRooms(target.page, api);
        expect(rows.length === 1 && rows[0].id === room.id && rows[0].code === room.code && rows[0].state === 'ready').toBe(true);
        await assertReady(target.page, target, room);
      }
      expect((await ownParticipant(page)) === participant && (await ownParticipant(guest.page)) === guestId && diagnostics.signupAttempts + guest.signupAttempts === anonymousBudget.E09).toBe(true);
      await diagnostics.record({ scenario: 'E09', outcome: 'host/guest repeated joins and two overlapping guest requests; all already_member; same seats; no signup' });
    });
  });
});

for (const role of ['host', 'guest'] as const) {
  test(`@us4 ${role === 'host' ? 'E07' : 'E08'} ${role} actual socket loss and unchanged transport recovery`, async ({ page, diagnostics, browser, baseURL, viewport }, info) => {
    await safeBody(diagnostics, async () => {
      await withParticipants(browser, { baseURL, viewport }, info, 1, async ([guest]) => {
        const target = role === 'host' ? diagnostics : guest;
        const transport = await realtimeBarrier(target.page); // Before either app navigation.
        try {
          const { api, room, invitation } = await createWaiting(page, diagnostics);
          if (role === 'guest') { await linkGuest(guest, room, invitation); await assertReady(page, diagnostics, room); }
          await transport.wait('readiness', 1); await transport.wait('reads', 1);
          const participant = await ownParticipant(target.page);
          const before = { ...transport.stats };
          await transport.disconnect(); // Explicitly closes browser AND real server.
          await expect(target.page.getByText('Unable to synchronize this room. Please try again.', { exact: true })).toBeVisible();
          if (role === 'host') {
            await linkGuest(guest, room, invitation);
            expect((await ownRooms(page, api))[0].state === 'ready').toBe(true);
            await expect(page.getByRole('heading', { name: 'Waiting', exact: true })).toBeVisible();
          } else await assertReady(guest.page, guest, room);
          expect(transport.stats.reads === before.reads && transport.stats.readiness === before.readiness && transport.stats.losses > before.losses).toBe(true);
          transport.holdReadiness(); transport.resume();
          await transport.wait('transportJoins', before.transportJoins + 1);
          await transport.wait('readyHeld', before.readyHeld + 1);
          // Transport is joined, but actual system-ok has not reached the app.
          expect(transport.stats.reads === before.reads && transport.stats.readiness === before.readiness).toBe(true);
          await expect(target.page.getByText('Unable to synchronize this room. Please try again.', { exact: true })).toBeVisible();
          transport.releaseReadiness();
          await transport.wait('readiness', before.readiness + 1); await transport.wait('reads', before.reads + 1);
          await assertReady(page, diagnostics, room); await assertReady(guest.page, guest, room);
          await expect(target.page.getByText('Unable to synchronize this room. Please try again.', { exact: true })).toHaveCount(0);
          expect((await ownParticipant(target.page)) === participant && transport.stats.joins === before.joins && diagnostics.signupAttempts + guest.signupAttempts === 2).toBe(true);
          transport.assertHealthy();
          await target.record({ scenario: role === 'host' ? 'E07' : 'E08', outcome: 'actual socket loss; gated replacements; transport-only rejoin; new postgres system-ok/refetch; Ready; same identity; no reload/join/signup' });
        } finally { await transport.close(); }
      });
    });
  });
}
