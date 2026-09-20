import { expect, type Page } from '@playwright/test';
import { test, safeBody, type SafeDiagnostics } from './support/safe-diagnostics.ts';
import { candidateHarness, configureTmdb, controlledCandidate, controlledSuccessor,
  tmdbSnapshot } from './support/candidate-harness.ts';
import { installDecisionResponseLoss, keyboardDecision, recoverOwnDecision,
  submitOwnDecision } from './support/decision-harness.ts';
import { submitOwnFilter } from './support/filter-harness.ts';
import { assertResolutionView } from './support/resolution-harness.ts';
import { assertAccepted, committedRoomSnapshot, createWaiting, createWaitingWithSession,
  ownParticipant, startHost, withParticipants, type CreationConfiguration,
  type PublicApi, type RoomProjection } from './support/room-harness.ts';
import { assertCandidateChanged, assertCandidateRetained, assertIdentityReceipt,
  assertProgressionConverged, installFinalDecisionHold,
  navigateInvitationAfterCandidateResponses,
  reloadPagesAfterCandidateResponses,
  progressionSnapshot } from './support/progression-harness.ts';

const budget = { L01: 2, L02: 4 } as const;

async function admit(member: SafeDiagnostics, room: RoomProjection, invitation: string, count: number,
  candidates: Pick<Awaited<ReturnType<typeof candidateHarness>>, 'drainResponses' | 'replaceDocuments'>) {
  const response = member.page.waitForResponse(item => new URL(item.url()).pathname === '/rest/v1/rpc/join_room');
  expect((await navigateInvitationAfterCandidateResponses(candidates, member.page, invitation))?.status()).toBe(200);
  await assertAccepted(await response, room, 'joined', { isCreator: false, isVoter: true },
    count === room.required_voter_count ? 'ready' : 'waiting', count);
}

async function assemble({ host, participants, candidates, previous, api, configuration, beforeAdmissions }: {
  host: SafeDiagnostics; participants: SafeDiagnostics[];
  candidates: Awaited<ReturnType<typeof candidateHarness>>;
  previous?: ReturnType<typeof committedRoomSnapshot>; api?: PublicApi;
  configuration: CreationConfiguration;
  beforeAdmissions?: (created: Awaited<ReturnType<typeof createWaiting>>) => Promise<void>;
}) {
  const created = previous
    ? await createWaitingWithSession(host.page, host, api!, previous, configuration, candidates)
    : await createWaiting(host.page, host, configuration);
  await beforeAdmissions?.(created);
  for (let index = 0; index < participants.length; index++)
    await admit(participants[index], created.room, created.invitation,
      Number(configuration.creatorIsVoter) + index + 1, candidates);
  const group = [host, ...participants];
  const identities = await Promise.all(group.map(item => ownParticipant(item.page)));
  if (previous) candidates.rebind(created.room); else candidates.bind(created.room, identities, created.api);
  const voters = configuration.creatorIsVoter ? group : participants;
  for (let index = 0; index < voters.length; index++) {
    const result = await submitOwnFilter(voters[index].page, created.api, created.room,
      index % 2 ? ['drama'] : ['action'], 2000, 2010);
    expect(result.outcome).toBe('saved');
  }
  await Promise.all(group.map(item => assertResolutionView(item.page, 'compatible')));
  await candidates.available();
  return { ...created, group, voters, snapshot: committedRoomSnapshot(created.room) };
}

async function decide(page: Page, value: 'yes' | 'no') {
  await keyboardDecision(page, value);
}

async function assertForeignDecisionMasked(page: Page, api: PublicApi, room: RoomProjection) {
  const row = await page.evaluate(async ({ origin, publicKey, roomId, tmdbMovieId }) => {
    const key = Object.keys(localStorage).find(item => /^sb-.+-auth-token$/.test(item));
    const token = key ? JSON.parse(localStorage.getItem(key) ?? 'null')?.access_token : null;
    if (!token) throw new Error('E2E_SAFE_FAILURE');
    const response = await fetch(`${origin}/rest/v1/rpc/get_room_candidate_decision`, { method: 'POST',
      headers: { apikey: publicKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_room_id: roomId, p_expected_candidate_sequence: 1,
        p_expected_tmdb_movie_id: tmdbMovieId }) });
    if (!response.ok) throw new Error('E2E_SAFE_FAILURE');
    return (await response.json())?.[0];
  }, { ...api, roomId: room.id, tmdbMovieId: controlledCandidate.tmdbMovieId });
  expect(row?.outcome === 'not_found' && Object.entries(row).filter(([key]) => key !== 'outcome')
    .every(([, value]) => value === null)).toBe(true);
}

