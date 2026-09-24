import { expect, type Page } from '@playwright/test';
import { assertOrdinaryJwtPrivacy, test, safeBody, type SafeDiagnostics } from './support/safe-diagnostics.ts';
import { assertControlledProviderComplete, candidateHarness, configureTmdb, controlledCandidate, controlledSuccessor, tmdbSnapshot } from './support/candidate-harness.ts';
import { keyboardDecision, recoverOwnDecision } from './support/decision-harness.ts';
import { submitOwnFilter } from './support/filter-harness.ts';
import { assertResolutionView } from './support/resolution-harness.ts';
import { assertExactThreshold, assertProgressionConverged, navigateInvitationAfterCandidateResponses, progressionSnapshot } from './support/progression-harness.ts';
import { assertAccepted, committedRoomSnapshot, createRetainedRulesFixture, createWaiting, ownParticipant, startHost,
  withParticipants, type CreationConfiguration, type PublicApi, type RetainedSelectionRules, type RoomProjection } from './support/room-harness.ts';

const budget = { M01: 2, M02: 4 } as const;
const configuredRules: RetainedSelectionRules = Object.freeze({
  ordering: 'title_asc', minimumVoteCount: 500, minimumAverageRating: null,
  metadataLanguage: 'de-DE', genreMode: 'and', agreementNumerator: 2, agreementDenominator: 3,
});

async function admit(member: SafeDiagnostics, room: RoomProjection, invitation: string, count: number,
  candidates: Pick<Awaited<ReturnType<typeof candidateHarness>>, 'replaceDocuments' | 'drainResponses'>) {
  const response = member.page.waitForResponse(item => new URL(item.url()).pathname === '/rest/v1/rpc/join_room');
  expect((await navigateInvitationAfterCandidateResponses(candidates, member.page, invitation))?.status()).toBe(200);
  await assertAccepted(await response, room, 'joined', { isCreator: false, isVoter: true },
    count === room.required_voter_count ? 'ready' : 'waiting', count);
}

async function prepareRoom(host: SafeDiagnostics, participants: SafeDiagnostics[], candidates: Awaited<ReturnType<typeof candidateHarness>>,
  create: () => Promise<{ api: PublicApi; room: RoomProjection; invitation: string }>,
  configuration: CreationConfiguration, genres: readonly string[][],
  expectedCandidate = controlledCandidate, existingBinding = false) {
  const created = await create();
  for (let index = 0; index < participants.length; index++)
    await admit(participants[index], created.room, created.invitation,
      Number(configuration.creatorIsVoter) + index + 1, candidates);
  const group = [host, ...participants], identities = await Promise.all(group.map(item => ownParticipant(item.page)));
  if (existingBinding) candidates.rebind(created.room);
  else candidates.bind(created.room, identities, created.api);
  const voters = configuration.creatorIsVoter ? group : participants;
  for (let index = 0; index < voters.length; index++) {
    const result = await submitOwnFilter(voters[index].page, created.api, created.room, genres[index] as any, 2000, 2010);
    expect(result.outcome).toBe('saved');
  }
  await Promise.all(group.map(item => assertResolutionView(item.page, 'compatible')));
  await candidates.available(undefined, expectedCandidate);
  return { ...created, group, voters };
}

test('@feature009 M01 configured order cutoff and exact-two progression', async ({ diagnostics, browser, baseURL, viewport }, info) => {
  test.setTimeout(300000);
  await safeBody(diagnostics, () => withParticipants(browser, { baseURL, viewport }, info, 1, async ([voter]) => {
    const pages = [diagnostics.page, voter.page], candidates = await candidateHarness([diagnostics, voter], baseURL!);
    try {
      await startHost(voter.page, voter);
      await configureTmdb('candidate');
      const first = await prepareRoom(diagnostics, [voter], candidates,
        () => createWaiting(diagnostics.page, diagnostics, { requiredVoterCount: 2, creatorIsVoter: true }),
        { requiredVoterCount: 2, creatorIsVoter: true }, [['action'], ['drama']]);
      expect(committedRoomSnapshot(first.room).row.tmdb_movie_id === controlledCandidate.tmdbMovieId).toBe(true);
      assertExactThreshold(await recoverOwnDecision(diagnostics.page, first.api, first.room), 2);
      await keyboardDecision(diagnostics.page, 'yes');
      await assertProgressionConverged(pages, 'collecting', 1, 2);
      const beforeReload = progressionSnapshot(first.room);
      await candidates.replaceDocuments(pages, () => Promise.all(pages.map(page => page.reload({ waitUntil: 'domcontentloaded' }))));
      await assertProgressionConverged(pages, 'collecting', 1, 2);
      expect(progressionSnapshot(first.room).candidate).toBe(beforeReload.candidate);

      await keyboardDecision(voter.page, 'no');
      await candidates.successorAvailable();
      await assertProgressionConverged(pages, 'collecting', 0, 2);
      expect(committedRoomSnapshot(first.room).row.tmdb_movie_id === controlledSuccessor.tmdbMovieId).toBe(true);

      await keyboardDecision(diagnostics.page, 'yes');
      await assertProgressionConverged(pages, 'collecting', 1, 2);
      await configureTmdb('timeout');
      await keyboardDecision(voter.page, 'no');
      await candidates.acquisitionError(diagnostics.page);
      await configureTmdb('empty');
      await diagnostics.page.getByRole('button', { name: 'Retry finding a movie', exact: true }).click();
      await candidates.exhausted();
      await assertProgressionConverged(pages, 'exhausted');
      for (const page of pages) await expect(page.getByText(/Match|selection rules|configuration/i)).toHaveCount(0);
      const provider = await tmdbSnapshot(); assertControlledProviderComplete(provider);
      candidates.assertHealthy();
      expect(pages.reduce((sum, page) => sum + (page === diagnostics.page ? diagnostics.signupAttempts : voter.signupAttempts), 0)).toBe(budget.M01);
      await diagnostics.record({ scenario: 'M01', outcome: 'Edge create; configured order/cutoff; exact-two threshold; successor reload; source failure distinct from completed exhaustion; identities2' });
    } finally { await candidates.close(); }
  }));
});

