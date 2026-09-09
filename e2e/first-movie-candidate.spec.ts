import { randomUUID } from 'node:crypto';
import { expect } from '@playwright/test';
import { test, safeBody, type SafeDiagnostics } from './support/safe-diagnostics';
import { createWaiting, startHost, ownParticipant, withParticipants, realtimeBarrier, assertAccepted,
  assertReady, committedRoomSnapshot, createWaitingWithSession, type RoomProjection, type PublicApi } from './support/room-harness';
import { candidateHarness, firstCandidate } from './support/candidate-harness';

export const candidateAnonymousBudget = Object.freeze({ F01: 2, F02: 2, F03: 2, F04: 4, F05: 2, F06: 2, F07: 2, F08: 2 });

test('@candidate F01 Waiting to shared automatic candidate and stable repeated access', async ({ page, diagnostics, browser, baseURL, viewport }, info) => {
  await safeBody(diagnostics, async () => {
    await withParticipants(browser, { baseURL, viewport }, info, 1, async ([guest]) => {
      // Both context-owned credential observers and network guards precede navigation.
      const candidates = await candidateHarness([diagnostics, guest], baseURL!);
      const transport = await realtimeBarrier(page);
      try {
        const { api, room, invitation, participant } = await createWaiting(page, diagnostics);
        await transport.wait('readiness', 1); await transport.wait('reads', 1);
        await startHost(guest.page, guest);
        const guestId = await ownParticipant(guest.page);
        candidates.bind(room, [participant, guestId], api);
        const waiting = committedRoomSnapshot(room);
        expect(waiting.row.state === 'waiting' && waiting.row.guest_user_id === null && waiting.row.movie_candidate_id === null).toBe(true);
        await expect(page.getByTestId('candidate-card')).toHaveCount(0);
        await expect(page.getByTestId('candidate-status')).toHaveCount(0);
        expect(candidates.stats.every(value => value.automatic === 0 && value.probes === 0)).toBe(true);
        await candidates.probe(0, 'not_ready'); // Separate from automatic Waiting acquisition (zero).
        expect(JSON.stringify(committedRoomSnapshot(room)) === JSON.stringify(waiting)).toBe(true);
        expect(candidates.stats.every(value => value.automatic === 0)).toBe(true);

        const joined = guest.page.waitForResponse(response => response.url().endsWith('/rpc/join_room'));
        expect((await guest.page.goto(invitation))?.status() === 200).toBe(true);
        await assertAccepted(await joined, room, 'joined', 'guest', 'ready');
        await candidates.held(); // Two distinct authenticated callers, zero forwarded.
        await transport.wait('updates', 1); await transport.wait('reads', 2);
        await assertReady(page, diagnostics, room, false);
        await assertReady(guest.page, guest, room, false);
        for (const caller of [diagnostics, guest]) {
          await expect(caller.page.getByTestId('candidate-status')).toHaveText('Loading movie…');
          await expect(caller.page.getByTestId('candidate-title')).toHaveCount(0);
        }
        const ready = committedRoomSnapshot(room);
        expect(ready.row.state === 'ready' && ready.row.movie_candidate_id === null &&
          ready.row.host_user_id === participant && ready.row.guest_user_id === guestId && transport.stats.updates === 1).toBe(true);
        // Delay only delivery of the REAL assignment invalidation until the card
        // succeeds. No fabricated Realtime event or application state injection.
        transport.holdUpdates();
        candidates.release();
        await candidates.available();
        const hostPoster = await candidates.assertDisplay(0), guestPoster = await candidates.assertDisplay(1);
        expect(hostPoster === guestPoster).toBe(true);
        await transport.wait('updateHeld', 1);
        const assigned = committedRoomSnapshot(room);
        expect(assigned.row.movie_candidate_id === firstCandidate.candidate_id && assigned.xmin !== ready.xmin &&
          assigned.row.host_user_id === participant && assigned.row.guest_user_id === guestId && assigned.row.state === 'ready' &&
          assigned.row.code === waiting.row.code && assigned.row.creation_request_id === waiting.row.creation_request_id &&
          assigned.row.created_at === waiting.row.created_at && transport.stats.updates === 2).toBe(true);
        const reads = transport.stats.reads;
        transport.releaseUpdates();
        await transport.wait('reads', reads + 1);
        await candidates.assertDisplay(0); await candidates.assertDisplay(1);
        expect(candidates.stats.every(value => value.automatic === 1 && value.forwarded === 1)).toBe(true);
        expect(JSON.stringify(committedRoomSnapshot(room)) === JSON.stringify(assigned)).toBe(true);

        await candidates.probe(0, 'available'); await candidates.probe(1, 'available');
        await Promise.all([candidates.probe(0, 'available', true), candidates.probe(1, 'available', true)]);
        expect(JSON.stringify(committedRoomSnapshot(room)) === JSON.stringify(assigned)).toBe(true);
        expect(candidates.stats[0].probes === 4 && candidates.stats[1].probes === 3 &&
          candidates.stats.every(value => value.automatic === 1) && transport.stats.updates === 2).toBe(true);
        expect(await candidates.assertDisplay(0) === hostPoster && await candidates.assertDisplay(1) === guestPoster).toBe(true);
        expect((await ownParticipant(page)) === participant && (await ownParticipant(guest.page)) === guestId &&
          diagnostics.signupAttempts + guest.signupAttempts === candidateAnonymousBudget.F01).toBe(true);
        await candidates.assertHealthy(); transport.assertHealthy();
        await diagnostics.record({ scenario: 'F01', outcome: 'Waiting automatic=0; own not_ready; authenticated first requests held=2 forwarded=0 then released=2; matching available and loaded local PNG; membership UPDATE=1 assignment UPDATE=1; unchanged repeat xmin; automatic=1/1 probes=4/3; external=0; signups=2' });
      } finally {
        try { await candidates.close(); } finally { await transport.close(); }
      }
    });
  });
});

