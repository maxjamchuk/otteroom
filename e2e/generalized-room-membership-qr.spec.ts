import { expect, type Page, type Route } from '@playwright/test';
import { test, safeBody, type SafeDiagnostics } from './support/safe-diagnostics';
import { createWaiting, startHost, ownParticipant, withParticipants, realtimeBarrier, assertAccepted,
  assertReady, committedRoomSnapshot, createWaitingWithSession, ownRooms, configureCreation, observeCandidateRpcZero,
  type RoomProjection, type PublicApi } from './support/room-harness';
import { assertFilterProgress, recoverOwnFilter, submitOwnFilter } from './support/filter-harness';
import { assertResolutionTrafficZero, assertResolutionView, assertStoredResolution,
  observeResolutionTraffic } from './support/resolution-harness';
import { verifyInvitationQr } from './support/qr-harness';

export const membershipAnonymousBudget = Object.freeze({ G01: 1, G02: 1, G03: 3, G04: 4, G05: 2, G06: 4, G07: 4, G08: 4, G09: 3 });
type Transport = Awaited<ReturnType<typeof realtimeBarrier>>;
const member = { isCreator: false, isVoter: true };
const joinResponse = (d: { page: Page }) => d.page.waitForResponse(r => new URL(r.url()).pathname === '/rest/v1/rpc/join_room');

async function occupancy(d: SafeDiagnostics, count: number) {
  await expect(d.page.getByRole('heading', { name: count === 3 ? 'Ready' : 'Waiting', exact: true })).toBeVisible();
  await expect(d.page.getByText(`${count} of 3 voters`, { exact: true })).toBeVisible();
  if (count < 3) {
    await expect(d.page.getByTestId('candidate-card')).toHaveCount(0);
    await expect(d.page.getByTestId('candidate-status')).toHaveCount(0);
  }
}
async function admit(d: SafeDiagnostics, room: RoomProjection, invitation: string, count: number, manual = false) {
  const response = joinResponse(d);
  if (manual) {
    await d.page.getByLabel('Room code input', { exact: true }).fill(` ${room.code.toLowerCase()} `);
    await d.page.getByRole('button', { name: 'Join Room', exact: true }).click();
  } else expect((await d.page.goto(invitation))?.status() === 200).toBe(true);
  await assertAccepted(await response, room, 'joined', member, count === 3 ? 'ready' : 'waiting', count);
  await occupancy(d, count);
  if (count < 3) await expect(d.page.getByLabel('Invitation link', { exact: true })).toHaveText(invitation);
  else await expect(d.page.getByLabel('Invitation link', { exact: true })).toHaveCount(0);
}
function stable(room: RoomProjection, snapshot: ReturnType<typeof committedRoomSnapshot>) {
  expect(JSON.stringify(committedRoomSnapshot(room)) === JSON.stringify(snapshot)).toBe(true);
}
async function nextRoomRead(d: SafeDiagnostics, room: RoomProjection, count: number) {
  const request = await d.page.waitForRequest(request => {
    const url = new URL(request.url());
    return url.pathname === '/rest/v1/rooms' && url.searchParams.get('id') === `eq.${room.id}` &&
      url.searchParams.get('select')?.replaceAll(' ', '') === 'id,code,state,voter_count,required_voter_count,filter_completed_count,filter_resolution_status';
  });
  const response = await request.response();
  expect(response?.ok() === true && await response.finished() === null).toBe(true);
  const rows = await response!.json();
  expect(Array.isArray(rows) && rows.length === 1 &&
    Object.keys(rows[0]).sort().join(',') === 'code,filter_completed_count,filter_resolution_status,id,required_voter_count,state,voter_count' &&
    rows[0].id === room.id && rows[0].code === room.code && rows[0].voter_count === count &&
    rows[0].required_voter_count === 3 && Number.isInteger(rows[0].filter_completed_count) &&
    ['pending','compatible','incompatible'].includes(rows[0].filter_resolution_status) &&
    rows[0].state === (count === 3 ? 'ready' : 'waiting')).toBe(true);
}
async function reload(d: SafeDiagnostics, room: RoomProjection, creator: boolean, votes: boolean, count: number, transport?: Transport) {
  const held = transport?.stats.readyHeld ?? 0;
  transport?.holdReadiness();
  const recovered = joinResponse(d);
  expect((await d.page.reload())?.status() === 200).toBe(true);
  await assertAccepted(await recovered, room, 'already_member', { isCreator: creator, isVoter: votes }, count === 3 ? 'ready' : 'waiting', count);
  await occupancy(d, count);
  if (!creator && count < 3) await expect(d.page.getByLabel('Invitation link', { exact: true })).toHaveText(d.page.url());
  else if (!creator) await expect(d.page.getByLabel('Invitation link', { exact: true })).toHaveCount(0);
  if (transport) {
    // Absolute response totals may already include a previous UPDATE's read.
    // Observe this document's actual request only after its real binding gate.
    await transport.wait('readyHeld', held + 1);
    const completed = transport.stats.reads, refetched = nextRoomRead(d, room, count);
    transport.releaseReadiness(); await refetched; await transport.wait('reads', completed + 1);
    transport.assertHealthy();
  }
}
async function reenter(d: SafeDiagnostics, api: PublicApi, room: RoomProjection, creator: boolean, votes: boolean) {
  const valid = await d.page.evaluate(async ({ api, room, creator, votes }) => {
    const key = Object.keys(localStorage).find(name => /^sb-.+-auth-token$/.test(name));
    const session = key ? JSON.parse(localStorage.getItem(key) ?? 'null') : null;
    if (!session?.access_token) return false;
    const send = () => fetch(`${api.origin}/rest/v1/rpc/join_room`, {
      method: 'POST', headers: { apikey: api.publicKey, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_room_code: room.code }),
    });
    return (await Promise.all((await Promise.all([send(), send()])).map(async response => {
      const rows = await response.json(), row = rows?.[0];
      return response.ok && Array.isArray(rows) && rows.length === 1 && row &&
        Object.keys(row).sort().join(',') === 'filter_completed_count,filter_resolution_status,is_creator,is_voter,outcome,required_voter_count,room_code,room_id,room_state,voter_count' &&
        row.outcome === 'already_member' && row.room_id === room.id && row.room_code === room.code && row.room_state === 'ready' &&
        row.is_creator === creator && row.is_voter === votes && row.voter_count === 3 && row.required_voter_count === 3 &&
        Number.isInteger(row.filter_completed_count) && ['pending','compatible','incompatible'].includes(row.filter_resolution_status) &&
        (row.filter_resolution_status==='pending'||row.filter_completed_count===row.required_voter_count);
    }))).every(Boolean);
  }, { api, room, creator, votes });
  expect(valid).toBe(true);
}
async function reconnect(d: SafeDiagnostics, transport: Transport) {
  const joins = transport.stats.joins; await transport.disconnect();
  await expect(d.page.getByText('Unable to synchronize this room. Please try again.', { exact: true })).toBeVisible();
  await occupancy(d, 3);
  const before = { ...transport.stats };
  transport.holdReadiness(); transport.resume();
  await transport.wait('readyHeld', before.readyHeld + 1);
  expect(transport.stats.readRequests === before.readRequests).toBe(true);
  const completed = transport.stats.reads;
  transport.releaseReadiness(); await transport.wait('readRequests', before.readRequests + 1);
  await transport.wait('reads', completed + 1);
  await expect(d.page.getByText('Unable to synchronize this room. Please try again.', { exact: true })).toHaveCount(0);
  expect(transport.stats.joins === joins).toBe(true);
}
async function cleanup(transports: Transport[]) {
  const results = await Promise.allSettled(transports.map(t => t.close()));
  if (results.some(r => r.status === 'rejected')) throw new Error('E2E_SAFE_FAILURE');
}

