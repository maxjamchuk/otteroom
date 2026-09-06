import { bootstrapAnonymousSession } from '../auth/anonymous-session';
import { getSupabase } from '../lib/supabase';
import type { Database } from '../types/database.generated';
import { narrowCreateResult, narrowJoinResult } from './contracts';

export class RoomServiceError extends Error {
  constructor() { super('Unable to complete the room request. Please try again.'); this.name = 'RoomServiceError'; }
}

export async function createRoom(requestId: Database['public']['Functions']['create_room']['Args']['p_creation_request_id']) {
  try {
    await bootstrapAnonymousSession();
    const { data, error } = await getSupabase().rpc('create_room', { p_creation_request_id: requestId });
    if (error) throw new RoomServiceError();
    return narrowCreateResult(data);
  } catch { throw new RoomServiceError(); }
}

// Shared code-based transport; Phase 6 consumes it only for host recovery.
export async function joinRoom(code: Database['public']['Functions']['join_room']['Args']['p_room_code']) {
  try {
    await bootstrapAnonymousSession();
    const { data, error } = await getSupabase().rpc('join_room', { p_room_code: code });
    if (error) throw new RoomServiceError();
    return narrowJoinResult(data);
  } catch { throw new RoomServiceError(); }
}