// Every scenario owns its contexts. Recovery helpers neither sign up nor create
// sessions; normal application RPCs and intentional probes remain separate.
type Candidates = Awaited<ReturnType<typeof candidateHarness>>;
type Transport = Awaited<ReturnType<typeof realtimeBarrier>>;
const sameSnapshot = (room: RoomProjection, baseline: ReturnType<typeof committedRoomSnapshot>) =>
  expect(JSON.stringify(committedRoomSnapshot(room)) === JSON.stringify(baseline)).toBe(true);
const rpcCounts = (candidates: Candidates, counts: [number, number]) =>
  expect(candidates.stats.every((value, i) => value.automatic === counts[i])).toBe(true);

async function preparePair(pair: [SafeDiagnostics, SafeDiagnostics], candidates: Candidates) {
  const created = await createWaiting(pair[0].page, pair[0]);
  await startHost(pair[1].page, pair[1]);
  const ids: [string, string] = [created.participant, await ownParticipant(pair[1].page)];
  candidates.bind(created.room, ids, created.api);
  return { ...created, ids };
}
async function joinPair(pair: [SafeDiagnostics, SafeDiagnostics], room: RoomProjection, invitation: string) {
  const joined = pair[1].page.waitForResponse(r => new URL(r.url()).pathname === '/rest/v1/rpc/join_room');
  expect((await pair[1].page.goto(invitation))?.status() === 200).toBe(true);
  await assertAccepted(await joined, room, 'joined', 'guest', 'ready');
  for (const member of pair) await assertReady(member.page, member, room, false);
}
async function recoverable(member: SafeDiagnostics, metadata = false) {
  await expect(member.page.getByRole('heading', { name: 'Ready', exact: true })).toBeVisible();
  await expect(member.page.getByText('2 of 2', { exact: true })).toBeVisible();
  await expect(member.page.getByTestId('candidate-status')).toHaveText('Unable to load this movie. Please try again.');
  await expect(member.page.getByRole('button', { name: 'Retry candidate', exact: true })).toBeVisible();
  await expect(member.page.getByTestId('candidate-title')).toHaveCount(metadata ? 1 : 0);
  await member.assertNoCredentialTextUi();
}
async function retryBoth(pair: [SafeDiagnostics, SafeDiagnostics], candidates: Candidates) {
  candidates.arm(['continue', 'continue']);
  await Promise.all(pair.map(member => member.page.getByRole('button', { name: 'Retry candidate', exact: true }).click()));
  await candidates.held(); candidates.release();
}
async function displays(candidates: Candidates) {
  expect(await candidates.assertDisplay(0) === await candidates.assertDisplay(1)).toBe(true);
}
async function reconnect(member: SafeDiagnostics, transport: Transport, room: RoomProjection, whileHeld: () => Promise<void>) {
  await transport.wait('readiness', 1); await transport.wait('reads', 1);
  const before = { ...transport.stats }, id = await ownParticipant(member.page);
  await transport.disconnect();
  await expect(member.page.getByText('Unable to synchronize this room. Please try again.', { exact: true })).toBeVisible();
  await whileHeld();
  transport.holdReadiness(); transport.resume();
  await transport.wait('transportJoins', before.transportJoins + 1); await transport.wait('readyHeld', before.readyHeld + 1);
  expect(transport.stats.reads === before.reads && transport.stats.readiness === before.readiness).toBe(true);
  await whileHeld(); transport.releaseReadiness();
  await transport.wait('readiness', before.readiness + 1); await transport.wait('reads', before.reads + 1);
  await assertReady(member.page, member, room);
  await expect(member.page.getByText('Unable to synchronize this room. Please try again.', { exact: true })).toHaveCount(0);
  expect(await ownParticipant(member.page) === id && transport.stats.joins === before.joins).toBe(true);
  transport.assertHealthy();
}
async function closeHarnesses(candidates: Candidates[], transports: Transport[]) {
  // Always release every owner even if a peer's teardown fails.
  const results = await Promise.allSettled([...candidates.map(h => h.close()), ...transports.map(h => h.close())]);
  expect(results.every(result => result.status === 'fulfilled')).toBe(true);
}