async function directJoin(page: Page, api: PublicApi, code: string) {
  return page.evaluate(async ({ api, code }) => {
    const key = Object.keys(localStorage).find(name => /^sb-.+-auth-token$/.test(name));
    const session = key ? JSON.parse(localStorage.getItem(key) ?? 'null') : null;
    if (!session?.access_token) throw new Error('E2E_SAFE_FAILURE');
    const response = await fetch(`${api.origin}/rest/v1/rpc/join_room`, {
      method: 'POST', headers: { apikey: api.publicKey, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_room_code: code }),
    });
    const rows = await response.json();
    return { ok: response.ok, row: rows?.[0] };
  }, { api, code });
}

function isStrictFull(row: Record<string, unknown> | undefined): boolean {
  return !!row && Object.keys(row).sort().join(',') === 'filter_completed_count,filter_resolution_status,is_creator,is_voter,outcome,required_voter_count,room_code,room_id,room_state,voter_count' &&
    row.outcome === 'full' && ['filter_completed_count', 'filter_resolution_status', 'is_creator', 'is_voter', 'required_voter_count', 'room_code', 'room_id', 'room_state', 'voter_count']
      .every(key => row[key] === null);
}

async function navigationJoin(page: Page, target: string) {
  const pending = joinResponse({ page });
  const navigation = page.goto(target);
  const response = await pending, rows = await response.json();
  const result = { ok: response.ok(), row: rows?.[0] };
  expect((await navigation)?.status() === 200).toBe(true);
  return result;
}

async function overlappedJoins(pages: Page[], subjects: string[], api: PublicApi, code: string,
  actions = pages.map(page => () => directJoin(page, api, code))) {
  expect(pages.length > 1 && pages.length === subjects.length && pages.length === actions.length).toBe(true);
  let release!: () => void, arrived!: () => void, timedOut = false, forwarded = 0;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const barrier = new Promise<void>(resolve => { arrived = resolve; });
  let held = 0;
  const expectedByPage = new Map<Page, string>();
  pages.forEach((page, index) => {
    const previous = expectedByPage.get(page);
    if (previous && previous !== subjects[index]) throw new Error('E2E_SAFE_FAILURE');
    expectedByPage.set(page, subjects[index]);
  });
  const routes = [...expectedByPage].map(([page, subject]) => ({ page, handler: async (route: Route) => {
    try {
      const headers = await route.request().allHeaders();
      const bearer = headers.authorization?.match(/^Bearer (.+)$/)?.[1];
      const actual = bearer ? JSON.parse(Buffer.from(bearer.split('.')[1], 'base64url').toString('utf8')).sub : undefined;
      if (route.request().postDataJSON()?.p_room_code !== code || actual !== subject || held >= pages.length) throw new Error();
      held++; if (held === pages.length) arrived(); await gate;
      if (timedOut) await route.abort('failed'); else { forwarded++; await route.continue(); }
    } catch { timedOut = true; arrived(); release(); await route.abort('failed').catch(() => {}); }
  }}));
  const deadline = setTimeout(() => { timedOut = true; arrived(); release(); }, 10000);
  for (const route of routes) await route.page.route('**/rest/v1/rpc/join_room', route.handler);
  let calls: Promise<Awaited<ReturnType<typeof directJoin>>>[] = [];
  try {
    calls = actions.map(action => action());
    await barrier; expect(!timedOut && held === pages.length && forwarded === 0).toBe(true);
    clearTimeout(deadline); release(); const results = await Promise.all(calls);
    expect(forwarded === pages.length).toBe(true); return results;
  } finally {
    clearTimeout(deadline); release();
    await Promise.allSettled(calls);
    for (const route of routes) await route.page.unroute('**/rest/v1/rpc/join_room', route.handler);
  }
}

async function assertQr(d: SafeDiagnostics, invitation: string) {
  await expect(d.page.getByLabel('Invitation link', { exact: true })).toHaveText(invitation);
  return verifyInvitationQr(d.page, invitation);
}

