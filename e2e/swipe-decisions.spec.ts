import { expect, type Page } from '@playwright/test';
import { test, safeBody, type SafeDiagnostics } from './support/safe-diagnostics.ts';
import { assertAccepted, committedRoomSnapshot, createWaiting, createWaitingWithSession,
  ownParticipant, startHost, withParticipants, type CreationConfiguration,
  type PublicApi, type RoomProjection } from './support/room-harness.ts';
import { submitOwnFilter } from './support/filter-harness.ts';
import { assertResolutionView } from './support/resolution-harness.ts';
import { candidateHarness, configureTmdb, controlledCandidate, tmdbSnapshot } from './support/candidate-harness.ts';
import { assertDecisionReady, assertOwnDecision, assertSameCandidate, boundedCandidateIdentity, cancelledTouchSwipe,
  ControlledDecisionPerformance, decisionRealtimeBarrier, installDecisionOverlap,
  installAssignedCandidatePresentation,
  installDecisionPrecommitFailure, installDecisionResponseLoss, keyboardDecision,
  preassembleAssignedCandidate, preassembleDecisionRooms, recoverOwnDecision,
  submitOwnDecision,
  type SafeDecision } from './support/decision-harness.ts';

const budget = { K01: 2, K02: 4 } as const;

async function admit(diagnostics: SafeDiagnostics, room: RoomProjection, invitation: string, count: number) {
  const response = diagnostics.page.waitForResponse(item =>
    new URL(item.url()).pathname === '/rest/v1/rpc/join_room');
  expect((await diagnostics.page.goto(invitation))?.status()).toBe(200);
  await assertAccepted(await response, room, 'joined', { isCreator: false, isVoter: true },
    count === room.required_voter_count ? 'ready' : 'waiting', count);
}

async function retryDecisionRecovery(page: Page) {
  const retry = page.getByRole('button', { name: 'Retry decision recovery', exact: true });
  await expect(retry).toBeVisible();
  await expect(retry).toBeEnabled();
  await retry.dispatchEvent('click');
}

async function submitFaultDecision(page: Page) {
  const yes = page.getByRole('button', { name: 'Yes — want to watch', exact: true });
  await expect(yes).toBeVisible();
  await expect(yes).toBeEnabled();
  await yes.dispatchEvent('click');
}

async function makeAssignedRoom({ host, voters, candidates, presentation, api, previous, configuration }: {
  host: SafeDiagnostics;
  voters: SafeDiagnostics[];
  candidates: Awaited<ReturnType<typeof candidateHarness>>;
  presentation: Awaited<ReturnType<typeof installAssignedCandidatePresentation>>;
  api?: PublicApi;
  previous?: ReturnType<typeof committedRoomSnapshot>;
  configuration: CreationConfiguration;
}) {
  const created = previous
    ? await createWaitingWithSession(host.page, host, api!, previous, configuration)
    : await createWaiting(host.page, host, configuration);
  for (let index = 0; index < voters.length; index++)
    await admit(voters[index], created.room, created.invitation, Number(configuration.creatorIsVoter) + index + 1);
  const group = [host, ...voters];
  const identities = await Promise.all(group.map(item => ownParticipant(item.page)));
  if (previous) candidates.rebind(created.room); else candidates.bind(created.room, identities, created.api);
  presentation.bind(created.room);
  const votingPages = configuration.creatorIsVoter ? group.map(item => item.page) : voters.map(item => item.page);
  for (let index = 0; index < votingPages.length; index++) {
    const result = await submitOwnFilter(votingPages[index], created.api, created.room,
      index % 2 ? ['drama'] : ['action'], 2000, 2010);
    expect(result.outcome).toBe('saved');
  }
  for (const page of group.map(item => item.page)) await assertResolutionView(page, 'compatible');
  if (committedRoomSnapshot(created.room).row.candidate_acquisition_status === 'pending') {
    preassembleAssignedCandidate(created.room, controlledCandidate.tmdbMovieId);
    await Promise.all(group.map(item => item.page.reload({ waitUntil: 'domcontentloaded' })));
  }
  await candidates.available(group.map(item => item.page));
  await assertDecisionReady(votingPages);
  expect(boundedCandidateIdentity(created.room)).toBe(controlledCandidate.tmdbMovieId);
  return created;
}