// Scenarios 9–11. Real assignment invalidations are delayed unchanged until
// display, then released for harmless Ready refetch; no fabricated DB events.
test('@candidate F02 reload reconnect and repeated Ready preserve candidate', async ({ diagnostics, browser, baseURL, viewport }, info) => {
  await safeBody(diagnostics, () => withParticipants(browser, { baseURL, viewport }, info, 1, async ([guest]) => {
    const pair: [SafeDiagnostics, SafeDiagnostics] = [diagnostics, guest];
    const c = await candidateHarness(pair, baseURL!), transports: Transport[] = [];
    c.limitAutomatic([2, 2]);
    try {
      for (const member of pair) transports.push(await realtimeBarrier(member.page));
      const { room, invitation, ids } = await preparePair(pair, c);
      await joinPair(pair, room, invitation); await c.held();
      for (const transport of transports) { await transport.wait('readiness', 1); transport.holdUpdates(); }
      c.release(); await c.available(); await displays(c);
      const assigned = committedRoomSnapshot(room);
      for (const transport of transports) {
        await transport.wait('updateHeld', 1); const reads = transport.stats.reads;
        transport.releaseUpdates(); await transport.wait('reads', reads + 1);
      }
      await displays(c); rpcCounts(c, [1, 1]); sameSnapshot(room, assigned);
      for (const i of [0, 1] as const) {
        const reads = transports[i].stats.reads;
        await pair[i].page.reload();
        await c.available(i === 0 ? [2, 1] : [2, 2]); await displays(c);
        await transports[i].wait('reads', reads + 1);
        expect(await ownParticipant(pair[i].page) === ids[i]).toBe(true); sameSnapshot(room, assigned);
      }
      rpcCounts(c, [2, 2]);
      for (const i of [0, 1] as const) {
        await reconnect(pair[i], transports[i], room, async () => { await displays(c); rpcCounts(c, [2, 2]); });
        await displays(c); rpcCounts(c, [2, 2]); sameSnapshot(room, assigned);
      }
      await c.probe(0, 'available'); await c.probe(1, 'available'); sameSnapshot(room, assigned);
      await c.assertHealthy([2, 2]);
      await diagnostics.record({ scenario: 'F02', outcome: 'automatic initial=1/1 reload=2/2; actual sockets both closed/rebound; held real UPDATE Ready refetch and reconnect add zero RPC; same membership and committed xmin; recovery signups=0' });
    } finally { await closeHarnesses([c], transports); }
  }));
});