test('@membership G01 configured room invitations expose decoded QR', async ({ diagnostics }, info) => {
  test.setTimeout(90000);
  await safeBody(diagnostics, async () => {
    const configurations = [{ requiredVoterCount: 2, creatorIsVoter: true }, { requiredVoterCount: 3, creatorIsVoter: true },
      { requiredVoterCount: 2, creatorIsVoter: false }, { requiredVoterCount: 3, creatorIsVoter: false }];
    const first = await createWaiting(diagnostics.page, diagnostics, configurations[0]);
    const api = first.api; let previous: ReturnType<typeof committedRoomSnapshot> | undefined;
    for (let index = 0; index < configurations.length; index++) {
      const configuration = configurations[index];
      const created = index === 0 ? first : await createWaitingWithSession(diagnostics.page, diagnostics, api, previous!, configuration);
      const snapshot = committedRoomSnapshot(created.room);
      expect(snapshot.row.required_voter_count === configuration.requiredVoterCount &&
        snapshot.row.voter_count === Number(configuration.creatorIsVoter) && snapshot.row.state === 'waiting' &&
        snapshot.members.length === 1 && snapshot.members[0].is_voter === configuration.creatorIsVoter).toBe(true);
      await assertQr(diagnostics, created.invitation);
      await expect(diagnostics.page.getByTestId('candidate-card')).toHaveCount(0);
      expect(await diagnostics.page.evaluate(id => !document.body.innerText.includes(id), created.room.id)).toBe(true);
      previous = snapshot;
      if (index === 0) {
        await diagnostics.page.goto('/');
        await expect(diagnostics.page.getByLabel('Required voter count', { exact: true })).toHaveValue('2');
        for (const invalid of ['1', '2.5', '2147483648']) {
          await diagnostics.page.getByLabel('Required voter count', { exact: true }).fill(invalid);
          await diagnostics.page.getByRole('button', { name: 'Create Room', exact: true }).click();
          await expect(diagnostics.page.getByText('Enter a whole voter count from 2 to 2147483647.', { exact: true })).toBeVisible();
        }
        await diagnostics.page.getByLabel('Required voter count', { exact: true }).fill('2');
        await diagnostics.page.getByRole('button', { name: 'Create Room', exact: true }).click();
        await expect(diagnostics.page.getByText('Choose whether you will vote.', { exact: true })).toBeVisible();
        expect((await ownRooms(diagnostics.page, api)).length === 1).toBe(true);
      }
    }
    expect((await ownRooms(diagnostics.page, api)).length === 4 && diagnostics.signupAttempts === membershipAnonymousBudget.G01).toBe(true);
    await diagnostics.record({ scenario: 'G01', outcome: 'four configured rooms; exact text and independently decoded visible QR; fixed target/creator mode; identity1' });
  });
});

