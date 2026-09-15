import { candidateMessage, createCandidateState, failCandidate, finishPoster,
  observeAuthoritativeStatus, receiveCandidate, retryCandidate } from '../../src/candidates/state';

const candidate = Object.freeze({ tmdbMovieId: 7, title: 'TMDB Film', releaseYear: 2020,
  posterUrl: 'https://image.tmdb.org/t/p/w500/a.jpg' });
const available = { outcome: 'available', candidate } as const;
const acquiring = () => createCandidateState('room-a', true, 'pending', 1);
const metadata = () => receiveCandidate(acquiring(), acquiring(), available);

it('starts only eligible pending acquisition and maps every authoritative start', () => {
  expect(createCandidateState(null, false).attempt).toBe('inactive');
  expect(createCandidateState('room', false).attempt).toBe('inactive');
  expect(createCandidateState('room', true, 'pending').attempt).toBe('acquiring');
  expect(createCandidateState('room', true, 'assigned').attempt).toBe('loading-metadata');
  expect(createCandidateState('room', true, 'no_candidates').attempt).toBe('no-candidates');
});

it('adopts available identity and moves through poster loading to available', () => {
  const start = acquiring(), next = receiveCandidate(start, start, available);
  expect(next.authoritativeStatus).toBe('assigned'); expect(next.candidate).toEqual(candidate);
  expect(next.attempt).toBe('loading-poster'); expect(Object.isFrozen(next.candidate)).toBe(true);
  expect(finishPoster(next, next, true).attempt).toBe('available');
});

it('uses explicit no-poster and completed-empty terminals without Retry', () => {
  const none = receiveCandidate(acquiring(), acquiring(), { outcome: 'available',
    candidate: { ...candidate, posterUrl: null } });
  expect(none.attempt).toBe('no-poster'); expect(retryCandidate(none)).toBe(none);
  const empty = receiveCandidate(acquiring(), acquiring(), { outcome: 'no_candidates' });
  expect(empty.attempt).toBe('no-candidates'); expect(empty.candidate).toBeNull();
  expect(retryCandidate(empty)).toBe(empty);
});

it('keeps acquisition and metadata failures distinct with one request retry', () => {
  const first = failCandidate(acquiring(), acquiring());
  expect(first.attempt).toBe('acquisition-error'); expect(candidateMessage(first)).toMatch(/find a movie/i);
  expect(retryCandidate(first)).toMatchObject({ attempt: 'acquiring', requestAttempt: 1 });
  const assigned = createCandidateState('room-a', true, 'assigned', 1);
  const failure = receiveCandidate(assigned, assigned, { outcome: 'metadata_unavailable' });
  expect(failure.attempt).toBe('metadata-error');
  expect(retryCandidate(failure)).toMatchObject({ attempt: 'loading-metadata', requestAttempt: 1 });
});

it('poster failure retains title/year and retries only image generation', () => {
  const loaded = metadata(), failed = finishPoster(loaded, loaded, false), retried = retryCandidate(failed);
  expect(failed.attempt).toBe('poster-error'); expect(failed.candidate).toBe(loaded.candidate);
  expect(retried).toMatchObject({ attempt: 'loading-poster', requestAttempt: 0, imageAttempt: 1 });
  expect(retried.candidate).toBe(loaded.candidate);
});

it('anchors immutable ID while allowing same-ID metadata refresh', () => {
  const first = metadata();
  const refreshed = receiveCandidate(first, first, { outcome: 'available', candidate: {
    ...candidate, title: 'Current TMDB Title', releaseYear: 2021, posterUrl: null } });
  expect(refreshed.candidate).toEqual({ tmdbMovieId: 7, title: 'Current TMDB Title',
    releaseYear: 2021, posterUrl: null });
  const conflict = receiveCandidate(refreshed, refreshed, { outcome: 'available', candidate: {
    ...candidate, tmdbMovieId: 8 } });
  expect(conflict.attempt).toBe('integrity-error'); expect(conflict.candidate).toBeNull();
});