test('@feature009 M02 localized order AND decoy and exact-fraction boundary', async ({ diagnostics, browser, baseURL, viewport }, info) => {
  test.setTimeout(300000);
  await safeBody(diagnostics, () => withParticipants(browser, { baseURL, viewport }, info, 3, async voters => {
    const group = [diagnostics, ...voters], pages = group.map(item => item.page);
    const candidates = await candidateHarness(group, baseURL!);
    try {
      const api = await startHost(diagnostics.page, diagnostics);
      for (const member of voters) await startHost(member.page, member);
      await configureTmdb('candidate', false, configuredRules.metadataLanguage as 'de-DE');
      const first = await prepareRoom(diagnostics, voters, candidates,
        () => createRetainedRulesFixture(diagnostics.page, diagnostics, {
          origin: api.origin, publicKey: api.publicKey }, { requiredVoterCount: 3, creatorIsVoter: false }, configuredRules),
        { requiredVoterCount: 3, creatorIsVoter: false },
        [['action', 'drama'], ['action', 'drama'], ['action', 'drama']], controlledSuccessor);
      expect(committedRoomSnapshot(first.room).row.tmdb_movie_id === controlledSuccessor.tmdbMovieId).toBe(true);
      await keyboardDecision(voters[0].page, 'yes');
      await assertProgressionConverged(pages, 'collecting', 1, 3);
      await keyboardDecision(voters[1].page, 'yes');
      await assertProgressionConverged(pages, 'collecting', 2, 3);
      const observer = await recoverOwnDecision(diagnostics.page, first.api, first.room);
      expect(observer.outcome === 'observer' && observer.my_decision === null).toBe(true);
      assertExactThreshold(observer, 2);
      await keyboardDecision(voters[2].page, 'no');
      await assertProgressionConverged(pages, 'agreed');
      expect(committedRoomSnapshot(first.room).row.tmdb_movie_id === controlledSuccessor.tmdbMovieId).toBe(true);
      for (const page of pages) await assertOrdinaryJwtPrivacy(page, ['private filter', 'threshold mode', 'another voter decision']);
      await candidates.replaceDocuments(pages, () => Promise.all(pages.map(page => page.reload({ waitUntil: 'domcontentloaded' }))));
      await assertProgressionConverged(pages, 'agreed');

      await configureTmdb('candidate', false, configuredRules.metadataLanguage as 'de-DE');
      const four = await prepareRoom(diagnostics, voters, candidates,
        () => createRetainedRulesFixture(diagnostics.page, diagnostics, api,
          { requiredVoterCount: 4, creatorIsVoter: true }, configuredRules),
        { requiredVoterCount: 4, creatorIsVoter: true },
        [['action', 'drama'], ['action', 'drama'], ['action', 'drama'], ['action', 'drama']],
        controlledSuccessor, true);
      await keyboardDecision(pages[0], 'yes'); await keyboardDecision(pages[1], 'yes');
      await assertProgressionConverged(pages, 'collecting', 2, 4);
      await keyboardDecision(pages[2], 'no');
      await assertProgressionConverged(pages, 'collecting', 3, 4);
      assertExactThreshold(await recoverOwnDecision(pages[3], four.api, four.room), 3);
      await keyboardDecision(pages[3], 'yes');
      await assertProgressionConverged(pages, 'agreed');
      for (const page of pages) await expect(page.getByText(/Match|configuration|threshold mode/i)).toHaveCount(0);
      const provider = await tmdbSnapshot(); assertControlledProviderComplete(provider);
      candidates.assertHealthy();
      expect(group.reduce((sum, item) => sum + item.signupAttempts, 0)).toBe(budget.M02);
      await diagnostics.record({ scenario: 'M02', outcome: 'retained AND fixture; every-voter decoy and localized ordering; exact 2/3 no-early boundary; aggregate privacy and four-voter convergence; identities4' });
    } finally { await candidates.close(); }
  }));
});
