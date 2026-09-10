import { expect } from '@playwright/test';
import { test, safeBody, type SafeDiagnostics } from './support/safe-diagnostics';
import { createWaiting, startHost, ownParticipant, withParticipants, realtimeBarrier, assertAccepted,
  assertReady, committedRoomSnapshot, type RoomProjection, type PublicApi } from './support/room-harness';
import { candidateHarness, firstCandidate } from './support/candidate-harness';

export const membershipAnonymousBudget = Object.freeze({ G03: 3, G04: 4 });
type Transport = Awaited<ReturnType<typeof realtimeBarrier>>;
type Candidates = Awaited<ReturnType<typeof candidateHarness>>;
const member = { isCreator: false, isVoter: true };
const joinResponse = (d: SafeDiagnostics) => d.page.waitForResponse(r => new URL(r.url()).pathname === '/rest/v1/rpc/join_room');

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
async function displays(c: Candidates, size: number) {
  const sources: string[] = [];
  for (let i = 0; i < size; i++) sources.push(await c.assertDisplay(i));
  expect(new Set(sources).size === 1).toBe(true); return sources[0];
}
async function nextRoomRead(d: SafeDiagnostics, room: RoomProjection, count: number) {
  const request = await d.page.waitForRequest(request => {
    const url = new URL(request.url());
    return url.pathname === '/rest/v1/rooms' && url.searchParams.get('id') === `eq.${room.id}` &&
      url.searchParams.get('select')?.replaceAll(' ', '') === 'id,code,state,voter_count,required_voter_count';
  });
  const response = await request.response();
  expect(response?.ok() === true && await response.finished() === null).toBe(true);
  const rows = await response!.json();
  expect(Array.isArray(rows) && rows.length === 1 &&
    Object.keys(rows[0]).sort().join(',') === 'code,id,required_voter_count,state,voter_count' &&
    rows[0].id === room.id && rows[0].code === room.code && rows[0].voter_count === count &&
    rows[0].required_voter_count === 3 && rows[0].state === (count === 3 ? 'ready' : 'waiting')).toBe(true);
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
        Object.keys(row).sort().join(',') === 'is_creator,is_voter,outcome,required_voter_count,room_code,room_id,room_state,voter_count' &&
        row.outcome === 'already_member' && row.room_id === room.id && row.room_code === room.code && row.room_state === 'ready' &&
        row.is_creator === creator && row.is_voter === votes && row.voter_count === 3 && row.required_voter_count === 3;
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
async function cleanup(c: Candidates, transports: Transport[]) {
  const results = await Promise.allSettled([c.close(), ...transports.map(t => t.close())]);
  if (results.some(r => r.status === 'rejected')) throw new Error('E2E_SAFE_FAILURE');
}

test('@membership G03 three voting members assemble through link and code', async ({ diagnostics, browser, baseURL, viewport }, info) => {
  test.setTimeout(90000);
  await safeBody(diagnostics, () => withParticipants(browser, { baseURL, viewport }, info, 2, async ([middle, last]) => {
    const group = [diagnostics, middle, last], c = await candidateHarness(group, baseURL!);
    c.limitAutomatic([2, 2, 1]);
    const creatorTransport = await realtimeBarrier(diagnostics.page), middleTransport = await realtimeBarrier(middle.page);
    let stage = 'setup';
    try {
      const { api, room, invitation, participant } = await createWaiting(diagnostics.page, diagnostics, { requiredVoterCount: 3, creatorIsVoter: true });
      await creatorTransport.wait('readiness', 1); await creatorTransport.wait('reads', 1);
      for (const voter of [middle, last]) await startHost(voter.page, voter);
      const ids = [participant, await ownParticipant(middle.page), await ownParticipant(last.page)];
      c.bind(room, ids, api); await occupancy(diagnostics, 1);
      await c.probe(0, 'not_ready');
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
      expect(c.stats.every(s => s.automatic === 0)).toBe(true);
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
      await occupancy(middle, 3); await c.held();
      const ready = committedRoomSnapshot(room);
      expect(ready.row.state === 'ready' && ready.row.voter_count === 3 && ready.row.required_voter_count === 3 &&
        ready.row.movie_candidate_id === null && ready.members.length === 3 && ready.members.every(m => m.is_voter) &&
        creatorTransport.stats.updates === 2 && c.stats.every(s => s.held === 1 && s.forwarded === 0)).toBe(true);
      for (const d of group) await assertReady(d.page, d, room, false);
      stage = 'first-candidate';
      c.release(); await c.available(); const source = await displays(c, 3);
      await creatorTransport.wait('updates', 3);
      const assigned = committedRoomSnapshot(room);
      expect(assigned.row.movie_candidate_id === firstCandidate.candidate_id && assigned.xmin !== ready.xmin &&
        JSON.stringify(assigned.members) === JSON.stringify(ready.members)).toBe(true);
      stage = 'ready-reloads';
      await reload(diagnostics, room, true, true, 3, creatorTransport); await reload(middle, room, false, true, 3, middleTransport);
      await c.available([2, 2, 1]);
      await displays(c, 3); stable(room, assigned);
      stage = 'ready-reconnect';
      await reconnect(middle, middleTransport); expect(await displays(c, 3) === source).toBe(true);
      stage = 'reentry';
      for (let i = 0; i < group.length; i++) {
        await reenter(group[i], api, room, i === 0, true); await c.probe(i, 'available', true);
        expect(await ownParticipant(group[i].page) === ids[i]).toBe(true);
      }
      stable(room, assigned); await c.assertHealthy([2, 2, 1]);
      expect(creatorTransport.stats.prematureReads === 0).toBe(true);
      expect(middleTransport.stats.prematureReads === 0).toBe(true);
      creatorTransport.assertHealthy(); middleTransport.assertHealthy();
      expect(group.reduce((n, d) => n + d.signupAttempts, 0) === membershipAnonymousBudget.G03).toBe(true);
      await diagnostics.record({ scenario: 'G03', outcome: '1/3 -> link2/3 -> manual3/3; real Waiting reload/socket outage/system recovery; held3 forwarded0; membership UPDATE2 then assignment UPDATE1; same three visible local posters; recovery/re-entry xmin stable; automatic2/2/1; identities3 recovery0' });
    } finally {
      try {
        const counts = (t: Transport) => `requests=${t.stats.readRequests},completed=${t.stats.reads},retired=${t.stats.retiredBodies},premature=${t.stats.prematureReads},readFailures=${t.stats.readFailures},frameFailures=${t.stats.frameFailures},bindings=${t.stats.readiness}`;
        await diagnostics.record({ scenario: 'G03', outcome: `stage=${stage}; creator ${counts(creatorTransport)}; voter ${counts(middleTransport)}` });
      } finally { await cleanup(c, [creatorTransport, middleTransport]); }
    }
  }));
});

test('@membership G04 non-voting creator observes three voters and stable candidate recovery', async ({ diagnostics, browser, baseURL, viewport }, info) => {
  test.setTimeout(90000);
  await safeBody(diagnostics, () => withParticipants(browser, { baseURL, viewport }, info, 3, async voters => {
    const group = [diagnostics, ...voters], c = await candidateHarness(group, baseURL!);
    c.limitAutomatic([3, 2, 1, 1]);
    const transport = await realtimeBarrier(diagnostics.page);
    try {
      const { api, room, invitation, participant } = await createWaiting(diagnostics.page, diagnostics, { requiredVoterCount: 3, creatorIsVoter: false });
      await transport.wait('readiness', 1); await transport.wait('reads', 1);
      for (const voter of voters) await startHost(voter.page, voter);
      const ids = [participant, ...await Promise.all(voters.map(d => ownParticipant(d.page)))]; c.bind(room, ids, api);
      for (let count = 0; count < 3; count++) {
        await occupancy(diagnostics, count);
        await expect(diagnostics.page.getByText('You created this room and are not voting.', { exact: true })).toBeVisible();
        const before = committedRoomSnapshot(room);
        expect(before.members.length === count + 1 && before.row.voter_count === count &&
          before.members.find(m => m.user_id === participant)?.is_voter === false && before.row.movie_candidate_id === null).toBe(true);
        await c.probe(0, 'not_ready'); stable(room, before);
        expect(c.stats.every(s => s.automatic === 0)).toBe(true);
        await admit(voters[count], room, invitation, count + 1, count === 1);
        for (const d of group.slice(0, count + 2)) await occupancy(d, count + 1);
        await transport.wait('updates', count + 1);
      }
      await c.held(); const ready = committedRoomSnapshot(room);
      expect(ready.row.voter_count === 3 && ready.members.length === 4 && ready.row.movie_candidate_id === null &&
        ready.members.filter(m => m.is_voter).length === 3 && ready.members.find(m => m.user_id === participant)?.is_voter === false &&
        transport.stats.updates === 3 && c.stats.every(s => s.held === 1 && s.forwarded === 0)).toBe(true);
      for (const d of group) await assertReady(d.page, d, room, false);
      c.release(); await c.available(); const source = await displays(c, 4);
      await transport.wait('updates', 4); const assigned = committedRoomSnapshot(room);
      expect(assigned.xmin !== ready.xmin && assigned.row.movie_candidate_id === firstCandidate.candidate_id &&
        JSON.stringify(assigned.members) === JSON.stringify(ready.members)).toBe(true);
      // A fresh acquisition after previously successful display fails before forwarding.
      // Persisted assignment and the creator's non-voting membership survive it.
      c.arm(['abort', null, null, null]); await reload(diagnostics, room, true, false, 3);
      await c.held(); c.release();
      await expect(diagnostics.page.getByTestId('candidate-status')).toHaveText('Unable to load this movie. Please try again.');
      await expect(diagnostics.page.getByRole('button', { name: 'Retry candidate', exact: true })).toBeVisible();
      await occupancy(diagnostics, 3); stable(room, assigned);
      await diagnostics.page.getByRole('button', { name: 'Retry candidate', exact: true }).click();
      await c.available([2, 1, 1, 1]); expect(await c.assertDisplay(0) === source).toBe(true); stable(room, assigned);
      // Arm the exact already-resolved bundled image BEFORE this voter's real reload.
      const fault = await c.failPosterOnce(1, source, true);
      await reload(voters[0], room, false, true, 3); await c.available([2, 2, 1, 1]);
      await expect(voters[0].page.getByTestId('candidate-status')).toHaveText('Unable to load this movie. Please try again.');
      await expect(voters[0].page.getByTestId('candidate-title')).toHaveText(firstCandidate.title);
      await expect(voters[0].page.getByTestId('candidate-year')).toHaveText('2020');
      expect(fault.failed === 1 && fault.retried === 0).toBe(true); stable(room, assigned);
      const calls = c.stats.map(s => s.automatic), auth = c.stats.map(s => s.auth);
      await voters[0].page.getByRole('button', { name: 'Retry candidate', exact: true }).click();
      expect(await c.assertDisplay(1) === source && fault.failed === 1 && fault.retried >= 1 &&
        c.stats.every((s, i) => s.automatic === calls[i] && s.auth === auth[i])).toBe(true);
      await transport.wait('readiness', 2); await reconnect(diagnostics, transport);
      for (let i = 0; i < group.length; i++) {
        await reenter(group[i], api, room, i === 0, i !== 0); await c.probe(i, 'available');
        expect(await ownParticipant(group[i].page) === ids[i]).toBe(true);
      }
      expect(await displays(c, 4) === source).toBe(true); stable(room, assigned);
      await c.assertHealthy([3, 2, 1, 1]); transport.assertHealthy();
      expect(group.reduce((n, d) => n + d.signupAttempts, 0) === membershipAnonymousBudget.G04).toBe(true);
      await diagnostics.record({ scenario: 'G04', outcome: 'non-voting creator0/3 ->1/3 ->2/3 ->3/3; automatic Waiting0/probes not_ready; held4 forwarded0; admission UPDATE3 assignment UPDATE1; four same local posters; acquisition failure/retry after success; exact poster fault before reload/retry RPC0 Auth0; stable members/FK/xmin; identities4 recovery0' });
    } finally { await cleanup(c, [transport]); }
  }));
});
