import type { AcceptedRoomState } from '../rooms/state';
import type { FilterRecoveryResult, FilterSubmissionResult } from './contracts';
import { isParticipantGenre, type ParticipantGenre } from './genres';

export type FilterDraft = {
  genres: ParticipantGenre[];
  releaseYearFrom: string;
  releaseYearTo: string;
};

export type AcceptedFilter = {
  genres: ParticipantGenre[];
  releaseYearFrom: number;
  releaseYearTo: number;
};

export type FilterRequest = {
  roomId: string | null;
  generation: number;
  recoveryAttempt: number;
};

export type FilterState = {
  request: FilterRequest;
  recovery: 'inactive' | 'loading' | 'absent' | 'saved' | 'locked' | 'error';
  accepted: AcceptedFilter | null;
  draft: FilterDraft | null;
  submission: 'idle' | 'submitting' | 'validation-error' | 'error';
  message: string | null;
  allowedReleaseYearMax: number | null;
  filterCompletedCount: number;
  requiredVoterCount: number;
  filtersComplete: boolean;
};

function eligible(room: AcceptedRoomState | null): room is AcceptedRoomState {
  return Boolean(room && room.state === 'ready' && room.isVoter);
}

export function createFilterState(room: AcceptedRoomState | null, generation = 0): FilterState {
  return {
    request: { roomId: room?.id ?? null, generation, recoveryAttempt: 0 },
    recovery: eligible(room) ? 'loading' : 'inactive',
    accepted: null,
    draft: null,
    submission: 'idle',
    message: null,
    allowedReleaseYearMax: null,
    filterCompletedCount: room?.filterCompletedCount ?? 0,
    requiredVoterCount: room?.requiredVoterCount ?? 0,
    filtersComplete: room?.filtersComplete ?? false,
  };
}

export function sameFilterRequest(current: FilterRequest, incoming: FilterRequest): boolean {
  return current.roomId === incoming.roomId && current.generation === incoming.generation &&
    current.recoveryAttempt === incoming.recoveryAttempt;
}

function acceptedFrom(result: Extract<FilterRecoveryResult | FilterSubmissionResult,
  { outcome: 'saved' | 'unchanged' | 'locked' }>): AcceptedFilter {
  return {
    genres: [...result.genres],
    releaseYearFrom: result.release_year_from,
    releaseYearTo: result.release_year_to,
  };
}

function draftFrom(accepted: AcceptedFilter): FilterDraft {
  return {
    genres: [...accepted.genres],
    releaseYearFrom: String(accepted.releaseYearFrom),
    releaseYearTo: String(accepted.releaseYearTo),
  };
}

function adoptCount(state: FilterState, count: number): Pick<FilterState, 'filterCompletedCount' | 'filtersComplete'> {
  const filterCompletedCount = Math.max(state.filterCompletedCount, count);
  return { filterCompletedCount, filtersComplete: filterCompletedCount === state.requiredVoterCount };
}

function matchesRoomCounts(state: FilterState, result: {
  filter_completed_count: number | null;
  required_voter_count: number | null;
}): result is { filter_completed_count: number; required_voter_count: number } {
  return result.required_voter_count === state.requiredVoterCount &&
    typeof result.filter_completed_count === 'number' && result.filter_completed_count <= state.requiredVoterCount;
}

export function receiveFilterRecovery(state: FilterState, request: FilterRequest,
  result: FilterRecoveryResult): FilterState {
  if (!sameFilterRequest(state.request, request) || state.recovery === 'inactive') return state;
  if (result.outcome !== 'not_found' && !matchesRoomCounts(state, result)) {
    return { ...state, recovery: 'error', message: 'Unable to load your filters. Please try again.' };
  }
  if (result.outcome === 'not_submitted') {
    const count = adoptCount(state, result.filter_completed_count);
    if (count.filtersComplete) return { ...state, ...count, recovery: 'error',
      message: 'Unable to load your filters. Please try again.' };
    return { ...state, ...count, recovery: 'absent', accepted: null,
      draft: { genres: [], releaseYearFrom: '1900', releaseYearTo: String(result.allowed_release_year_max) },
      submission: 'idle', message: null, allowedReleaseYearMax: result.allowed_release_year_max };
  }
  if (result.outcome === 'saved' || result.outcome === 'locked') {
    const accepted = acceptedFrom(result);
    const count = adoptCount(state, result.filter_completed_count);
    return { ...state, ...count, recovery: result.outcome === 'locked' || count.filtersComplete ? 'locked' : 'saved',
      accepted, draft: count.filtersComplete ? null : draftFrom(accepted), submission: 'idle', message: null,
      allowedReleaseYearMax: result.allowed_release_year_max };
  }
  return { ...state, recovery: 'error', message: 'Unable to load your filters. Please try again.' };
}

export function failFilterRecovery(state: FilterState, request: FilterRequest): FilterState {
  if (!sameFilterRequest(state.request, request) || state.recovery === 'inactive') return state;
  return { ...state, recovery: 'error', message: 'Unable to load your filters. Please try again.' };
}

