import type {
  CandidateDecision,
  DecisionProjection,
  GetDecisionResult,
  SubmitDecisionResult,
} from './contracts';

export type DecisionGeneration = Readonly<{ roomId: string; candidateSequence: number; tmdbMovieId: number }>;
export type DecisionAvailability = 'ineligible' | 'voter' | 'observer';
export type DecisionKind = 'unavailable' | 'recovering' | 'undecided' |
  'submitting' | 'decided' | 'recoverable-error';
export type DecisionNotice = 'conflict' | null;

export type CandidateDecisionState = Readonly<{
  generation: DecisionGeneration | null;
  availability: DecisionAvailability;
  kind: DecisionKind;
  projection: DecisionProjection | null;
  pendingIntent: CandidateDecision | null;
  notice: DecisionNotice;
}>;

export function sameDecisionGeneration(left: DecisionGeneration | null,
  right: DecisionGeneration | null): boolean {
  return left === right || !!left && !!right && left.roomId === right.roomId &&
    left.candidateSequence === right.candidateSequence && left.tmdbMovieId === right.tmdbMovieId;
}

export function createDecisionState(generation: DecisionGeneration | null,
  availability: DecisionAvailability): CandidateDecisionState {
  if (!generation || availability === 'ineligible') return Object.freeze({ generation,
    availability: 'ineligible', kind: 'unavailable', projection: null,
    pendingIntent: null, notice: null });
  return Object.freeze({ generation, availability, kind: 'recovering', projection: null,
    pendingIntent: null, notice: null });
}

function projection(result: DecisionProjection): DecisionProjection {
  return Object.freeze({ myDecision: result.myDecision, completedCount: result.completedCount,
    candidateSequence: result.candidateSequence,
    requiredVoterCount: result.requiredVoterCount, decisionSetComplete: result.decisionSetComplete,
    agreementThreshold: result.agreementThreshold, candidateOutcome: result.candidateOutcome,
    candidateProgressionStatus: result.candidateProgressionStatus });
}

export function receiveDecisionRecovery(state: CandidateDecisionState,
  generation: DecisionGeneration, result: GetDecisionResult): CandidateDecisionState {
  if (!sameDecisionGeneration(state.generation, generation) || state.kind !== 'recovering') return state;
  if ('projection' in result) return Object.freeze({ ...state, kind: 'unavailable',
    availability: 'ineligible', projection: null, pendingIntent: null, notice: null });
  if (state.availability === 'observer') {
    if (result.outcome !== 'observer') return { ...state, kind: 'recoverable-error' };
    return Object.freeze({ ...state, kind: 'unavailable', projection: projection(result),
      pendingIntent: null, notice: null });
  }
  if (state.availability !== 'voter' || result.outcome === 'observer')
    return Object.freeze({ ...state, kind: 'recoverable-error', pendingIntent: null });
  return Object.freeze({ ...state, kind: result.outcome === 'decided' ? 'decided' : 'undecided',
    projection: projection(result), pendingIntent: null, notice: null });
}

export function beginDecisionSubmission(state: CandidateDecisionState,
  value: CandidateDecision): CandidateDecisionState {
  if (state.kind !== 'undecided' || state.availability !== 'voter') return state;
  return Object.freeze({ ...state, kind: 'submitting', pendingIntent: value, notice: null });
}

export function receiveDecisionSubmission(state: CandidateDecisionState,
  generation: DecisionGeneration, result: SubmitDecisionResult): CandidateDecisionState {
  if (!sameDecisionGeneration(state.generation, generation) || state.kind !== 'submitting') return state;
  if ('projection' in result) return Object.freeze({ ...state, kind: 'unavailable',
    availability: 'ineligible', projection: null, pendingIntent: null, notice: null });
  if (result.outcome === 'not_voter') return Object.freeze({ ...state, kind: 'unavailable',
    availability: 'observer', projection: projection(result), pendingIntent: null, notice: null });
  return Object.freeze({ ...state, kind: 'decided', projection: projection(result),
    pendingIntent: null, notice: result.outcome === 'conflict' ? 'conflict' : null });
}

export function failDecisionRequest(state: CandidateDecisionState,
  generation: DecisionGeneration): CandidateDecisionState {
  if (!sameDecisionGeneration(state.generation, generation) ||
      state.kind !== 'recovering' && state.kind !== 'submitting') return state;
  return Object.freeze({ ...state, kind: 'recoverable-error', pendingIntent: null });
}

export function retryDecisionRecovery(state: CandidateDecisionState): CandidateDecisionState {
  if (state.kind !== 'recoverable-error' || state.availability === 'ineligible' || !state.generation)
    return state;
  return Object.freeze({ ...state, kind: 'recovering', pendingIntent: null, notice: null });
}

export function refreshDecisionRecovery(state: CandidateDecisionState): CandidateDecisionState {
  if (!state.generation || state.availability === 'ineligible' ||
      state.kind === 'recovering' || state.kind === 'submitting') return state;
  return Object.freeze({ ...state, kind: 'recovering', pendingIntent: null, notice: null });
}
