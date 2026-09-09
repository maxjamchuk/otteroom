import { bootstrapAnonymousSession } from '../auth/anonymous-session';
import { getSupabase } from '../lib/supabase';
import type { Database } from '../types/database.generated';
import { candidateFailureMessage, narrowCandidateResult } from './contracts';

export class CandidateServiceError extends Error {
  constructor() { super(candidateFailureMessage); this.name = 'CandidateServiceError'; }
}

export async function ensureRoomCandidate(roomId: Database['public']['Functions']['ensure_room_candidate']['Args']['p_room_id']) {
  try {
    await bootstrapAnonymousSession();
    const { data, error } = await getSupabase().rpc('ensure_room_candidate', { p_room_id: roomId });
    if (error) throw new CandidateServiceError();
    return narrowCandidateResult(data);
  } catch { throw new CandidateServiceError(); }
}