export function retryFilterRecovery(state: FilterState): FilterState {
  if (state.request.roomId === null || state.recovery === 'inactive' || state.recovery === 'loading' ||
      state.submission === 'submitting') return state;
  return { ...state, request: { ...state.request, recoveryAttempt: state.request.recoveryAttempt + 1 },
    recovery: 'loading', submission: 'idle', message: null };
}

export function setDraftGenres(state: FilterState, genres: readonly ParticipantGenre[]): FilterState {
  if (!state.draft || state.filtersComplete || state.submission === 'submitting') return state;
  return { ...state, draft: { ...state.draft, genres: [...genres] }, submission: 'idle', message: null };
}

export function setDraftYear(state: FilterState, field: 'from' | 'to', value: string): FilterState {
  if (!state.draft || state.filtersComplete || state.submission === 'submitting') return state;
  return { ...state, draft: { ...state.draft,
    [field === 'from' ? 'releaseYearFrom' : 'releaseYearTo']: value }, submission: 'idle', message: null };
}

export type FilterDraftValidation = { ok: true; genres: ParticipantGenre[]; from: number; to: number } |
  { ok: false; message: string };

export function validateFilterDraft(draft: { genres: readonly unknown[]; releaseYearFrom: string;
  releaseYearTo: string }, allowedMaximum: number): FilterDraftValidation {
  if (!draft.genres.every(isParticipantGenre)) return { ok: false, message: 'Choose only the available genres.' };
  if (new Set(draft.genres).size !== draft.genres.length) return { ok: false, message: 'Choose each genre at most once.' };
  if (!/^\d+$/.test(draft.releaseYearFrom) || !/^\d+$/.test(draft.releaseYearTo)) {
    return { ok: false, message: 'Enter both release years.' };
  }
  const from = Number(draft.releaseYearFrom), to = Number(draft.releaseYearTo);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1900 || from > allowedMaximum ||
      to < 1900 || to > allowedMaximum) {
    return { ok: false, message: `Enter years from 1900 through ${allowedMaximum}.` };
  }
  if (from > to) return { ok: false, message: 'The first release year must not be later than the last.' };
  return { ok: true, genres: [...draft.genres] as ParticipantGenre[], from, to };
}

export function beginFilterSubmission(state: FilterState): FilterState {
  if (!state.draft || state.filtersComplete || state.submission === 'submitting') return state;
  return { ...state, submission: 'submitting', message: null };
}

export function receiveFilterSubmission(state: FilterState, request: FilterRequest,
  result: FilterSubmissionResult): FilterState {
  if (!sameFilterRequest(state.request, request) || state.submission !== 'submitting') return state;
  if (result.outcome !== 'not_found' && !matchesRoomCounts(state, result)) {
    return { ...state, submission: 'error', message: 'Unable to save participant filters. Please try again.' };
  }
  if (result.outcome === 'saved' || result.outcome === 'unchanged' || result.outcome === 'locked') {
    const accepted = acceptedFrom(result);
    const count = adoptCount(state, result.filter_completed_count);
    return { ...state, ...count, recovery: result.outcome === 'locked' || count.filtersComplete ? 'locked' : 'saved',
      accepted, draft: count.filtersComplete ? null : draftFrom(accepted), submission: 'idle', message: null,
      allowedReleaseYearMax: result.allowed_release_year_max };
  }
  if (result.outcome === 'invalid_genres') return { ...state, submission: 'validation-error',
    message: 'Choose only the available genres.' };
  if (result.outcome === 'invalid_year_range') return { ...state, submission: 'validation-error',
    message: `Enter years from 1900 through ${result.allowed_release_year_max}.`,
    allowedReleaseYearMax: result.allowed_release_year_max };
  return { ...state, submission: 'error', message: 'Unable to save participant filters. Please try again.' };
}

export function failFilterSubmission(state: FilterState, request: FilterRequest, message?: string): FilterState {
  if (!sameFilterRequest(state.request, request) || state.submission !== 'submitting') return state;
  if (state.filtersComplete && state.accepted === null) {
    return { ...state, recovery: 'error', submission: 'error',
      message: 'Unable to load your filters. Please try again.' };
  }
  return { ...state, submission: 'error', message: message ?? 'Unable to save participant filters. Please try again.' };
}

export function applyFilterAggregate(state: FilterState, count: number, _syncDegraded: boolean): FilterState {
  if (!Number.isInteger(count) || count < 0 || count > state.requiredVoterCount) return state;
  const next = Math.max(state.filterCompletedCount, count);
  if (next === state.filterCompletedCount) return state;
  const filtersComplete = next === state.requiredVoterCount;
  return { ...state, filterCompletedCount: next, filtersComplete,
    recovery: filtersComplete && (state.recovery === 'saved' || state.recovery === 'locked') ? 'locked' : state.recovery,
    draft: state.draft };
}

export function resetFilterDraft(state: FilterState): FilterState {
  if (!state.accepted || state.filtersComplete || state.submission === 'submitting') return state;
  return { ...state, draft: draftFrom(state.accepted), submission: 'idle', message: null };
}