test('@candidate F03 Waiting host reconnects to the guest established candidate', async ({ diagnostics, browser, baseURL, viewport }, info) => {
  await safeBody(diagnostics, () => withParticipants(browser, { baseURL, viewport }, info, 1, async ([guest]) => {
    const pair: [SafeDiagnostics, SafeDiagnostics] = [diagnostics, guest], c = await candidateHarness(pair, baseURL!);
    c.configureInitial([null, null]); const transport = await realtimeBarrier(diagnostics.page);
    try {
      const { room, invitation, ids } = await preparePair(pair, c);
      await transport.wait('readiness', 1); await transport.wait('reads', 1);
      const before = { ...transport.stats }; await transport.disconnect();
      await expect(diagnostics.page.getByText('Unable to synchronize this room. Please try again.', { exact: true })).toBeVisible();
      const joined = guest.page.waitForResponse(r => new URL(r.url()).pathname === '/rest/v1/rpc/join_room');
      await guest.page.goto(invitation); await assertAccepted(await joined, room, 'joined', 'guest', 'ready');
      await c.available([0, 1]); await c.assertDisplay(1);
      await expect(diagnostics.page.getByRole('heading', { name: 'Waiting', exact: true })).toBeVisible();
      await expect(diagnostics.page.getByTestId('candidate-card')).toHaveCount(0); rpcCounts(c, [0, 1]);
      const assigned = committedRoomSnapshot(room);
      transport.holdReadiness(); transport.resume();
      await transport.wait('transportJoins', before.transportJoins + 1); await transport.wait('readyHeld', before.readyHeld + 1);
      expect(transport.stats.reads === before.reads).toBe(true); rpcCounts(c, [0, 1]);
      transport.releaseReadiness(); await transport.wait('reads', before.reads + 1);
      await c.available(); await displays(c); await assertReady(diagnostics.page, diagnostics, room);
      sameSnapshot(room, assigned);
      expect(await ownParticipant(diagnostics.page) === ids[0] && assigned.row.guest_user_id === ids[1]).toBe(true);
      await c.assertHealthy(); transport.assertHealthy();
      await diagnostics.record({ scenario: 'F03', outcome: 'host actually disconnected while Waiting; guest assigned; real system-ok/refetch recovered Ready and same candidate; automatic=1/1; row/xmin stable; recovery signups=0' });
    } finally { await closeHarnesses([c], [transport]); }
  }));
});

async function directCandidateDenial(member: SafeDiagnostics, api: PublicApi, foreign: RoomProjection) {
  const denied = await member.page.evaluate(async ({ api, foreign }) => {
    const key = Object.keys(localStorage).find(name => /^sb-.+-auth-token$/.test(name));
    const session = key ? JSON.parse(localStorage.getItem(key) ?? 'null') : null;
    if (!session?.access_token) return false;
    const headers = { apikey: api.publicKey, Authorization: `Bearer ${session.access_token}` };
    const catalog = await fetch(`${api.origin}/rest/v1/movie_candidates?select=*`, { headers });
    const column = await fetch(`${api.origin}/rest/v1/rooms?select=movie_candidate_id&id=eq.${foreign.id}`, { headers });
    return catalog.status === 403 && column.status === 403;
  }, { api, foreign });
  expect(denied).toBe(true);
}

