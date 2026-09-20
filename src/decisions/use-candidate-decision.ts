import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { useRoomCandidate } from '../candidates/use-room-candidate';
import type { AcceptedRoomState } from '../rooms/state';
import type { CandidateDecision } from './contracts';
import { getCandidateDecision, submitCandidateDecision } from './service';
import {
  beginDecisionSubmission,
  createDecisionState,
  failDecisionRequest,
  refreshDecisionRecovery,
  receiveDecisionRecovery,
  receiveDecisionSubmission,
  retryDecisionRecovery,
  sameDecisionGeneration,
  type CandidateDecisionState,
  type DecisionAvailability,
  type DecisionGeneration,
} from './state';

type CandidateModel = ReturnType<typeof useRoomCandidate>;
const recognizable = new Set(['loading-poster', 'poster-error', 'available', 'no-poster']);

function activeTarget(room: AcceptedRoomState | null, candidate: CandidateModel): {
  generation: DecisionGeneration | null; availability: DecisionAvailability;
} {
  const movie = candidate.candidate;
  const eligibleRoom = !!room && room.state === 'ready' && room.filtersComplete &&
    room.filterResolutionStatus === 'compatible' && !room.resolutionIntegrityError &&
    room.candidateAcquisitionStatus === 'assigned' &&
    (room.candidateProgressionStatus === 'collecting' || room.candidateProgressionStatus === 'agreed') &&
    room.candidateSequence > 0 && !room.candidateIntegrityError;
  if (!eligibleRoom || !movie || !recognizable.has(candidate.attempt) ||
      !Number.isSafeInteger(movie.tmdbMovieId) || movie.tmdbMovieId <= 0)
    return { generation: null, availability: 'ineligible' };
  return { generation: { roomId: room.id, candidateSequence: room.candidateSequence,
      tmdbMovieId: movie.tmdbMovieId },
    availability: room.isVoter ? 'voter' : 'observer' };
}

export function useCandidateDecision(room: AcceptedRoomState | null, candidate: CandidateModel,
  canonicalRefetch?: () => Promise<AcceptedRoomState | null>) {
  const target = activeTarget(room, candidate);
  const targetRoomId = target.generation?.roomId ?? null;
  const targetMovieId = target.generation?.tmdbMovieId ?? null;
  const targetSequence = target.generation?.candidateSequence ?? null;
  const generation = useMemo(() => targetRoomId !== null && targetMovieId !== null
    && targetSequence !== null
    ? { roomId: targetRoomId, candidateSequence: targetSequence, tmdbMovieId: targetMovieId } : null,
  [targetRoomId, targetSequence, targetMovieId]);
  const [model, setModel] = useState<CandidateDecisionState>(() =>
    createDecisionState(generation, target.availability));
  let state = model;
  if (!sameDecisionGeneration(model.generation, generation) ||
      model.availability !== target.availability && model.kind !== 'unavailable') {
    state = createDecisionState(generation, target.availability);
    setModel(state);
  } else if (generation && room && state.projection &&
      room.decisionCompletedCount > state.projection.completedCount &&
      state.kind !== 'recovering' && state.kind !== 'submitting') {
    state = refreshDecisionRecovery(state);
    setModel(state);
  }

  const active = useRef<DecisionGeneration | null>(null);
  const current = useRef(state);
  useLayoutEffect(() => {
    current.current = state;
  }, [state]);
  useLayoutEffect(() => {
    active.current = generation;
    return () => { if (sameDecisionGeneration(active.current, generation)) active.current = null; };
  }, [generation]);

  const recoveryFlight = useRef<{ generation: DecisionGeneration; promise: ReturnType<typeof getCandidateDecision> } | null>(null);
  useEffect(() => {
    const generation = state.generation;
    if (state.kind !== 'recovering' || !generation) return;
    if (!recoveryFlight.current || !sameDecisionGeneration(recoveryFlight.current.generation, generation)) {
      recoveryFlight.current = { generation,
        promise: getCandidateDecision(generation.roomId, generation.candidateSequence,
          generation.tmdbMovieId) };
    }
    let disposed = false;
    const flight = recoveryFlight.current;
    void flight.promise.then(result => {
      if (!disposed && sameDecisionGeneration(active.current, generation))
        setModel(previous => receiveDecisionRecovery(previous, generation, result));
    }, () => {
      if (!disposed && sameDecisionGeneration(active.current, generation))
        setModel(previous => failDecisionRequest(previous, generation));
    }).finally(() => { if (recoveryFlight.current === flight) recoveryFlight.current = null; });
    return () => { disposed = true; };
  }, [state.kind, state.generation]);

  const submissionFlight = useRef<{ generation: DecisionGeneration; promise: Promise<unknown> } | null>(null);
  const submit = useCallback((value: CandidateDecision) => {
    const before = current.current;
    if (before.kind !== 'undecided' || !before.generation ||
        submissionFlight.current && sameDecisionGeneration(submissionFlight.current.generation,
          before.generation)) return;
    const generation = before.generation;
    const next = beginDecisionSubmission(before, value);
    current.current = next;
    setModel(next);
    const promise = submitCandidateDecision(generation.roomId, generation.candidateSequence,
      generation.tmdbMovieId, value);
    const flight = { generation, promise };
    submissionFlight.current = flight;
    void promise.then(result => {
      if (sameDecisionGeneration(active.current, generation)) {
        setModel(previous => receiveDecisionSubmission(previous, generation, result));
        void canonicalRefetch?.().catch(() => {});
      }
    }, () => {
      if (sameDecisionGeneration(active.current, generation))
        setModel(previous => failDecisionRequest(previous, generation));
    }).finally(() => { if (submissionFlight.current === flight) submissionFlight.current = null; });
  }, [canonicalRefetch]);

  const retry = useCallback(() => {
    setModel(previous => retryDecisionRecovery(previous));
  }, []);
  const synchronize = useCallback(() => {
    setModel(previous => refreshDecisionRecovery(previous));
  }, []);

  return { ...state, controlsVisible: state.availability === 'voter' && !!state.generation &&
      room?.candidateProgressionStatus === 'collecting' &&
      (!state.projection || state.projection.candidateProgressionStatus === 'collecting'),
    controlsEnabled: state.kind === 'undecided', submit, retry, synchronize };
}