it('suppresses a displayed candidate on every authoritative integrity transition', () => {
  const displayed = finishPoster(metadata(), metadata(), true);
  const terminalConflict = observeAuthoritativeStatus(displayed, true, 'no_candidates');
  expect(terminalConflict).toMatchObject({ attempt: 'integrity-error', candidate: null });

  const explicitRoomConflict = observeAuthoritativeStatus(displayed, true, 'assigned', true);
  expect(explicitRoomConflict).toMatchObject({ attempt: 'integrity-error', candidate: null });
  expect(retryCandidate(explicitRoomConflict)).toBe(explicitRoomConflict);
});

it('fails closed when an Edge empty result contradicts an accepted assigned candidate', () => {
  const displayed = finishPoster(metadata(), metadata(), true);
  const conflict = receiveCandidate(displayed, displayed, { outcome: 'no_candidates' });
  expect(conflict).toMatchObject({ authoritativeStatus: 'assigned',
    attempt: 'integrity-error', candidate: null });
  expect(candidateMessage(conflict)).toBe(
    'Candidate status could not be verified. Reload the room and try again.');
  expect(retryCandidate(conflict)).toBe(conflict);
});

it.each([available, { outcome: 'metadata_unavailable' } as const])(
  'fails closed when an Edge assigned result contradicts accepted no-candidates: $outcome', result => {
    const empty = receiveCandidate(acquiring(), acquiring(), { outcome: 'no_candidates' });
    const conflict = receiveCandidate(empty, empty, result);
    expect(conflict).toMatchObject({ authoritativeStatus: 'no_candidates',
      attempt: 'integrity-error', candidate: null });
    expect(retryCandidate(conflict)).toBe(conflict);
  });

it('allows repeated/equal Edge terminals and assigned metadata recovery', () => {
  const empty = receiveCandidate(acquiring(), acquiring(), { outcome: 'no_candidates' });
  expect(receiveCandidate(empty, empty, { outcome: 'no_candidates' })).toBe(empty);

  const displayed = finishPoster(metadata(), metadata(), true);
  const refreshed = receiveCandidate(displayed, displayed, available);
  expect(refreshed).toMatchObject({ authoritativeStatus: 'assigned', candidate,
    attempt: 'loading-poster' });
  expect(receiveCandidate(displayed, displayed, { outcome: 'metadata_unavailable' })).toMatchObject({
    authoritativeStatus: 'assigned', attempt: 'metadata-error', candidate,
  });
});

it('keeps an Edge terminal conflict sticky against every later callback', () => {
  const loadingPoster = metadata();
  const conflict = receiveCandidate(loadingPoster, loadingPoster, { outcome: 'no_candidates' });
  for (const result of [available, { outcome: 'no_candidates' } as const,
    { outcome: 'not_found' } as const]) {
    expect(receiveCandidate(conflict, conflict, result)).toBe(conflict);
  }
  expect(failCandidate(conflict, conflict)).toBe(conflict);
  expect(finishPoster(conflict, loadingPoster, true)).toBe(conflict);
  expect(finishPoster(conflict, loadingPoster, false)).toBe(conflict);
});

it('does not let a stale poster callback restore success after integrity failure', () => {
  const loadingPoster = metadata();
  const integrity = observeAuthoritativeStatus(loadingPoster, true, 'assigned', true);
  expect(integrity.candidate).toBeNull();
  expect(finishPoster(integrity, loadingPoster, true)).toBe(integrity);
  expect(integrity.attempt).toBe('integrity-error');
});

it('ignores every stale request/image callback', () => {
  const start = acquiring(), stale = { ...start, generation: 0 };
  expect(receiveCandidate(start, stale, available)).toBe(start);
  expect(failCandidate(start, stale)).toBe(start);
  const next = metadata(); expect(finishPoster(next, { ...next, imageAttempt: 9 }, false)).toBe(next);
});

it('merges terminal room status monotonically and fails closed on conflict', () => {
  const start = acquiring(), assigned = observeAuthoritativeStatus(start, true, 'assigned');
  expect(assigned).toMatchObject({ authoritativeStatus: 'assigned', attempt: 'loading-metadata' });
  expect(observeAuthoritativeStatus(assigned, true, 'pending')).toBe(assigned);
  expect(observeAuthoritativeStatus(assigned, true, 'no_candidates')).toMatchObject({
    attempt: 'integrity-error', candidate: null,
  });
});
