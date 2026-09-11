import {
  applyFilterAggregate, beginFilterSubmission, createFilterState, failFilterRecovery,
  failFilterSubmission, receiveFilterRecovery, receiveFilterSubmission, setDraftGenres,
  setDraftYear, validateFilterDraft,
} from '../../src/filters/state';
import type { AcceptedRoomState } from '../../src/rooms/state';
import type { FilterRecoveryResult, FilterSubmissionResult } from '../../src/filters/contracts';

const ready: AcceptedRoomState = { kind: 'accepted', id: '11111111-1111-4111-8111-111111111111',
  code: 'ABCDEF0123', isCreator: true, isVoter: true, state: 'ready', title: 'Ready',
  voterCount: 3, requiredVoterCount: 3, filterCompletedCount: 0, filtersComplete: false };
const absent = { outcome: 'not_submitted', genres: null, release_year_from: null, release_year_to: null,
  filter_completed_count: 0, required_voter_count: 3, allowed_release_year_max: 2026 } as const;
const saved = { outcome: 'saved', genres: ['action', 'drama'], release_year_from: 1990,
  release_year_to: 2020, filter_completed_count: 1, required_voter_count: 3,
  allowed_release_year_max: 2026 } satisfies Extract<FilterRecoveryResult, { outcome: 'saved' | 'locked' }>;

it.each([null, { ...ready, state: 'waiting', title: 'Waiting' } as AcceptedRoomState,
  { ...ready, isVoter: false }])('is inactive unless membership is Ready and voting %#', room => {
  expect(createFilterState(room).recovery).toBe('inactive');
});

it('recovers before creating exact Any/full-range defaults', () => {
  const loading = createFilterState(ready);
  expect(loading.recovery).toBe('loading');
  expect(loading.draft).toBeNull();
  const recovered = receiveFilterRecovery(loading, loading.request, absent);
  expect(recovered.recovery).toBe('absent');
  expect(recovered.accepted).toBeNull();
  expect(recovered.draft).toEqual({ genres: [], releaseYearFrom: '1900', releaseYearTo: '2026' });
});

it('keeps authoritative accepted values separate from an unsaved draft', () => {
  const loading = createFilterState(ready);
  const recovered = receiveFilterRecovery(loading, loading.request, saved);
  const edited = setDraftYear(setDraftGenres(recovered, ['western']), 'from', '2001');
  expect(edited.accepted).toEqual({ genres: ['action', 'drama'], releaseYearFrom: 1990, releaseYearTo: 2020 });
  expect(edited.draft).toEqual({ genres: ['western'], releaseYearFrom: '2001', releaseYearTo: '2020' });
});

it.each([
  [{ genres: ['action', 'action'], releaseYearFrom: '1900', releaseYearTo: '2026' }, 'Choose each genre at most once.'],
  [{ genres: ['unknown'], releaseYearFrom: '1900', releaseYearTo: '2026' }, 'Choose only the available genres.'],
  [{ genres: [], releaseYearFrom: '', releaseYearTo: '2026' }, 'Enter both release years.'],
  [{ genres: [], releaseYearFrom: '1899', releaseYearTo: '2026' }, 'Enter years from 1900 through 2026.'],
  [{ genres: [], releaseYearFrom: '2021', releaseYearTo: '2020' }, 'The first release year must not be later than the last.'],
] as const)('validates local draft %#', (draft, message) => {
  expect(validateFilterDraft(draft, 2026)).toEqual({ ok: false, message });
});

it('adopts canonical saved values and never increments aggregate optimistically', () => {
  const initial = receiveFilterRecovery(createFilterState(ready), createFilterState(ready).request, absent);
  const submitting = beginFilterSubmission(initial);
  expect(submitting.submission).toBe('submitting');
  expect(submitting.filterCompletedCount).toBe(0);
  const accepted = receiveFilterSubmission(submitting, submitting.request, saved);
  expect(accepted.accepted?.genres).toEqual(['action', 'drama']);
  expect(accepted.filterCompletedCount).toBe(1);
  expect(accepted.recovery).toBe('saved');
});

it('preserves accepted values and explicit draft on recovery/save failure', () => {
  const loaded = receiveFilterRecovery(createFilterState(ready), createFilterState(ready).request, saved);
  const edited = setDraftYear(loaded, 'to', '2024');
  expect(failFilterSubmission(beginFilterSubmission(edited), edited.request).draft).toEqual(edited.draft);
  expect(failFilterSubmission(beginFilterSubmission(edited), edited.request).accepted).toEqual(edited.accepted);
  expect(failFilterRecovery(edited, edited.request).accepted).toEqual(edited.accepted);
});

it('locks immediately at N/N, preserves the high watermark, and adopts locked own detail', () => {
  const loaded = receiveFilterRecovery(createFilterState(ready), createFilterState(ready).request, saved);
  const complete = applyFilterAggregate(loaded, 3, false);
  expect(complete.filtersComplete).toBe(true);
  expect(applyFilterAggregate(complete, 1, false).filterCompletedCount).toBe(3);
  const lockedResult = { outcome: 'locked', genres: ['action', 'drama'], release_year_from: 1990,
    release_year_to: 2020, filter_completed_count: 3, required_voter_count: 3,
    allowed_release_year_max: 2026 } satisfies FilterSubmissionResult;
  const locked = receiveFilterSubmission(complete, complete.request, lockedResult);
  expect(locked.recovery).toBe('locked');
  expect(locked.accepted).toEqual({ genres: ['action', 'drama'], releaseYearFrom: 1990, releaseYearTo: 2020 });
});

it('rejects a logically valid response for a different immutable room target without advancing progress',()=>{
  const loading=createFilterState(ready);
  const mismatch={...absent,required_voter_count:4};
  const recovery=receiveFilterRecovery(loading,loading.request,mismatch);
  expect(recovery.recovery).toBe('error');expect(recovery.filterCompletedCount).toBe(0);
  const submitting=beginFilterSubmission(receiveFilterRecovery(loading,loading.request,absent));
  const response={outcome:'saved',genres:['action'],release_year_from:1900,release_year_to:2026,
    filter_completed_count:1,required_voter_count:4,allowed_release_year_max:2026} satisfies FilterSubmissionResult;
  const result=receiveFilterSubmission(submitting,submitting.request,response);
  expect(result.submission).toBe('error');expect(result.filterCompletedCount).toBe(0);
});
