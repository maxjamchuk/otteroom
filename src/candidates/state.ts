import { candidateFailureMessage, metadataFailureMessage, posterFailureMessage,
  type Candidate, type CandidateResult } from './contracts';
import type { CandidateAcquisitionStatus, CandidateProgressionStatus } from '../rooms/contracts';

export type CandidateRequest = Readonly<{ roomId: string | null; candidateSequence: number;
  generation: number; requestAttempt: number }>;
export type CandidateImage = CandidateRequest & Readonly<{ imageAttempt: number }>;
export type CandidateAttempt = 'inactive' | 'acquiring' | 'acquisition-error' | 'loading-metadata' |
  'metadata-error' | 'loading-poster' | 'poster-error' | 'available' | 'no-poster' |
  'no-candidates' | 'integrity-error';

export type CandidateState = CandidateImage & Readonly<{
  eligible: boolean;
  authoritativeStatus: CandidateAcquisitionStatus;
  progressionStatus: CandidateProgressionStatus;
  attempt: CandidateAttempt;
  candidate: Candidate | null;
}>;

export function createCandidateState(roomId: string | null, eligible: boolean,
  authoritativeStatus: CandidateAcquisitionStatus = 'pending', generation = 0,
  candidateSequence = 0, progressionStatus: CandidateProgressionStatus = 'inactive'): CandidateState {
  const attempt: CandidateAttempt = !roomId || !eligible ? 'inactive' :
    authoritativeStatus === 'no_candidates' ? 'no-candidates' :
    authoritativeStatus === 'assigned' ? 'loading-metadata' : 'acquiring';
  return { roomId, eligible, authoritativeStatus, progressionStatus, candidateSequence,
    generation, requestAttempt: 0,
    imageAttempt: 0, attempt, candidate: null };
}

export function sameCandidateRequest(current: CandidateRequest, incoming: CandidateRequest): boolean {
  return current.roomId === incoming.roomId && current.generation === incoming.generation &&
    current.candidateSequence === incoming.candidateSequence &&
    current.requestAttempt === incoming.requestAttempt;
}
export function sameCandidateImage(current: CandidateImage, incoming: CandidateImage): boolean {
  return sameCandidateRequest(current, incoming) && current.imageAttempt === incoming.imageAttempt;
}

function enterIntegrityError(state: CandidateState): CandidateState {
  return state.attempt === 'integrity-error' && state.candidate === null ? state :
    { ...state, attempt: 'integrity-error', candidate: null };
}

function candidateResultAuthority(result: CandidateResult): Exclude<CandidateAcquisitionStatus, 'pending'> | null {
  if (result.outcome === 'available' || result.outcome === 'metadata_unavailable') return 'assigned';
  if (result.outcome === 'no_candidates') return 'no_candidates';
  return null;
}

export function observeAuthoritativeStatus(state: CandidateState, eligible: boolean,
  status: CandidateAcquisitionStatus, integrityError = false): CandidateState {
  if (integrityError || state.attempt === 'integrity-error')
    return enterIntegrityError(state);
  if (!eligible) return state.attempt === 'inactive' && !state.eligible ? state :
    { ...state, eligible: false, attempt: 'inactive', candidate: null };
  if (state.authoritativeStatus !== 'pending' && status !== 'pending' &&
      state.authoritativeStatus !== status) return enterIntegrityError(state);
  const authoritativeStatus = state.authoritativeStatus === 'pending' ? status : state.authoritativeStatus;
  if (authoritativeStatus === state.authoritativeStatus && state.eligible) return state;
  if (!state.eligible && authoritativeStatus === 'pending') return { ...state, eligible: true,
    generation: state.generation + 1, requestAttempt: 0, imageAttempt: 0,
    attempt: 'acquiring', candidate: null };
  if (authoritativeStatus === 'no_candidates') return { ...state, eligible: true,
    authoritativeStatus, generation: state.generation + 1, requestAttempt: 0, imageAttempt: 0,
    attempt: 'no-candidates', candidate: null };
  if (authoritativeStatus === 'assigned' && !state.candidate) return { ...state, eligible: true,
    authoritativeStatus, generation: state.generation + 1, requestAttempt: 0, imageAttempt: 0,
    attempt: 'loading-metadata' };
  return { ...state, eligible: true, authoritativeStatus };
}