test('@candidate F04 unrelated rooms cannot disclose candidate metadata', async ({ diagnostics, browser, baseURL, viewport }, info) => {
  await safeBody(diagnostics, () => withParticipants(browser, { baseURL, viewport }, info, 3, async ([guestA, hostB, guestB]) => {
    const pairs: [SafeDiagnostics, SafeDiagnostics][] = [[diagnostics, guestA], [hostB, guestB]];
    const candidates: Candidates[] = [], transports: Transport[] = [];
    try {
      for (const pair of pairs) {
        const c = await candidateHarness(pair, baseURL!); candidates.push(c); c.limitAutomatic([3, 2]);
        transports.push(await realtimeBarrier(pair[0].page));
      }
      const setups: Awaited<ReturnType<typeof preparePair>>[] = [];
      for (let i = 0; i < 2; i++) setups.push(await preparePair(pairs[i], candidates[i]));
      expect(new Set(setups.flatMap(setup => setup.ids)).size === 4).toBe(true);
      for (let i = 0; i < 2; i++) { await joinPair(pairs[i], setups[i].room, setups[i].invitation); await candidates[i].held(); }
      const absent = randomUUID();
      const isolated = async (overlap = false) => {
        for (let i = 0; i < 2; i++) {
          await candidates[i].probe(0, 'not_found', overlap, setups[1 - i].room.id);
          await candidates[i].probe(0, 'not_found', overlap, absent);
          await directCandidateDenial(pairs[i][0], setups[i].api, setups[1 - i].room);
        }
      };
      // Both target rooms exist and are Ready/NULL; foreign and missing results
      // have the identical exact five-field row, using the attackers' own JWTs.
      await isolated();
      candidates.forEach(c => c.release());
      for (const c of candidates) { await c.available(); await displays(c); }
      const snapshots = setups.map(setup => committedRoomSnapshot(setup.room));
      await isolated(true); await isolated();
      for (let i = 0; i < 2; i++) {
        const c = candidates[i], pair = pairs[i];
        // A real acquisition failure on reload makes the generic UI observable;
        // foreign/missing probes still run as ordinary authenticated callers.
        c.arm(['abort', null]);
        await pair[0].page.reload(); await c.held(); c.release(); await recoverable(pair[0]);
        await pair[1].page.reload(); await c.available([1, 2]); await c.assertDisplay(1);
        sameSnapshot(setups[i].room, snapshots[i]);
      }
      await isolated();
      for (let i = 0; i < 2; i++) {
        await pairs[i][0].page.getByRole('button', { name: 'Retry candidate', exact: true }).click();
        await candidates[i].available([2, 2]); await displays(candidates[i]);
        await reconnect(pairs[i][0], transports[i], setups[i].room, () => displays(candidates[i]));
      }
      await isolated(true);
      for (let i = 0; i < 2; i++) {
        sameSnapshot(setups[i].room, snapshots[i]); rpcCounts(candidates[i], [3, 2]);
        await candidates[i].assertHealthy([3, 2]);
      }
      await diagnostics.record({ scenario: 'F04', outcome: 'two rooms four identities; foreign=absent exact not_found/NULL in both directions before/concurrent/repeated/reload/reconnect/retry; normal catalog/private-column 403; generic recoverable UI; own candidate and xmin unchanged; recovery signups=0' });
    } finally { await closeHarnesses(candidates, transports); }
  }));
});