test('@feature007 K01 exact-two immutable decision lifecycle', async ({ diagnostics, browser, baseURL, viewport }, info) => {
  test.setTimeout(590000);
  await safeBody(diagnostics, () => withParticipants(browser, { baseURL, viewport, hasTouch: true, isMobile: true }, info, 1, async ([voter]) => {
    const group = [diagnostics, voter], pages = group.map(item => item.page);
    for (const page of pages) { page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(15000); }
    const candidates = await candidateHarness(group, baseURL!);
    const presentation = await installAssignedCandidatePresentation(pages, controlledCandidate);
    const timing = new ControlledDecisionPerformance(info);
    let previous: ReturnType<typeof committedRoomSnapshot> | undefined;
    let api: PublicApi | undefined;
    try {
      await configureTmdb('candidate');
      await startHost(voter.page, voter);

      // Fault and lifecycle trial is outside the controlled no-fault timing set.
      const lifecycle = await makeAssignedRoom({ host: diagnostics, voters: [voter], candidates, presentation,
        configuration: { requiredVoterCount: 2, creatorIsVoter: true } });
      api = lifecycle.api; previous = committedRoomSnapshot(lifecycle.room);
      await cancelledTouchSwipe(voter.page);
      const precommit = await installDecisionPrecommitFailure(diagnostics.page);
      await submitFaultDecision(diagnostics.page);
      await expect(diagnostics.page.getByText('Unable to confirm your choice. Please retry.', { exact: true })).toBeVisible();
      expect(precommit.calls()).toBe(1); await precommit.close();
      await retryDecisionRecovery(diagnostics.page);
      await expect(diagnostics.page.getByText('Choose Yes or No for this candidate.', { exact: true })).toBeVisible();
      const loss = await installDecisionResponseLoss(diagnostics.page);
      await submitFaultDecision(diagnostics.page);
      await expect(diagnostics.page.getByText('Unable to confirm your choice. Please retry.', { exact: true })).toBeVisible();
      expect(loss.calls()).toBe(1); await loss.close();
      await retryDecisionRecovery(diagnostics.page);
      await expect(diagnostics.page.getByText('You chose Yes', { exact: true })).toBeVisible();
      expect((await submitOwnDecision(diagnostics.page, api, lifecycle.room, 'yes')).outcome).toBe('unchanged');
      expect((await submitOwnDecision(diagnostics.page, api, lifecycle.room, 'no')).outcome).toBe('conflict');
      await voter.page.goto('/about', { waitUntil: 'domcontentloaded' });
      expect((await recoverOwnDecision(voter.page, api, lifecycle.room)).outcome).toBe('not_decided');
      await voter.page.goto(`/room/${lifecycle.room.code}`, { waitUntil: 'domcontentloaded' });
      await candidates.available([voter.page]);
      await assertDecisionReady([voter.page]);
      await keyboardDecision(voter.page, 'no');
      await assertOwnDecision(diagnostics.page, api, lifecycle.room, 'yes', 2);
      await assertOwnDecision(voter.page, api, lifecycle.room, 'no', 2);
      await Promise.all(pages.map(page => page.reload({ waitUntil: 'domcontentloaded' })));
      await candidates.available();
      await expect(diagnostics.page.getByText('Current candidate agreement: not both Yes.', { exact: true })).toBeVisible();

      // Ten assigned rooms, exactly two serial first-decision timings per room.
      const rooms = preassembleDecisionRooms(lifecycle.room, 10, controlledCandidate.tmdbMovieId);
      assertSameCandidate(rooms);
      const combinations: readonly (readonly [SafeDecision, SafeDecision])[] = [
        ['yes','yes'], ['yes','no'], ['no','yes'], ['no','no'], ['yes','yes'],
        ['no','yes'], ['yes','no'], ['no','no'], ['yes','yes'], ['no','yes'],
      ];
      for (let index = 0; index < rooms.length; index++) {
        const room = rooms[index]; candidates.rebind(room); presentation.bind(room);
        await Promise.all(pages.map(page => page.goto(`/room/${room.code}`, { waitUntil: 'domcontentloaded' })));
        await candidates.available(pages);
        await assertDecisionReady(pages);
        const hostStart = globalThis.performance.now();
        await keyboardDecision(diagnostics.page, combinations[index][0]);
        timing.record(globalThis.performance.now() - hostStart, true);
        const voterStart = globalThis.performance.now();
        await keyboardDecision(voter.page, combinations[index][1]);
        timing.record(globalThis.performance.now() - voterStart, true);
        const host = await assertOwnDecision(diagnostics.page, api!, room, combinations[index][0], 2);
        const guest = await assertOwnDecision(voter.page, api!, room, combinations[index][1], 2);
        expect(host.my_decision).toBe(combinations[index][0]);
        expect(guest.my_decision).toBe(combinations[index][1]);
        await expect(diagnostics.page.getByText('2 of 2 decisions collected.', { exact: true })).toBeVisible();
        const agreed = combinations[index][0] === 'yes' && combinations[index][1] === 'yes';
        await expect(diagnostics.page.getByText(agreed
          ? 'Current candidate agreement: both voters chose Yes.'
          : 'Current candidate agreement: not both Yes.', { exact: true })).toBeVisible();
        expect(boundedCandidateIdentity(room)).toBe(controlledCandidate.tmdbMovieId);
      }
      const receipt = timing.receipt();
      expect(receipt.samples === 20 && receipt.passing >= 19 && receipt.recoverableFailures === 0).toBe(true);
      const provider = await tmdbSnapshot(); expect(provider.invalid).toBe(0); candidates.assertHealthy(); presentation.assertHealthy();
      expect(group.reduce((sum, item) => sum + item.signupAttempts, 0)).toBe(budget.K01);
      await diagnostics.record({ scenario: 'K01', outcome: 'exact-two lifecycle and aggregate timing passed; identities2' });
    } finally { await presentation.close(); await candidates.close(); }
  }));
});

