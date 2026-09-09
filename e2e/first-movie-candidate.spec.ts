import { expect } from '@playwright/test';
import { test, safeBody } from './support/safe-diagnostics';
import { createWaiting, startHost, ownParticipant, withParticipants, realtimeBarrier, assertAccepted,
  assertReady, committedRoomSnapshot } from './support/room-harness';
import { candidateHarness, firstCandidate } from './support/candidate-harness';

export const candidateAnonymousBudget = Object.freeze({ F01: 2 });

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