test('@candidate F05 both pre-forward failures leave Ready unassigned until retry', async ({ diagnostics, browser, baseURL, viewport }, info) => {
  await safeBody(diagnostics, () => withParticipants(browser, { baseURL, viewport }, info, 1, async ([guest]) => {
    const pair: [SafeDiagnostics, SafeDiagnostics] = [diagnostics, guest], c = await candidateHarness(pair, baseURL!);
    c.limitAutomatic([2, 2]); c.configureInitial(['abort', 'abort']);
    const transport = await realtimeBarrier(diagnostics.page);
    try {
      const { room, invitation, ids } = await preparePair(pair, c);
      await joinPair(pair, room, invitation); await c.held();
      const before = committedRoomSnapshot(room);
      expect(before.row.state === 'ready' && before.row.movie_candidate_id === null &&
        before.row.host_user_id === ids[0] && before.row.guest_user_id === ids[1]).toBe(true);
      c.release(); for (const member of pair) await recoverable(member);
      expect(c.stats.every(value => value.forwarded === 0 && value.fetched === 0 && value.aborted === 1)).toBe(true);
      sameSnapshot(room, before); await transport.wait('updates', 1);
      expect(transport.stats.updates === 1).toBe(true);
      await retryBoth(pair, c); await c.available(); await displays(c);
      const after = committedRoomSnapshot(room);
      expect(after.row.movie_candidate_id === firstCandidate.candidate_id && after.xmin !== before.xmin &&
        after.row.host_user_id === ids[0] && after.row.guest_user_id === ids[1] && after.row.state === 'ready').toBe(true);
      await c.probe(0, 'available'); await c.probe(1, 'available'); sameSnapshot(room, after);
      await transport.wait('updates', 2); expect(transport.stats.updates === 2).toBe(true);
      await c.assertHealthy([2, 2]); transport.assertHealthy();
      await diagnostics.record({ scenario: 'F05', outcome: 'both held then aborted before forwarding; fetch=0 continue=0; Ready/NULL whole row and xmin unchanged; synchronized retries held=2 then real RPC; membership UPDATE=1 assignment UPDATE=1; one stable FK matching both complete displays; recovery signups=0' });
    } finally { await closeHarnesses([c], [transport]); }
  }));
});

test('@candidate F06 either participant recovers the other established candidate using two retained identities', async ({ diagnostics, browser, baseURL, viewport }, info) => {
  await safeBody(diagnostics, () => withParticipants(browser, { baseURL, viewport }, info, 1, async ([guest]) => {
    const pair: [SafeDiagnostics, SafeDiagnostics] = [diagnostics, guest], c = await candidateHarness(pair, baseURL!);
    c.limitAutomatic([3, 3]); c.configureInitial(['abort', 'continue']);
    try {
      let setup = await preparePair(pair, c);
      const ids = setup.ids;
      const snapshots: ReturnType<typeof committedRoomSnapshot>[] = [];
      for (const failed of [0, 1] as const) {
        if (failed === 1) {
          await guest.page.goto('/');
          const next = await createWaitingWithSession(diagnostics.page, diagnostics, setup.api, snapshots[0]);
          c.rebind(next.room); c.arm(['continue', 'abort']); setup = { ...next, ids };
        }
        await joinPair(pair, setup.room, setup.invitation); await c.held(); c.release();
        await recoverable(pair[failed]); await c.assertDisplay(failed === 0 ? 1 : 0);
        const assigned = committedRoomSnapshot(setup.room);
        expect(assigned.row.movie_candidate_id === firstCandidate.candidate_id && assigned.row.host_user_id === ids[0] &&
          assigned.row.guest_user_id === ids[1] && assigned.row.state === 'ready').toBe(true);
        await pair[failed].page.getByRole('button', { name: 'Retry candidate', exact: true }).click();
        await c.available(failed === 0 ? [1, 1] : [2, 2]); await displays(c); sameSnapshot(setup.room, assigned);
        snapshots.push(assigned);
        for (const i of [0, 1] as const) {
          expect(await ownParticipant(pair[i].page) === ids[i]).toBe(true); await pair[i].assertAuthAccounting(1, 1);
        }
      }
      expect(snapshots[0].row.id !== snapshots[1].row.id && snapshots[0].row.creation_request_id !== snapshots[1].row.creation_request_id).toBe(true);
      for (const snapshot of snapshots) sameSnapshot(snapshot.row, snapshot);
      await c.assertHealthy([3, 3]);
      await diagnostics.record({ scenario: 'F06', outcome: 'host-failure then guest-failure in two fresh rooms; successful peer display preserved; explicit retries preserve established FK/metadata/xmin; fresh creation request IDs; SAME two identities total; second trial and recovery signups=0' });
    } finally { await c.close(); }
  }));
});

