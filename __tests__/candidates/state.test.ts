import { candidateMessage, createCandidateState, failCandidate, finishPoster, receiveCandidate, retryCandidate } from '../../src/candidates/state';
import type { CandidateResult } from '../../src/candidates/contracts';

const row = { outcome: 'available', candidate_id: 'fixture-cardboard-comet', title: 'The Cardboard Comet', release_year: 2020, poster_key: 'cardboard-comet' } as const;
const candidate = { candidate_id: row.candidate_id, title: row.title, release_year: row.release_year, poster_key: row.poster_key };
const loading = () => createCandidateState('room-a', true, 1);
const metadata = () => { const s = loading(); return receiveCandidate(s, s, row); };

it.each([null, 'room-a'])('starts inactive without acquisition for Waiting/absent room %#', roomId => {
  const s = createCandidateState(roomId, false, 1);
  expect(s.status).toBe('inactive'); expect(s.candidate).toBeNull(); expect(candidateMessage(s)).toBeNull();
  expect(receiveCandidate(s, s, row)).toBe(s); expect(failCandidate(s, s)).toBe(s); expect(retryCandidate(s)).toBe(s);
});
it('starts Ready loading and anchors exactly four immutable fields before poster success', () => {
  const s = loading(); expect(s.status).toBe('loading'); expect(s.candidate).toBeNull();
  expect(candidateMessage(s)).toBe('Loading movie…');
  const next = receiveCandidate(s, s, row);
  expect(s.candidate).toBeNull(); expect(next.status).toBe('loading'); expect(next.candidate).toEqual(candidate);
  expect(Object.isFrozen(next.candidate)).toBe(true);
  expect(finishPoster(next, next, true).status).toBe('available');
});
it.each(['not_ready', 'not_found'] as const)('maps Ready %s to a safe recoverable acquisition error', outcome => {
  const s = loading(), result = { outcome, candidate_id: null, title: null, release_year: null, poster_key: null };
  const error = receiveCandidate(s, s, result);
  expect(error.status).toBe('acquisition-error'); expect(error.candidate).toBeNull();
  expect(candidateMessage(error)).toBe('Unable to load this movie. Please try again.');
  expect(error.roomId).toBe(s.roomId); expect(error.generation).toBe(s.generation);
});
it('retries acquisition once by advancing only the request attempt', () => {
  const s = loading(), error = failCandidate(s, s), retry = retryCandidate(error);
  expect(retry).toEqual({ ...error, status: 'loading', requestAttempt: 1 });
  expect(retryCandidate(retry)).toBe(retry);
  expect(receiveCandidate(retry, retry, row).candidate).toEqual(candidate);
});
it('preserves candidate metadata on poster failure and retries only the image attempt', () => {
  const s = metadata(), error = finishPoster(s, s, false), retry = retryCandidate(error);
  expect(error.status).toBe('poster-error'); expect(error.candidate).toBe(s.candidate);
  expect(retry).toEqual({ ...error, status: 'loading', posterAttempt: 1 });
  expect(retry.candidate).toBe(s.candidate); expect(retryCandidate(retry)).toBe(retry);
  expect(finishPoster(retry, retry, true).status).toBe('available');
});
it('never accepts a late load success after failure without an explicit image retry', () => {
  const s = metadata(), error = finishPoster(s, s, false);
  expect(finishPoster(error, error, true)).toBe(error);
});
it('preserves success and the metadata anchor on repeated equal available data', () => {
  const s = metadata(), available = finishPoster(s, s, true);
  expect(receiveCandidate(available, available, row)).toBe(available);
  expect(retryCandidate(available)).toBe(available); expect(candidateMessage(available)).toBeNull();
});
it.each(['candidate_id', 'title', 'release_year', 'poster_key'] as const)('rejects later differing %s without replacing the established candidate', field => {
  const s = metadata();
  const differing = { ...row, [field]: field === 'release_year' ? 2021 : 'different' } as CandidateResult;
  const rejected = receiveCandidate(s, s, differing);
  expect(rejected.status).toBe('poster-error'); expect(rejected.candidate).toBe(s.candidate);
  expect(failCandidate(s, s).candidate).toBe(s.candidate);
});
it.each([{ roomId: 'room-b' }, { generation: 0 }, { requestAttempt: 9 }])('ignores stale request ownership %# for both success and failure', changes => {
  const s = loading(), stale = { ...s, ...changes };
  expect(receiveCandidate(s, stale, row)).toBe(s); expect(failCandidate(s, stale)).toBe(s);
});
it('ignores an old failed request after a newer retry succeeds', () => {
  const old = loading(), retry = retryCandidate(failCandidate(old, old));
  const next = receiveCandidate(retry, retry, row), complete = finishPoster(next, next, true);
  expect(failCandidate(complete, old)).toBe(complete); expect(receiveCandidate(complete, old, row)).toBe(complete);
});
it.each([{ roomId: 'room-b' }, { generation: 0 }, { requestAttempt: 9 }, { posterAttempt: 9 }])('ignores stale image success/error %#', changes => {
  const s = metadata(), stale = { ...s, ...changes };
  expect(finishPoster(s, stale, true)).toBe(s); expect(finishPoster(s, stale, false)).toBe(s);
});