test('@feature008 L01 exact-two candidate progression lifecycle', async ({ diagnostics, browser, baseURL, viewport }, info) => {
  test.setTimeout(590000);
  await safeBody(diagnostics, () => withParticipants(browser, { baseURL, viewport }, info, 1, async ([voter]) => {
    const group = [diagnostics, voter], pages = group.map(item => item.page);
    pages.forEach(page => { page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(15000); });
    const candidates = await candidateHarness(group, baseURL!);
    try {
      await startHost(voter.page, voter);
      await configureTmdb('candidate');
      const agreed = await assemble({ host: diagnostics, participants: [voter], candidates,
        configuration: { requiredVoterCount: 2, creatorIsVoter: true } });
      await decide(diagnostics.page, 'yes');
      await assertProgressionConverged(pages, 'collecting', 1, 2);
      const beforeAgreement = progressionSnapshot(agreed.room);
      await decide(voter.page, 'yes');
      await assertProgressionConverged(pages, 'agreed');
      const afterAgreement = progressionSnapshot(agreed.room);
      assertCandidateRetained(beforeAgreement, afterAgreement);
      const providerAfterAgreement = await tmdbSnapshot();
      await reloadPagesAfterCandidateResponses(candidates, pages);
      await assertProgressionConverged(pages, 'agreed');
      expect((await tmdbSnapshot()).calls.discover).toBe(providerAfterAgreement.calls.discover);
      for (const page of pages) await expect(page.getByText(/match|celebrat/i)).toHaveCount(0);

      const rejected = await assemble({ host: diagnostics, participants: [voter], candidates,
        previous: committedRoomSnapshot(agreed.room), api: agreed.api,
        configuration: { requiredVoterCount: 2, creatorIsVoter: true } });
      const original = progressionSnapshot(rejected.room);
      const lost = await candidates.discardNextResponse(1);
      const overlap = await installFinalDecisionHold(pages);
      const concurrent = [decide(diagnostics.page, 'yes'), decide(voter.page, 'no')];
      await overlap.wait(); overlap.release(); await Promise.all(concurrent); await overlap.close();
      await expect.poll(lost.committed, { timeout: 30000 }).toBe(true);
      await lost.close();
      await reloadPagesAfterCandidateResponses(candidates, pages);
      await candidates.successorAvailable();
      const successor = progressionSnapshot(rejected.room);
      assertCandidateChanged(original, successor);
      expect(successor.completed).toBe(0);
      await expect(diagnostics.page.getByRole('heading', { name: controlledSuccessor.title, exact: true })).toBeVisible();

      const retryable = await assemble({ host: diagnostics, participants: [voter], candidates,
        previous: committedRoomSnapshot(rejected.room), api: rejected.api,
        configuration: { requiredVoterCount: 2, creatorIsVoter: true } });
      await decide(diagnostics.page, 'yes');
      expect((await submitOwnDecision(diagnostics.page, retryable.api, retryable.room, 'yes')).outcome).toBe('unchanged');
      expect((await submitOwnDecision(diagnostics.page, retryable.api, retryable.room, 'no')).outcome).toBe('conflict');
      await configureTmdb('timeout');
      const finalLoss = await installDecisionResponseLoss(voter.page);
      await voter.page.getByRole('button', { name: "No — don't want to watch", exact: true }).click();
      await expect(voter.page.getByText('Unable to confirm your choice. Please retry.', { exact: true })).toBeVisible();
      expect(finalLoss.calls()).toBe(1); expect(finalLoss.result()?.candidate_outcome).toBe('rejected');
      await finalLoss.close();
      await candidates.acquisitionError(diagnostics.page);
      expect(progressionSnapshot(retryable.room).progression).toBe('advancing');
      await configureTmdb('candidate');
      await diagnostics.page.getByRole('button', { name: 'Retry finding a movie', exact: true }).click();
      await candidates.successorAvailable();

      const exhausted = await assemble({ host: diagnostics, participants: [voter], candidates,
        previous: committedRoomSnapshot(retryable.room), api: retryable.api,
        configuration: { requiredVoterCount: 2, creatorIsVoter: true } });
      await decide(diagnostics.page, 'yes'); await configureTmdb('empty'); await decide(voter.page, 'no');
      await assertProgressionConverged(pages, 'exhausted');
      await candidates.exhausted();
      await reloadPagesAfterCandidateResponses(candidates, pages);
      await assertProgressionConverged(pages, 'exhausted');
      await candidates.drainResponses();
      const provider = await tmdbSnapshot(); expect(provider.invalid).toBe(0); candidates.assertHealthy();
      assertIdentityReceipt(group.reduce((sum, item) => sum + item.signupAttempts, 0), budget.L01);
      await diagnostics.record({ scenario: 'L01', outcome: 'exact-two progression agreement rejection retry and exhaustion passed; identities2' });
    } finally { await candidates.close(); }
  }));
});