test('@feature007 K02 larger-room aggregate-only decision convergence', async ({ diagnostics, browser, baseURL, viewport }, info) => {
  test.setTimeout(180000);
  await safeBody(diagnostics, () => withParticipants(browser, { baseURL, viewport }, info, 3, async voters => {
    const group = [diagnostics, ...voters], pages = group.map(item => item.page);
    for (const page of pages) { page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(15000); }
    const candidates = await candidateHarness(group, baseURL!);
    const presentation = await installAssignedCandidatePresentation(pages, controlledCandidate);
    const transport = await decisionRealtimeBarrier(diagnostics.page);
    try {
      await configureTmdb('candidate');
      for (const voter of voters) await startHost(voter.page, voter);
      const created = await makeAssignedRoom({ host: diagnostics, voters, candidates, presentation,
        configuration: { requiredVoterCount: 3, creatorIsVoter: false } });
      await expect(diagnostics.page.getByRole('button', { name: /want to watch/ })).toHaveCount(0);
      expect((await recoverOwnDecision(diagnostics.page, created.api, created.room)).outcome).toBe('observer');
      transport.holdUpdates();
      const overlap = await installDecisionOverlap(voters.map(item => item.page));
      const submitted = voters.map((item, index) => item.page.getByRole('button', {
        name: index === 1 ? "No — don't want to watch" : 'Yes — want to watch', exact: true,
      }).click());
      await overlap.wait(); overlap.release(); await Promise.all(submitted); await overlap.close();
      for (let index = 0; index < voters.length; index++)
        await assertOwnDecision(voters[index].page, created.api, created.room, index === 1 ? 'no' : 'yes', 3);
      transport.releaseUpdates();
      await expect(diagnostics.page.getByText('3 of 3 decisions collected.', { exact: true })).toBeVisible();
      await expect(diagnostics.page.getByText(/Current candidate agreement:/)).toHaveCount(0);
      for (const page of pages) {
        await expect(page.getByText(/next candidate|match|celebrat/i)).toHaveCount(0);
        await expect(page.getByRole('heading', { name: controlledCandidate.title, exact: true })).toBeVisible();
      }
      const observer = await recoverOwnDecision(diagnostics.page, created.api, created.room);
      expect(observer.my_decision === null && observer.decision_completed_count === 3 &&
        observer.required_voter_count === 3 && observer.decision_set_complete === true &&
        observer.two_voter_agreement === null).toBe(true);
      expect(committedRoomSnapshot(created.room).row.decision_completed_count).toBe(3);
      expect(boundedCandidateIdentity(created.room)).toBe(controlledCandidate.tmdbMovieId);
      transport.assertHealthy(); candidates.assertHealthy(); presentation.assertHealthy();
      expect(group.reduce((sum, item) => sum + item.signupAttempts, 0)).toBe(budget.K02);
      await diagnostics.record({ scenario: 'K02', outcome: 'larger-room aggregate-only convergence; identities4' });
    } finally { await presentation.close(); await candidates.close(); await transport.close(); }
  }));
});