test('@membership G02 room creation failures preserve configuration', async ({ diagnostics }, info) => {
  test.setTimeout(90000);
  await safeBody(diagnostics, async () => {
    const page = diagnostics.page, api = await startHost(page, diagnostics);
    const endpoint = '**/rest/v1/rpc/create_room';
    const configurations = [{ requiredVoterCount: 2, creatorIsVoter: true }, { requiredVoterCount: 3, creatorIsVoter: false },
      { requiredVoterCount: 3, creatorIsVoter: true }, { requiredVoterCount: 2, creatorIsVoter: false },
      { requiredVoterCount: 2, creatorIsVoter: true }, { requiredVoterCount: 3, creatorIsVoter: false }] as const;
    const createTrial = async (index: number, mode: 'abort' | 'loss' | 'overlap') => {
      await page.goto('/'); await configureCreation(page, configurations[index]);
      const before = await ownRooms(page, api), creatorId = await ownParticipant(page);
      let committed: ReturnType<typeof committedRoomSnapshot> | undefined, interceptionFailed = false;
      if (mode === 'abort') {
        await page.route(endpoint, route => route.abort('failed'), { times: 1 });
        await page.getByRole('button', { name: 'Create Room', exact: true }).click();
        await expect(page.getByText('Unable to create your room. Please try again.', { exact: true })).toBeVisible();
        expect((await ownRooms(page, api)).length === before.length).toBe(true);
      } else if (mode === 'loss') {
          try {
            await page.route(endpoint, async route => {
              try {
                const response = await route.fetch({ maxRetries: 0, maxRedirects: 0, timeout: 15000 });
                try {
                  const rows = await response.json(), row = rows?.[0];
                  if (!response.ok() || !row?.room_id || !row?.room_code) throw new Error('E2E_SAFE_FAILURE');
                  committed = committedRoomSnapshot({ id: row.room_id, code: row.room_code, state: 'waiting',
                    voter_count: Number(configurations[index].creatorIsVoter), required_voter_count: configurations[index].requiredVoterCount,
                    filter_completed_count: 0, filter_resolution_status: 'pending' });
                } finally { await response.dispose(); }
                await route.abort('failed');
              } catch { interceptionFailed = true; await route.abort('failed').catch(() => {}); }
            }, { times: 1 });
          } catch { interceptionFailed = true; }
        await page.getByRole('button', { name: 'Create Room', exact: true }).click();
        await expect(page.getByText('Unable to create your room. Please try again.', { exact: true })).toBeVisible();
        expect(committed && (await ownRooms(page, api)).length === before.length + 1).toBe(true);
      } else {
        let duplicate = false, held = 0, forwarded = 0, release!: () => void, first!: () => void, all!: () => void;
        let expectedBody: Record<string, unknown> | undefined;
        const gate = new Promise<void>(resolve => { release = resolve; });
        const firstArrival = new Promise<void>(resolve => { first = resolve; });
        const allArrived = new Promise<void>(resolve => { all = resolve; });
        const deadline = setTimeout(() => { interceptionFailed = true; first(); all(); release(); }, 10000);
        const handler = async (route: Route) => {
          try {
            const body = route.request().postDataJSON() as Record<string, unknown>;
            const headers = await route.request().allHeaders(), bearer = headers.authorization?.match(/^Bearer (.+)$/)?.[1];
            const subject = bearer ? JSON.parse(Buffer.from(bearer.split('.')[1], 'base64url').toString('utf8')).sub : undefined;
            if (!body || subject !== creatorId || held >= 2 || expectedBody && JSON.stringify(body) !== JSON.stringify(expectedBody)) throw new Error();
            expectedBody ??= body; held++; first(); if (held === 2) all(); await gate;
            if (interceptionFailed) await route.abort('failed'); else { forwarded++; await route.continue(); }
          } catch { interceptionFailed = true; first(); all(); release(); await route.abort('failed').catch(() => {}); }
        };
        await page.route(endpoint, handler);
        const created = page.waitForResponse(response => new URL(response.url()).pathname === '/rest/v1/rpc/create_room');
        let duplicateCall: Promise<{ ok: boolean; outcome?: string }> | undefined;
        try {
          await page.getByRole('button', { name: 'Create Room', exact: true }).click(); await firstArrival;
          expect(expectedBody && held === 1 && forwarded === 0).toBe(true);
          duplicateCall = page.evaluate(async ({ api, body }) => {
            const key = Object.keys(localStorage).find(name => /^sb-.+-auth-token$/.test(name));
            const token = key ? JSON.parse(localStorage.getItem(key) ?? 'null')?.access_token : null;
            const response = await fetch(`${api.origin}/rest/v1/rpc/create_room`, { method: 'POST',
              headers: { apikey: api.publicKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const rows = await response.json(); return { ok: response.ok, outcome: rows?.[0]?.outcome };
          }, { api, body: expectedBody! });
          await allArrived; expect(!interceptionFailed && held === 2 && forwarded === 0).toBe(true);
          clearTimeout(deadline); release(); const duplicateResult = await duplicateCall; await created;
          duplicate = duplicateResult.ok && ['created', 'already_created'].includes(duplicateResult.outcome ?? '');
          expect(forwarded === 2).toBe(true);
        } finally {
          clearTimeout(deadline); release(); await Promise.allSettled(duplicateCall ? [duplicateCall] : []); await page.unroute(endpoint, handler);
        }
        expect(duplicate).toBe(true);
      }
      if (mode !== 'overlap') {
        const created = page.waitForResponse(response => new URL(response.url()).pathname === '/rest/v1/rpc/create_room');
        await page.getByRole('button', { name: 'Retry create', exact: true }).click(); await created;
      }
      const rooms = await ownRooms(page, api), added = rooms.filter(room => !before.some(old => old.id === room.id));
      expect(!interceptionFailed && added.length === 1).toBe(true); const room = added[0], snapshot = committedRoomSnapshot(room);
      expect(snapshot.row.required_voter_count === configurations[index].requiredVoterCount &&
        snapshot.row.voter_count === Number(configurations[index].creatorIsVoter) && snapshot.members.length === 1 &&
        snapshot.members[0].is_voter === configurations[index].creatorIsVoter && (!committed || committed.row.id === snapshot.row.id)).toBe(true);
      await assertQr(diagnostics, new URL(`/room/${room.code}`, page.url()).href);
    };
    await createTrial(0, 'abort'); await createTrial(1, 'abort');
    await createTrial(2, 'loss'); await createTrial(3, 'loss');
    await createTrial(4, 'overlap'); await createTrial(5, 'overlap');
    expect((await ownRooms(page, api)).length === 6 && diagnostics.signupAttempts === membershipAnonymousBudget.G02).toBe(true);
    await diagnostics.record({ scenario: 'G02', outcome: 'six rooms: voting/non-voting pre-forward failure/retry, committed response loss/retry and overlapping same-request; one member/configuration each; identity1 recovery0' });
  });
});

test('@membership G03 three voting members assemble through link and code', async ({ diagnostics, browser, baseURL, viewport }, info) => {
  test.setTimeout(90000);
  await safeBody(diagnostics, () => withParticipants(browser, { baseURL, viewport }, info, 2, async ([middle, last]) => {
    const group = [diagnostics, middle, last];
    group.forEach(item => observeResolutionTraffic(item.page));
    const creatorTransport = await realtimeBarrier(diagnostics.page), middleTransport = await realtimeBarrier(middle.page);
    let stage = 'setup';
    try {
      const { api, room, invitation, participant } = await createWaiting(diagnostics.page, diagnostics, { requiredVoterCount: 3, creatorIsVoter: true });
      await creatorTransport.wait('readiness', 1); await creatorTransport.wait('reads', 1);
      for (const voter of [middle, last]) await startHost(voter.page, voter);
      const ids = [participant, await ownParticipant(middle.page), await ownParticipant(last.page)];
      await occupancy(diagnostics, 1);
      expect((await recoverOwnFilter(diagnostics.page, api, room)).outcome === 'not_ready').toBe(true);
      await admit(middle, room, invitation, 2); await occupancy(diagnostics, 2);
      await creatorTransport.wait('updates', 1); await middleTransport.wait('reads', 1);
      stage = 'waiting-reload';
      await reload(middle, room, false, true, 2, middleTransport);
      stage = 'waiting-disconnect';
      const before = committedRoomSnapshot(room);
      await middleTransport.disconnect();
      await expect(middle.page.getByText('Unable to synchronize this room. Please try again.', { exact: true })).toBeVisible();
      stable(room, before);
      const transportBefore = { ...middleTransport.stats };
      stage = 'final-admission';
      await admit(last, room, invitation, 3, true); await occupancy(diagnostics, 3); await occupancy(middle, 2);
      await creatorTransport.wait('updates', 2);
      expect(middleTransport.stats.readRequests === transportBefore.readRequests).toBe(true);
      stage = 'returning-voter';
      middleTransport.holdReadiness(); middleTransport.resume();
      await middleTransport.wait('readyHeld', transportBefore.readyHeld + 1);
      expect(middleTransport.stats.readRequests === transportBefore.readRequests).toBe(true);
      const completed = middleTransport.stats.reads, refetched = nextRoomRead(middle, room, 3);
      middleTransport.releaseReadiness(); await refetched; await middleTransport.wait('readRequests', transportBefore.readRequests + 1);
      await middleTransport.wait('reads', completed + 1);
      await occupancy(middle, 3);
      const ready = committedRoomSnapshot(room);
      expect(ready.row.state === 'ready' && ready.row.voter_count === 3 && ready.row.required_voter_count === 3 &&
        ready.row.movie_candidate_id === null && ready.members.length === 3 && ready.members.every(m => m.is_voter) &&
        creatorTransport.stats.updates === 2 && ready.row.filter_completed_count === 0).toBe(true);
      for (const d of group) await assertReady(d.page, d, room, false);
      stage = 'filters';
      const inputs = [[diagnostics, ['action'], 1900, 2000], [middle, ['comedy'], 2001, 2010],
        [last, [], 2011, 2026]] as const;
      for (let index = 0; index < inputs.length; index++) {
        const [voter, genres, from, to] = inputs[index];
        const result = await submitOwnFilter(voter.page, api, room, genres, from, to);
        expect(result.outcome === 'saved' && result.filter_completed_count === index + 1).toBe(true);
        await creatorTransport.wait('updates', 3 + index); await assertFilterProgress(diagnostics.page, room, index + 1);
        expect((await recoverOwnFilter(voter.page, api, room)).outcome === (index === 2 ? 'locked' : 'saved')).toBe(true);
      }
      for(const d of group)await assertResolutionView(d.page,'incompatible');
      expect((await assertStoredResolution(diagnostics.page,api,room,'incompatible')).filter_completed_count===3).toBe(true);
      const completedRoom = committedRoomSnapshot(room);
      expect(completedRoom.row.filter_completed_count === 3 && completedRoom.row.movie_candidate_id === null &&
        completedRoom.filters.length === 3 && JSON.stringify(completedRoom.members) === JSON.stringify(ready.members)).toBe(true);
      stage = 'ready-reloads';
      await reload(diagnostics, room, true, true, 3, creatorTransport); await reload(middle, room, false, true, 3, middleTransport);
      await assertFilterProgress(diagnostics.page, room, 3); await assertFilterProgress(middle.page, room, 3);
      await assertResolutionView(diagnostics.page,'incompatible');await assertResolutionView(middle.page,'incompatible');
      stage = 'ready-reconnect';
      await reconnect(middle, middleTransport); await assertFilterProgress(middle.page, room, 3);
      await assertResolutionView(middle.page,'incompatible');
      stage = 'reentry';
      for (let i = 0; i < group.length; i++) {
        await reenter(group[i], api, room, i === 0, true);
        expect(await ownParticipant(group[i].page) === ids[i]).toBe(true);
        expect((await recoverOwnFilter(group[i].page, api, room)).outcome === 'locked').toBe(true);
        await assertResolutionView(group[i].page,'incompatible');
        expect(observeCandidateRpcZero(group[i].page).count()).toBe(0);
      }
      expect(committedRoomSnapshot(room).row.movie_candidate_id === null).toBe(true);
      assertResolutionTrafficZero(group.map(item => item.page));
      expect(creatorTransport.stats.prematureReads === 0).toBe(true);
      expect(middleTransport.stats.prematureReads === 0).toBe(true);
      creatorTransport.assertHealthy(); middleTransport.assertHealthy();
      expect(group.reduce((n, d) => n + d.signupAttempts, 0) === membershipAnonymousBudget.G03).toBe(true);
      await diagnostics.record({ scenario: 'G03', outcome: 'voting creator link/code assembly; Ready progress0/3->1/3->2/3->3/3; stored incompatible status; own saved then locked recovery; reload/socket/re-entry convergence; candidate/TMDB requests/UI0; identities3' });
    } finally {
      try {
        const counts = (t: Transport) => `requests=${t.stats.readRequests},completed=${t.stats.reads},retired=${t.stats.retiredBodies},premature=${t.stats.prematureReads},readFailures=${t.stats.readFailures},frameFailures=${t.stats.frameFailures},bindings=${t.stats.readiness}`;
        await diagnostics.record({ scenario: 'G03', outcome: `stage=${stage}; creator ${counts(creatorTransport)}; voter ${counts(middleTransport)}` });
      } finally { await cleanup([creatorTransport, middleTransport]); }
    }
  }));
});

test('@membership G04 non-voting creator observes voter filter progress', async ({ diagnostics, browser, baseURL, viewport }, info) => {
  test.setTimeout(90000);
  await safeBody(diagnostics, () => withParticipants(browser, { baseURL, viewport }, info, 3, async voters => {
    const group = [diagnostics, ...voters];
    group.forEach(item => observeResolutionTraffic(item.page));
    const transport = await realtimeBarrier(diagnostics.page);
    try {
      const { api, room, invitation, participant } = await createWaiting(diagnostics.page, diagnostics, { requiredVoterCount: 3, creatorIsVoter: false });
      await transport.wait('readiness', 1); await transport.wait('reads', 1);
      for (const voter of voters) await startHost(voter.page, voter);
      const ids = [participant, ...await Promise.all(voters.map(d => ownParticipant(d.page)))];
      for (let count = 0; count < 3; count++) {
        await occupancy(diagnostics, count);
        await expect(diagnostics.page.getByText('You created this room and are not voting.', { exact: true })).toBeVisible();
        const before = committedRoomSnapshot(room);
        expect(before.members.length === count + 1 && before.row.voter_count === count &&
          before.members.find(m => m.user_id === participant)?.is_voter === false && before.row.movie_candidate_id === null).toBe(true);
        stable(room, before);
        await admit(voters[count], room, invitation, count + 1, count === 1);
        for (const d of group.slice(0, count + 2)) await occupancy(d, count + 1);
        await transport.wait('updates', count + 1);
      }
      const ready = committedRoomSnapshot(room);
      expect(ready.row.voter_count === 3 && ready.members.length === 4 && ready.row.movie_candidate_id === null &&
        ready.members.filter(m => m.is_voter).length === 3 && ready.members.find(m => m.user_id === participant)?.is_voter === false &&
        transport.stats.updates === 3 && ready.row.filter_completed_count === 0).toBe(true);
      for (const d of group) await assertReady(d.page, d, room, false);
      expect((await recoverOwnFilter(diagnostics.page, api, room)).outcome === 'not_voter').toBe(true);
      expect((await submitOwnFilter(diagnostics.page, api, room, ['action'], 1900, 2026)).outcome === 'not_voter').toBe(true);
      for (let index = 0; index < voters.length; index++) {
        const result = await submitOwnFilter(voters[index].page, api, room, index === 0 ? [] : ['drama'], 1900 + index, 2026);
        expect(result.outcome === 'saved' && result.filter_completed_count === index + 1).toBe(true);
        await transport.wait('updates', 4 + index); await assertFilterProgress(diagnostics.page, room, index + 1);
        await expect(diagnostics.page.getByRole('heading', { name: 'Choose your filters', exact: true })).toHaveCount(0);
        expect((await recoverOwnFilter(diagnostics.page, api, room)).outcome === 'not_voter').toBe(true);
      }
      for(const d of group)await assertResolutionView(d.page,'compatible');
      expect((await assertStoredResolution(diagnostics.page,api,room,'compatible')).filter_completed_count===3).toBe(true);
      await reconnect(diagnostics, transport);
      for (let i = 0; i < group.length; i++) {
        await reenter(group[i], api, room, i === 0, i !== 0);
        expect(await ownParticipant(group[i].page) === ids[i]).toBe(true);
        await assertResolutionView(group[i].page,'compatible');
        expect(observeCandidateRpcZero(group[i].page).count()).toBe(0);
      }
      const completed = committedRoomSnapshot(room);
      expect(completed.row.filter_completed_count === 3 && completed.row.movie_candidate_id === null && completed.filters.length === 3).toBe(true);
      assertResolutionTrafficZero(group.map(item => item.page));
      transport.assertHealthy();
      expect(group.reduce((n, d) => n + d.signupAttempts, 0) === membershipAnonymousBudget.G04).toBe(true);
      await diagnostics.record({ scenario: 'G04', outcome: 'non-voting creator observes aggregate-only0/3->1/3->2/3->3/3; stored compatible status; own recovery/submit not_voter; no private form/details; reconnect/re-entry stable; candidate/TMDB requests/UI0; identities4' });
    } finally { await cleanup([transport]); }
  }));
});

test('@membership G05 decoded QR admission is idempotent', async ({ diagnostics, browser, baseURL, viewport }, info) => {
  test.setTimeout(90000);
  await safeBody(diagnostics, () => withParticipants(browser, { baseURL, viewport }, info, 1, async ([voter]) => {
    const pages = [diagnostics.page, voter.page];
    pages.forEach(observeResolutionTraffic);
    const { api, room, invitation, participant } = await createWaiting(diagnostics.page, diagnostics, { requiredVoterCount: 3, creatorIsVoter: true });
    const decoded = await assertQr(diagnostics, invitation); await startHost(voter.page, voter);
    const voterId = await ownParticipant(voter.page), second = await voter.context.newPage();
    try {
      const calls = await overlappedJoins([voter.page, second], [voterId, voterId], api, room.code,
        [() => navigationJoin(voter.page, decoded), () => navigationJoin(second, decoded)]);
      expect(calls.every(call => call.ok) && calls.filter(call => call.row?.outcome === 'joined').length === 1 &&
        calls.filter(call => call.row?.outcome === 'already_member').length === 1).toBe(true);
      const after = committedRoomSnapshot(room);
      expect(after.row.voter_count === 2 && after.row.state === 'waiting' && after.members.length === 2 &&
        after.row.filter_resolution_status==='pending' &&
        after.members.some(member => member.user_id === participant) && after.members.some(member => member.user_id === voterId)).toBe(true);
      await occupancy(voter, 2); expect(await assertQr(voter, invitation) === decoded).toBe(true);
      expect((await navigationJoin(voter.page, invitation)).row?.outcome === 'already_member').toBe(true);
      for (const code of [room.code.toLowerCase(), ` ${room.code} `]) expect((await directJoin(voter.page, api, code)).row?.outcome === 'already_member').toBe(true);
      stable(room, after);expect((await assertStoredResolution(voter.page,api,room,'pending')).voter_count===2).toBe(true);
      assertResolutionTrafficZero(pages);
      expect(diagnostics.signupAttempts + voter.signupAttempts === membershipAnonymousBudget.G05).toBe(true);
      await diagnostics.record({ scenario: 'G05', outcome: 'actual independently decoded QR navigation; two held same-session page joins forwarded together; joined/already_member; one membership/increment; link/code re-entry stable; identities2' });
    } finally { await second.close(); }
  }));
});

test('@membership G06 non-voting creator and concurrent voters', async ({ diagnostics, browser, baseURL, viewport }, info) => {
  test.setTimeout(90000);
  await safeBody(diagnostics, () => withParticipants(browser, { baseURL, viewport }, info, 3, async voters => {
    const transport = await realtimeBarrier(diagnostics.page);
    try {
      const { api, room, invitation, participant } = await createWaiting(diagnostics.page, diagnostics, { requiredVoterCount: 3, creatorIsVoter: false });
      await transport.wait('readiness', 1); await transport.wait('reads', 1);
      const decoded = await assertQr(diagnostics, invitation);
      expect((await navigationJoin(diagnostics.page, decoded)).row?.outcome === 'already_member').toBe(true);
      expect((await directJoin(diagnostics.page, api, ` ${room.code.toLowerCase()} `)).row?.outcome === 'already_member').toBe(true);
      const empty = committedRoomSnapshot(room);
      expect(empty.row.voter_count === 0 && empty.members.length === 1 && empty.members[0].user_id === participant && !empty.members[0].is_voter).toBe(true);
      for (const voter of voters) await startHost(voter.page, voter);
      const voterIds = await Promise.all(voters.map(voter => ownParticipant(voter.page)));
      const outcomes = await overlappedJoins(voters.map(voter => voter.page), voterIds, api, room.code);
      expect(outcomes.every(result => result.ok && result.row?.outcome === 'joined')).toBe(true);
      const assembled = committedRoomSnapshot(room);
      expect(assembled.row.voter_count === 3 && assembled.row.state === 'ready' && assembled.members.length === 4 &&
        assembled.members.find(member => member.user_id === participant)?.is_voter === false && assembled.members.filter(member => member.is_voter).length === 3).toBe(true);
      for (const voter of voters) {
        expect((await voter.page.goto(invitation))?.status() === 200).toBe(true);
        await assertReady(voter.page, voter, room);
      }
      await assertReady(diagnostics.page, diagnostics, room);
      const recovered = committedRoomSnapshot(room), decodedReady = await assertQr(diagnostics, invitation);
      expect((await navigationJoin(diagnostics.page, decodedReady)).row?.outcome === 'already_member').toBe(true);
      expect((await navigationJoin(diagnostics.page, invitation)).row?.outcome === 'already_member').toBe(true);
      expect((await directJoin(diagnostics.page, api, room.code.toLowerCase())).row?.outcome === 'already_member').toBe(true);
      await reload(diagnostics, room, true, false, 3, transport); await reconnect(diagnostics, transport);
      stable(room, recovered); transport.assertHealthy();
      expect([diagnostics, ...voters].reduce((n, d) => n + d.signupAttempts, 0) === membershipAnonymousBudget.G06).toBe(true);
      await diagnostics.record({ scenario: 'G06', outcome: 'creator QR/code re-entry remains non-voting at0/3; three distinct held subjects forwarded together and admitted; Ready3/3; creator QR/link/code/reload/Realtime recovery stable; identities4' });
    } finally { await transport.close(); }
  }));
});

test('@membership G07 final slot capacity competition', async ({ diagnostics, browser, baseURL, viewport }, info) => {
  test.setTimeout(90000);
  await safeBody(diagnostics, () => withParticipants(browser, { baseURL, viewport }, info, 3, async ([prior, a, b]) => {
    const group = [diagnostics, prior, a, b], transport = await realtimeBarrier(diagnostics.page);
    try {
      const { api, room, invitation, participant } = await createWaiting(diagnostics.page, diagnostics, { requiredVoterCount: 3, creatorIsVoter: true });
      await transport.wait('readiness', 1); await transport.wait('reads', 1);
      const decoded = await assertQr(diagnostics, invitation); for (const d of [prior, a, b]) await startHost(d.page, d);
      const ids = [participant, ...await Promise.all([prior, a, b].map(d => ownParticipant(d.page)))];
      expect((await directJoin(prior.page, api, room.code)).row?.outcome === 'joined').toBe(true);
      await transport.wait('updates', 1);
      const before = committedRoomSnapshot(room); expect(before.row.voter_count === 2 && before.row.movie_candidate_id === null).toBe(true);
      transport.holdUpdates(); const updateHeld = transport.stats.updateHeld;
      const results = await overlappedJoins([a.page, b.page], [ids[2], ids[3]], api, room.code);
      expect(results.filter(result => result.row?.outcome === 'joined').length === 1 && results.filter(result => isStrictFull(result.row)).length === 1).toBe(true);
      await transport.wait('updateHeld', updateHeld + 1);
      const winner = results[0].row.outcome === 'joined' ? a : b, loser = winner === a ? b : a;
      const assembled = committedRoomSnapshot(room);
      expect(assembled.row.voter_count === 3 && assembled.row.state === 'ready' && assembled.row.movie_candidate_id === null &&
        assembled.members.length === 3 && assembled.xmin !== before.xmin && transport.stats.updateHeld === updateHeld + 1).toBe(true);
      for (const target of [decoded, invitation]) expect(isStrictFull((await navigationJoin(loser.page, target)).row)).toBe(true);
      expect(isStrictFull((await directJoin(loser.page, api, ` ${room.code.toLowerCase()} `)).row)).toBe(true);
      for (const [d, code] of [[winner, room.code], [prior, room.code.toLowerCase()], [diagnostics, ` ${room.code} `]] as const)
        expect((await directJoin(d.page, api, code)).row?.outcome === 'already_member').toBe(true);
      expect(transport.stats.updateHeld === updateHeld + 1).toBe(true);
      transport.releaseUpdates();
      for (const d of [winner, prior, diagnostics]) {
        expect((await navigationJoin(d.page, decoded)).row?.outcome === 'already_member').toBe(true);
        expect((await navigationJoin(d.page, invitation)).row?.outcome === 'already_member').toBe(true);
        await assertReady(d.page, d, room);
      }
      const recovered = committedRoomSnapshot(room);
      expect(recovered.row.voter_count === assembled.row.voter_count && recovered.row.required_voter_count === assembled.row.required_voter_count &&
        recovered.row.creation_request_id === assembled.row.creation_request_id && recovered.row.movie_candidate_id === null &&
        JSON.stringify(recovered.members) === JSON.stringify(assembled.members) && group.every(d => observeCandidateRpcZero(d.page).count() === 0)).toBe(true);
      expect(group.reduce((n, d) => n + d.signupAttempts, 0) === membershipAnonymousBudget.G07).toBe(true);
      await diagnostics.record({ scenario: 'G07', outcome: 'two held final-slot subjects forwarded together; joined/strict-null full; exactly one membership Realtime UPDATE; loser QR/link/code remains full; existing members recover; candidate requests/UI0; identities4' });
    } finally { await cleanup([transport]); }
  }));
});

test('@membership G08 authorization and room isolation', async ({ diagnostics, browser, baseURL, viewport }, info) => {
  test.setTimeout(90000);
  await safeBody(diagnostics, () => withParticipants(browser, { baseURL, viewport }, info, 3, async ([v1, v2, outsider]) => {
    const pages = [diagnostics.page, v1.page, v2.page, outsider.page];
    pages.forEach(observeResolutionTraffic);
    const { api, room, invitation } = await createWaiting(diagnostics.page, diagnostics, { requiredVoterCount: 3, creatorIsVoter: true });
    for (const d of [v1, v2]) await startHost(d.page, d);
    await directJoin(v1.page, api, room.code); await directJoin(v2.page, api, room.code); await assertReady(diagnostics.page, diagnostics, room);
    const roomA = committedRoomSnapshot(room);
    const roomB = await createWaiting(outsider.page, outsider, { requiredVoterCount: 2, creatorIsVoter: false });
    const denied = await outsider.page.evaluate(async ({ api, room, own }) => {
      const key = Object.keys(localStorage).find(name => /^sb-.+-auth-token$/.test(name)); const token = key ? JSON.parse(localStorage.getItem(key) ?? 'null')?.access_token : null;
      const headers = { apikey: api.publicKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      const requests = [
        fetch(`${api.origin}/rest/v1/rooms?select=id,code,state,voter_count,required_voter_count,filter_completed_count,filter_resolution_status&id=eq.${room.id}`, { headers }),
        fetch(`${api.origin}/rest/v1/rooms?select=id,code,state,voter_count,required_voter_count,filter_completed_count,filter_resolution_status&code=eq.${room.code}`, { headers }),
        fetch(`${api.origin}/rest/v1/rooms?select=id,code,state,voter_count,required_voter_count,filter_completed_count,filter_resolution_status&id=eq.${own.id}`, { headers }),
        fetch(`${api.origin}/rest/v1/rooms?select=id,code,state,voter_count,required_voter_count,filter_completed_count,filter_resolution_status&code=eq.${own.code}`, { headers }),
        fetch(`${api.origin}/rest/v1/room_members?select=*`, { headers }), fetch(`${api.origin}/rest/v1/participant_filters?select=*`, { headers }),
        fetch(`${api.origin}/rest/v1/rooms?id=eq.${room.id}`, { method: 'PATCH', headers, body: JSON.stringify({ required_voter_count: 9, voter_count: 9, movie_candidate_id: 'fixture-clockwork-orchard' }) }),
        fetch(`${api.origin}/rest/v1/room_members`, { method: 'POST', headers, body: JSON.stringify({ room_id: room.id, user_id: own.id, is_voter: true }) }),
        fetch(`${api.origin}/rest/v1/participant_filters`, { method: 'POST', headers,
          body: JSON.stringify({ room_member_id: own.id, genres: ['action'], release_year_from: 1900, release_year_to: 2026 }) }),
        fetch(`${api.origin}/rest/v1/rpc/get_my_participant_filter`, { method: 'POST', headers, body: JSON.stringify({ p_room_id: room.id }) }),
        fetch(`${api.origin}/rest/v1/rpc/submit_my_participant_filter`, { method: 'POST', headers,
          body: JSON.stringify({ p_room_id: room.id, p_genres: ['action'], p_release_year_from: 1900, p_release_year_to: 2026 }) }),
        fetch(`${api.origin}/rest/v1/rpc/resolve_common_filters`, { method: 'POST', headers,
          body: JSON.stringify({ p_room_id: room.id }) }),
      ];
      const [foreignId, foreignCode, ownId, ownCode, members, filters, roomMutation, memberMutation, filterMutation, recovery, submission, resolution] = await Promise.all(requests);
      return {
        foreignId: await foreignId.json(), foreignCode: await foreignCode.json(), ownId: await ownId.json(), ownCode: await ownCode.json(),
        membersOk: members.ok, filtersOk: filters.ok, roomMutationOk: roomMutation.ok,
        memberMutationOk: memberMutation.ok, filterMutationOk: filterMutation.ok,
        recoveryOk: recovery.ok, recovery: (await recovery.json())?.[0], submissionOk: submission.ok, submission: (await submission.json())?.[0],
        resolutionOk:resolution.ok,resolution:(await resolution.json())?.[0],
      };
    }, { api, room, own: roomB.room });
    expect(Array.isArray(denied.foreignId) && denied.foreignId.length === 0 && Array.isArray(denied.foreignCode) && denied.foreignCode.length === 0 &&
      denied.ownId?.length === 1 && denied.ownCode?.length === 1 && !denied.membersOk && !denied.filtersOk &&
      !denied.roomMutationOk && !denied.memberMutationOk && !denied.filterMutationOk && denied.recoveryOk && denied.submissionOk &&
      denied.recovery?.outcome === 'not_found' && denied.submission?.outcome === 'not_found' &&
      denied.resolutionOk&&denied.resolution?.outcome==='not_found'&&denied.resolution?.filter_resolution_status===null&&
      ['genres', 'release_year_from', 'release_year_to', 'filter_completed_count', 'required_voter_count', 'allowed_release_year_max']
        .every(key => denied.recovery[key] === null && denied.submission[key] === null)).toBe(true);
    expect(isStrictFull((await directJoin(outsider.page, api, room.code)).row)).toBe(true);
    stable(room, roomA); expect(roomA.row.filter_resolution_status==='pending'&&
      committedRoomSnapshot(roomB.room).row.voter_count === 0&&
      committedRoomSnapshot(roomB.room).row.filter_resolution_status==='pending').toBe(true);
    expect(await outsider.page.evaluate(values => values.every(value => !document.body.innerText.includes(value)), roomA.members.map(m => m.user_id))).toBe(true);
    assertResolutionTrafficZero(pages);
    expect([diagnostics, v1, v2, outsider].reduce((n, d) => n + d.signupAttempts, 0) === membershipAnonymousBudget.G08).toBe(true);
    await diagnostics.record({ scenario: 'G08', outcome: 'ordinary JWT own room access; foreign room/filter recovery/submit hidden; full join strict-null; roster/filter browse and room/member/filter mutation denied; owner snapshots stable; candidate requests/UI0; identities4' });
  }));
});

test('@membership G09 join failures and committed response loss', async ({ diagnostics, browser, baseURL, viewport }, info) => {
  test.setTimeout(90000);
  await safeBody(diagnostics, () => withParticipants(browser, { baseURL, viewport }, info, 2, async ([joiner, competitor]) => {
    const first = await createWaiting(diagnostics.page, diagnostics); const api = first.api;
    for (const d of [joiner, competitor]) await startHost(d.page, d);
    const abort = async (route: Route) => route.abort('failed');
    await joiner.page.route('**/rest/v1/rpc/join_room', abort, { times: 1 });
    expect((await joiner.page.goto(first.invitation))?.status() === 200).toBe(true);
    await expect(joiner.page.getByText('Unable to open this room. Please try again.', { exact: true })).toBeVisible();
    expect(committedRoomSnapshot(first.room).row.voter_count === 1).toBe(true);
    const firstRetry = joinResponse(joiner);
    await joiner.page.getByRole('button', { name: 'Retry room', exact: true }).click();
    await assertAccepted(await firstRetry, first.room, 'joined', member, 'ready', 2); await assertReady(joiner.page, joiner, first.room);

    const second = await createWaitingWithSession(diagnostics.page, diagnostics, api, committedRoomSnapshot(first.room));
    await joiner.page.goto('/'); await joiner.page.route('**/rest/v1/rpc/join_room', abort, { times: 1 });
    await joiner.page.goto(second.invitation); await expect(joiner.page.getByText('Unable to open this room. Please try again.', { exact: true })).toBeVisible();
    expect((await directJoin(competitor.page, api, second.room.code)).row?.outcome === 'joined').toBe(true);
    const fullRetry = joinResponse(joiner);
    await joiner.page.getByRole('button', { name: 'Retry room', exact: true }).click();
    const fullRows = await (await fullRetry).json() as Record<string, unknown>[]; expect(isStrictFull(fullRows?.[0])).toBe(true);
    await expect(joiner.page.getByText('Room Full. The voting group is already assembled.', { exact: true })).toBeVisible();

    const third = await createWaitingWithSession(diagnostics.page, diagnostics, api, committedRoomSnapshot(second.room));
    await joiner.page.goto('/'); let committed = false, interceptionFailed = false, releaseLoss!: () => void, observed!: () => void;
    const lossGate = new Promise<void>(resolve => { releaseLoss = resolve; });
    const upstream = new Promise<void>(resolve => { observed = resolve; });
    const lossDeadline = setTimeout(() => { interceptionFailed = true; observed(); releaseLoss(); }, 10000);
    const lose = async (route: Route) => {
      let response: Awaited<ReturnType<Route['fetch']>> | undefined;
      try {
        response = await route.fetch({ maxRetries: 0, maxRedirects: 0, timeout: 15000 });
        const rows = await response.json() as Record<string, unknown>[], row = rows?.[0];
        committed = response.ok() && row?.outcome === 'joined' && row.room_id === third.room.id && row.voter_count === 2;
        observed(); await lossGate; await route.abort('failed');
      } catch { interceptionFailed = true; observed(); releaseLoss(); await route.abort('failed').catch(() => {}); }
      finally { await response?.dispose().catch(() => {}); }
    };
    await joiner.page.route('**/rest/v1/rpc/join_room', lose, { times: 1 });
    const navigation = joiner.page.goto(third.invitation);
    try {
      await upstream; clearTimeout(lossDeadline);
      const afterCommit = committedRoomSnapshot(third.room);
      expect(committed && !interceptionFailed && afterCommit.row.voter_count === 2 && afterCommit.members.length === 2).toBe(true);
      releaseLoss(); await navigation;
      await expect(joiner.page.getByText('Unable to open this room. Please try again.', { exact: true })).toBeVisible();
      const committedRetry = joinResponse(joiner);
      await joiner.page.getByRole('button', { name: 'Retry room', exact: true }).click();
      await assertAccepted(await committedRetry, third.room, 'already_member', member, 'ready', 2); await assertReady(joiner.page, joiner, third.room);
      const recovered = committedRoomSnapshot(third.room);
      expect(recovered.row.required_voter_count === afterCommit.row.required_voter_count && recovered.row.voter_count === afterCommit.row.voter_count &&
        recovered.row.creation_request_id === afterCommit.row.creation_request_id && JSON.stringify(recovered.members) === JSON.stringify(afterCommit.members)).toBe(true);
    } finally { clearTimeout(lossDeadline); releaseLoss(); }
    expect([diagnostics, joiner, competitor].reduce((n, d) => n + d.signupAttempts, 0) === membershipAnonymousBudget.G09).toBe(true);
    await diagnostics.record({ scenario: 'G09', outcome: 'pre-forward abort/retry joined; abort then competitor fill/retry full; route.fetch commit then response loss/retry already_member; three identities' });
  }));
});