test('@candidate F07 independent committed snapshot precedes both lost responses', async ({ diagnostics, browser, baseURL, viewport }, info) => {
  await safeBody(diagnostics, () => withParticipants(browser, { baseURL, viewport }, info, 1, async ([guest]) => {
    const pair: [SafeDiagnostics, SafeDiagnostics] = [diagnostics, guest], c = await candidateHarness(pair, baseURL!);
    c.limitAutomatic([2, 2]); c.configureInitial(['commit-loss', 'commit-loss']);
    try {
      const { room, invitation } = await preparePair(pair, c);
      await joinPair(pair, room, invitation); await c.held();
      const before = committedRoomSnapshot(room);
      c.release();
      await c.upstreamsHeld();
      // Both actual successful responses remain held in route.fetch. This check
      // is before the method that authorizes aborts after an independent DB read.
      for (const member of pair) {
        await expect(member.page.getByTestId('candidate-title')).toHaveCount(0);
        await expect(member.page.getByTestId('candidate-status')).toHaveText('Loading movie…');
      }
      const committed = await c.loseCommittedResponses(before);
      expect(c.stats.every(value => value.fetched === 1 && value.forwarded === 1 && value.aborted === 1)).toBe(true);
      for (const member of pair) await recoverable(member);
      sameSnapshot(room, committed);
      await retryBoth(pair, c); await c.available(); await displays(c);
      sameSnapshot(room, committed); await c.assertHealthy([2, 2]);
      await diagnostics.record({ scenario: 'F07', outcome: 'both real route.fetch available held -> independent owner committed Ready/FK and xmin matches both -> abort both/dispose -> recoverable errors -> synchronized explicit retry; same candidate/full display and unchanged committed row/xmin; recovery signups=0' });
    } finally { await c.close(); }
  }));
});

test('@candidate F08 failed local poster retries the same image without candidate RPC or Auth', async ({ diagnostics, browser, baseURL, viewport }, info) => {
  await safeBody(diagnostics, () => withParticipants(browser, { baseURL, viewport }, info, 1, async ([guest]) => {
    const pair: [SafeDiagnostics, SafeDiagnostics] = [diagnostics, guest], c = await candidateHarness(pair, baseURL!);
    // Resolve the actual source on the peer; the fresh host has no candidate
    // metadata and has not requested that image before the exact route is armed.
    c.configureInitial(['continue', null]);
    try {
      const { room, invitation } = await preparePair(pair, c);
      await joinPair(pair, room, invitation); await c.held(); await c.available([0, 1]);
      const source = await c.assertDisplay(1), fault = await c.failPosterOnce(0, source);
      c.release(); await c.available(); await recoverable(diagnostics, true);
      await expect(diagnostics.page.getByTestId('candidate-title')).toHaveText(firstCandidate.title);
      await expect(diagnostics.page.getByTestId('candidate-year')).toHaveText('2020');
      expect(fault.failed === 1 && fault.retried === 0).toBe(true);
      const assigned = committedRoomSnapshot(room), auth = c.stats.map(value => value.auth);
      expect(assigned.row.movie_candidate_id === firstCandidate.candidate_id).toBe(true); rpcCounts(c, [1, 1]);
      await diagnostics.page.getByRole('button', { name: 'Retry candidate', exact: true }).click();
      expect(await c.assertDisplay(0) === source).toBe(true); await displays(c);
      expect(fault.failed === 1 && fault.retried >= 1 && c.stats.every((value, i) => value.auth === auth[i])).toBe(true);
      rpcCounts(c, [1, 1]); sameSnapshot(room, assigned); await c.assertHealthy();
      await diagnostics.record({ scenario: 'F08', outcome: 'exact resolved local PNG failed once before host first load; ID/title/year retained with generic incomplete UI; retry same HTTP asset decoded 240x360 and painted via current onLoad; candidate RPC delta=0 Auth HTTP delta=0; unchanged row/xmin; stale-event guard also covered by component suite' });
    } finally { await c.close(); }
  }));
});
