import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AcceptedRoomState } from '../rooms/state';
import type { FilterRecoveryResult, FilterSubmissionResult } from './contracts';
import type { ParticipantGenre } from './genres';
import { recoverMyParticipantFilter, submitMyParticipantFilter } from './service';
import {
  applyFilterAggregate, beginFilterSubmission, createFilterState, failFilterRecovery,
  failFilterSubmission, receiveFilterRecovery, receiveFilterSubmission, resetFilterDraft,
  retryFilterRecovery, sameFilterRequest, setDraftGenres, setDraftYear, validateFilterDraft,
  type FilterRequest, type FilterState,
} from './state';

export type ParticipantFilterModel = Omit<FilterState, 'request'> & {
  roomId: string | null;
  syncDegraded: boolean;
  canSave: boolean;
  toggleGenre: (genre: ParticipantGenre) => void;
  setReleaseYearFrom: (value: string) => void;
  setReleaseYearTo: (value: string) => void;
  save: () => void;
  retrySave: () => void;
  retryRecovery: () => void;
  resetDraft: () => void;
};

type RecoveryFlight = { request: FilterRequest; promise: Promise<FilterRecoveryResult> };

export function useParticipantFilter(room: AcceptedRoomState | null, syncDegraded: boolean,
  observeProgress?: (count: number) => void): ParticipantFilterModel {
  const [model, setModel] = useState(() => createFilterState(room));
  const stateRef = useRef(model);
  const recoveryFlight = useRef<RecoveryFlight | null>(null);
  const saveFlight = useRef<{ request: FilterRequest; promise: Promise<FilterSubmissionResult> } | null>(null);

  let state = model;
  const roomId = room?.id ?? null;
  const eligible = Boolean(room && room.state === 'ready' && room.isVoter);
  if (model.request.roomId !== roomId || (model.recovery === 'inactive') === eligible) {
    state = createFilterState(room, model.request.generation + 1);
    setModel(state);
  } else if (room && (model.filterCompletedCount < room.filterCompletedCount ||
      model.requiredVoterCount !== room.requiredVoterCount)) {
    state = applyFilterAggregate(model, room.filterCompletedCount, syncDegraded);
    setModel(state);
  }

  useLayoutEffect(() => { stateRef.current = state; }, [state]);

  const update = useCallback((change: (current: FilterState) => FilterState) => {
    const next = change(stateRef.current);
    stateRef.current = next;
    setModel(next);
  }, []);

  const { request, recovery } = state;
  useEffect(() => {
    if (recovery !== 'loading' || request.roomId === null) return;
    let disposed = false;
    if (!recoveryFlight.current || !sameFilterRequest(recoveryFlight.current.request, request)) {
      recoveryFlight.current = { request, promise: (async () => recoverMyParticipantFilter(request.roomId!))() };
    }
    void recoveryFlight.current.promise.then(result => {
      if (disposed) return;
      if (result.required_voter_count === stateRef.current.requiredVoterCount &&
          result.filter_completed_count !== null) observeProgress?.(result.filter_completed_count);
      update(current => receiveFilterRecovery(current, request, result));
    }, () => { if (!disposed) update(current => failFilterRecovery(current, request)); });
    return () => { disposed = true; };
  }, [observeProgress, recovery, request, update]);

  const toggleGenre = useCallback((genre: ParticipantGenre) => update(current => {
    if (!current.draft) return current;
    const selected = current.draft.genres.includes(genre)
      ? current.draft.genres.filter(value => value !== genre)
      : [...current.draft.genres, genre];
    return setDraftGenres(current, selected);
  }), [update]);
  const setReleaseYearFrom = useCallback((value: string) => update(current => setDraftYear(current, 'from', value)), [update]);
  const setReleaseYearTo = useCallback((value: string) => update(current => setDraftYear(current, 'to', value)), [update]);

  const save = useCallback(() => {
    const current = stateRef.current;
    if (saveFlight.current && sameFilterRequest(saveFlight.current.request, current.request) ||
        syncDegraded || current.filtersComplete || !current.draft ||
        current.allowedReleaseYearMax === null || current.submission === 'submitting') return;
    const validation = validateFilterDraft(current.draft, current.allowedReleaseYearMax);
    if (!validation.ok) {
      update(value => ({ ...value, submission: 'validation-error', message: validation.message }));
      return;
    }
    const requestAtSave = current.request;
    update(beginFilterSubmission);
    const promise = (async () => submitMyParticipantFilter(requestAtSave.roomId!, validation.genres,
      validation.from, validation.to))();
    const flight = { request: requestAtSave, promise };
    saveFlight.current = flight;
    void promise.then(result => {
      if (result.required_voter_count === stateRef.current.requiredVoterCount &&
          result.filter_completed_count !== null) observeProgress?.(result.filter_completed_count);
      update(value => receiveFilterSubmission(value, requestAtSave, result));
    }, error => {
      const safeMessages = ['Choose only the available genres.', 'Enter a valid release-year range.',
        'Unable to save participant filters. Please try again.'];
      const message = error instanceof Error && safeMessages.includes(error.message) ? error.message : undefined;
      update(value => failFilterSubmission(value, requestAtSave, message));
    }).finally(() => {
        if (saveFlight.current === flight) saveFlight.current = null;
      });
  }, [observeProgress, syncDegraded, update]);

  const retrySave = useCallback(() => save(), [save]);
  const retryRecovery = useCallback(() => update(retryFilterRecovery), [update]);
  const resetDraft = useCallback(() => update(resetFilterDraft), [update]);
  return { ...state, roomId: state.request.roomId, syncDegraded,
    canSave: Boolean(state.draft && !state.filtersComplete && !syncDegraded && state.submission !== 'submitting'),
    toggleGenre, setReleaseYearFrom, setReleaseYearTo, save, retrySave, retryRecovery, resetDraft };
}