test('@feature008 L02 creator and larger-group candidate progression convergence', async ({ diagnostics, browser, baseURL, viewport }, info) => {
  test.setTimeout(590000);
  await safeBody(diagnostics, () => withParticipants(browser, { baseURL, viewport }, info, 3, async voters => {
    const group = [diagnostics, ...voters], pages = group.map(item => item.page);
    pages.forEach(page => { page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(15000); });
    const candidates = await candidateHarness(group, baseURL!);
    try {
      for (const voter of voters) await startHost(voter.page, voter);
      await configureTmdb('candidate');
      const three = await assemble({ host: diagnostics, participants: voters, candidates,
        configuration: { requiredVoterCount: 3, creatorIsVoter: false },
        beforeAdmissions: async created => assertForeignDecisionMasked(voters[0].page, created.api, created.room) });
      await expect(diagnostics.page.getByRole('button', { name: /want to watch/ })).toHaveCount(0);
      await decide(voters[0].page, 'yes'); await decide(voters[1].page, 'yes');
      expect(progressionSnapshot(three.room).progression).toBe('collecting');
      await decide(voters[2].page, 'no');
      await assertProgressionConverged(pages, 'agreed');
      const observer = await recoverOwnDecision(diagnostics.page, three.api, three.room);
      expect(observer.outcome === 'observer' && observer.my_decision === null &&
        observer.agreement_threshold === 2 && observer.candidate_progression_status === 'agreed').toBe(true);

      const rejected = await assemble({ host: diagnostics, participants: voters, candidates,
        previous: committedRoomSnapshot(three.room), api: three.api,
        configuration: { requiredVoterCount: 3, creatorIsVoter: false } });
      const first = progressionSnapshot(rejected.room);
      await decide(voters[0].page, 'yes');
      const hold = await installFinalDecisionHold([voters[1].page, voters[2].page]);
      const final = [decide(voters[1].page, 'no'), decide(voters[2].page, 'no')];
      await hold.wait(); hold.release(); await Promise.all(final); await hold.close();
      await candidates.successorAvailable();
      await assertProgressionConverged(pages, 'collecting', 0, 3);
      const next = progressionSnapshot(rejected.room); assertCandidateChanged(first, next); expect(next.completed).toBe(0);

      // The same four identities form bounded all-voter rooms for N=4/T=3.
      const fourAgree = await assemble({ host: diagnostics, participants: voters, candidates,
        previous: committedRoomSnapshot(rejected.room), api: rejected.api,
        configuration: { requiredVoterCount: 4, creatorIsVoter: true } });
      for (const page of pages.slice(0, 3)) await decide(page, 'yes');
      expect(progressionSnapshot(fourAgree.room).progression).toBe('collecting');
      await decide(pages[3], 'no');
      await assertProgressionConverged(pages, 'agreed');

      const fourReject = await assemble({ host: diagnostics, participants: voters, candidates,
        previous: committedRoomSnapshot(fourAgree.room), api: fourAgree.api,
        configuration: { requiredVoterCount: 4, creatorIsVoter: true } });
      await decide(pages[0], 'no'); await decide(pages[1], 'no');
      expect(progressionSnapshot(fourReject.room).progression).toBe('collecting');
      await decide(pages[2], 'yes'); expect(progressionSnapshot(fourReject.room).progression).toBe('collecting');
      await decide(pages[3], 'yes');
      await candidates.successorAvailable();
      await assertProgressionConverged(pages, 'collecting', 0, 4);
      expect(progressionSnapshot(fourReject.room).completed).toBe(0);
      await candidates.drainResponses();
      const provider = await tmdbSnapshot(); expect(provider.invalid).toBe(0); candidates.assertHealthy();
      assertIdentityReceipt(group.reduce((sum, item) => sum + item.signupAttempts, 0), budget.L02);
      await diagnostics.record({ scenario: 'L02', outcome: 'creator three-voter and four-voter progression convergence passed; identities4' });
    } finally { await candidates.close(); }
  }));
});
