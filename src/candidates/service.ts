import { bootstrapAnonymousSession } from '../auth/anonymous-session';
import { getSupabase } from '../lib/supabase';
import { candidateFailureMessage, narrowCandidateResult } from './contracts';
import { isRoomId } from '../rooms/contracts';

export class CandidateServiceError extends Error {
  constructor() { super(candidateFailureMessage); this.name = 'CandidateServiceError'; }
}

export async function ensureRoomCandidate(roomId: string) {
  if (!isRoomId(roomId)) throw new CandidateServiceError();
  try {
    await bootstrapAnonymousSession();
    const { data, error } = await getSupabase().functions.invoke('room-candidate', {
      body: { room_id: roomId },
    });
    if (error) throw new CandidateServiceError();
    return narrowCandidateResult(data);
  } catch { throw new CandidateServiceError(); }
}
