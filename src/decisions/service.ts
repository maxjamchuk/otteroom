import { bootstrapAnonymousSession } from '../auth/anonymous-session';
import { getSupabase } from '../lib/supabase';
import type { Database } from '../types/database.generated';
import { narrowGetDecisionResult, narrowSubmitDecisionResult,
  type CandidateDecision } from './contracts';
import { isRoomId } from '../rooms/contracts';

export class DecisionServiceError extends Error {
  constructor() {
    super('Unable to confirm your decision. Please try again.');
    this.name = 'DecisionServiceError';
  }
}

export async function getCandidateDecision(roomId: string, expectedCandidateSequence: number,
  expectedTmdbMovieId: number) {
  try {
    if (!isRoomId(roomId) || !Number.isSafeInteger(expectedCandidateSequence) ||
        expectedCandidateSequence <= 0 || !Number.isSafeInteger(expectedTmdbMovieId) ||
        expectedTmdbMovieId <= 0)
      throw new DecisionServiceError();
    await bootstrapAnonymousSession();
    const args: Database['public']['Functions']['get_room_candidate_decision']['Args'] = {
      p_room_id: roomId,
      p_expected_candidate_sequence: expectedCandidateSequence,
      p_expected_tmdb_movie_id: expectedTmdbMovieId,
    };
    const { data, error } = await getSupabase().rpc('get_room_candidate_decision', args);
    if (error) throw new DecisionServiceError();
    return narrowGetDecisionResult(data);
  } catch {
    throw new DecisionServiceError();
  }
}

export async function submitCandidateDecision(roomId: string, expectedCandidateSequence: number,
  expectedTmdbMovieId: number, value: CandidateDecision) {
  try {
    if (!isRoomId(roomId) || !Number.isSafeInteger(expectedCandidateSequence) ||
        expectedCandidateSequence <= 0 || !Number.isSafeInteger(expectedTmdbMovieId) || expectedTmdbMovieId <= 0 ||
        (value !== 'yes' && value !== 'no')) throw new DecisionServiceError();
    await bootstrapAnonymousSession();
    const args: Database['public']['Functions']['submit_room_candidate_decision']['Args'] = {
      p_room_id: roomId,
      p_expected_candidate_sequence: expectedCandidateSequence,
      p_expected_tmdb_movie_id: expectedTmdbMovieId,
      p_decision: value,
    };
    const { data, error } = await getSupabase().rpc('submit_room_candidate_decision', args);
    if (error) throw new DecisionServiceError();
    const result = narrowSubmitDecisionResult(data);
    if (!('projection' in result) && result.outcome !== 'not_voter' &&
        (result.outcome === 'conflict' ? result.myDecision === value : result.myDecision !== value))
      throw new DecisionServiceError();
    return result;
  } catch {
    throw new DecisionServiceError();
  }
}
