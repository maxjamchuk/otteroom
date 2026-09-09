import { candidateFailureMessage, type Candidate, type CandidateResult } from './contracts';

export type CandidateRequest = { roomId: string | null; generation: number; requestAttempt: number };
export type CandidateImage = CandidateRequest & { posterAttempt: number };
export type CandidateState = CandidateImage & {
  ready: boolean;
  status: 'inactive' | 'loading' | 'available' | 'acquisition-error' | 'poster-error';
  candidate: Candidate | null;
};

export function createCandidateState(roomId: string | null, ready: boolean, generation = 0): CandidateState {
  return { roomId, ready, generation, requestAttempt: 0, posterAttempt: 0,
    status: roomId && ready ? 'loading' : 'inactive', candidate: null };
}

export function sameCandidateRequest(current: CandidateRequest, incoming: CandidateRequest): boolean {
  return current.roomId === incoming.roomId && current.generation === incoming.generation &&
    current.requestAttempt === incoming.requestAttempt;
}
export function sameCandidateImage(current: CandidateImage, incoming: CandidateImage): boolean {
  return sameCandidateRequest(current, incoming) && current.posterAttempt === incoming.posterAttempt;
}

export function failCandidate(state: CandidateState, request: CandidateRequest): CandidateState {
  if (state.status === 'inactive' || !sameCandidateRequest(state, request)) return state;
  const status = state.candidate ? 'poster-error' : 'acquisition-error';
  return state.status === status ? state : { ...state, status };
}

export function receiveCandidate(state: CandidateState, request: CandidateRequest, result: CandidateResult): CandidateState {
  if (state.status === 'inactive' || !sameCandidateRequest(state, request)) return state;
  if (result.outcome !== 'available') return failCandidate(state, request);
  const candidate: Candidate = Object.freeze({ candidate_id: result.candidate_id, title: result.title,
    release_year: result.release_year, poster_key: result.poster_key });
  if (state.candidate) {
    const previous = state.candidate;
    return previous.candidate_id === candidate.candidate_id && previous.title === candidate.title &&
      previous.release_year === candidate.release_year && previous.poster_key === candidate.poster_key
      ? state : failCandidate(state, request);
  }
  return { ...state, status: 'loading', candidate };
}

export function retryCandidate(state: CandidateState): CandidateState {
  if (state.status === 'acquisition-error' && !state.candidate) {
    return { ...state, requestAttempt: state.requestAttempt + 1, status: 'loading' };
  }
  if (state.status === 'poster-error' && state.candidate) {
    return { ...state, posterAttempt: state.posterAttempt + 1, status: 'loading' };
  }
  return state;
}

export function finishPoster(state: CandidateState, image: CandidateImage, loaded: boolean): CandidateState {
  if (!state.candidate || !sameCandidateImage(state, image) ||
      !(state.status === 'loading' || !loaded && state.status === 'available')) return state;
  return { ...state, status: loaded ? 'available' : 'poster-error' };
}

export function candidateMessage(state: CandidateState): string | null {
  if (state.status === 'loading') return 'Loading movie…';
  if (state.status === 'acquisition-error' || state.status === 'poster-error') return candidateFailureMessage;
  return null;
}