export function observeRoomCandidateAuthority(state: CandidateState, roomId: string | null,
  eligible: boolean, acquisition: CandidateAcquisitionStatus, progression: CandidateProgressionStatus,
  sequence: number, integrityError = false): CandidateState {
  if (integrityError) return enterIntegrityError(state);
  if (roomId === state.roomId && sequence < state.candidateSequence) return state;
  const changed = state.roomId !== roomId || state.candidateSequence !== sequence ||
    state.progressionStatus !== progression;
  if (!roomId || !eligible) return changed || state.attempt !== 'inactive'
    ? createCandidateState(roomId, false, acquisition, state.generation + 1, sequence, progression)
    : state;
  if (!changed && state.authoritativeStatus === acquisition && state.eligible === eligible) return state;
  const next = createCandidateState(roomId, true, acquisition, state.generation + (changed ? 1 : 0),
    sequence, progression);
  if (!changed && state.candidate && acquisition === 'assigned' &&
      (progression === 'collecting' || progression === 'agreed')) return { ...next,
        candidate: state.candidate, attempt: state.attempt };
  if (progression === 'advancing') return { ...next, attempt: 'acquiring', candidate: null };
  if (progression === 'exhausted' || progression === 'inactive' && acquisition === 'no_candidates')
    return { ...next, attempt: 'no-candidates', candidate: null };
  return next;
}

export function failCandidate(state: CandidateState, request: CandidateRequest): CandidateState {
  if (!sameCandidateRequest(state, request) || state.attempt === 'inactive' ||
      state.attempt === 'integrity-error' || state.attempt === 'no-candidates') return state;
  const attempt = state.authoritativeStatus === 'assigned' || state.candidate ? 'metadata-error' : 'acquisition-error';
  return state.attempt === attempt ? state : { ...state, attempt };
}

export function receiveCandidate(state: CandidateState, request: CandidateRequest,
  result: CandidateResult): CandidateState {
  if (!sameCandidateRequest(state, request) || state.attempt === 'inactive' ||
      state.attempt === 'integrity-error') return state;
  const incomingAuthority = candidateResultAuthority(result);
  if (state.authoritativeStatus !== 'pending' && incomingAuthority !== null &&
      state.authoritativeStatus !== incomingAuthority) return enterIntegrityError(state);
  if (state.attempt === 'no-candidates') return state;
  if ((result.outcome === 'available' || result.outcome === 'metadata_unavailable' ||
      result.outcome === 'exhausted') && result.candidateSequence !== state.candidateSequence)
    return state;
  if (result.outcome === 'exhausted') return state.progressionStatus === 'exhausted'
    ? { ...state, authoritativeStatus: 'no_candidates', attempt: 'no-candidates', candidate: null }
    : state;
  if (result.outcome === 'no_candidates') return { ...state, authoritativeStatus: 'no_candidates',
    attempt: 'no-candidates', candidate: null };
  if (result.outcome === 'metadata_unavailable') return { ...state,
    authoritativeStatus: 'assigned', attempt: 'metadata-error' };
  if (result.outcome !== 'available') return failCandidate(state, request);
  const incoming = result.candidate;
  if (state.candidate && state.candidate.tmdbMovieId !== incoming.tmdbMovieId)
    return enterIntegrityError(state);
  const candidate = state.candidate && state.candidate.tmdbMovieId === incoming.tmdbMovieId &&
    state.candidate.title === incoming.title && state.candidate.releaseYear === incoming.releaseYear &&
    state.candidate.posterUrl === incoming.posterUrl ? state.candidate : Object.freeze({ ...incoming });
  return { ...state, authoritativeStatus: 'assigned', candidate,
    attempt: candidate.posterUrl === null ? 'no-poster' : 'loading-poster' };
}

export function retryCandidate(state: CandidateState): CandidateState {
  if (state.attempt === 'acquisition-error') return { ...state,
    requestAttempt: state.requestAttempt + 1, attempt: 'acquiring' };
  if (state.attempt === 'metadata-error') return { ...state,
    requestAttempt: state.requestAttempt + 1, attempt: 'loading-metadata' };
  if (state.attempt === 'poster-error' && state.candidate?.posterUrl) return { ...state,
    imageAttempt: state.imageAttempt + 1, attempt: 'loading-poster' };
  return state;
}

export function finishPoster(state: CandidateState, image: CandidateImage, loaded: boolean): CandidateState {
  if (!state.candidate?.posterUrl || !sameCandidateImage(state, image) || state.attempt !== 'loading-poster') return state;
  return { ...state, attempt: loaded ? 'available' : 'poster-error' };
}

export function candidateMessage(state: CandidateState): string | null {
  if (state.attempt === 'acquiring') return state.progressionStatus === 'advancing'
    ? 'Finding another movie…' : 'Finding a movie…';
  if (state.attempt === 'loading-metadata') return 'Loading movie details…';
  if (state.attempt === 'loading-poster') return 'Loading poster…';
  if (state.attempt === 'acquisition-error') return candidateFailureMessage;
  if (state.attempt === 'metadata-error') return metadataFailureMessage;
  if (state.attempt === 'poster-error') return posterFailureMessage;
  if (state.attempt === 'no-candidates') return state.progressionStatus === 'exhausted'
    ? 'No further eligible movies were found for this selection.'
    : 'No eligible movie was observed during the completed search.';
  if (state.attempt === 'integrity-error') return 'Candidate status could not be verified. Reload the room and try again.';
  return null;
}
