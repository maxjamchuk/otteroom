import { bootstrapAnonymousSession } from '../auth/anonymous-session';
import { getSupabase } from '../lib/supabase';
import type { Database } from '../types/database.generated';
import { narrowCreateResult, narrowJoinResult } from './contracts';
import { normalizeRoomCode } from './code';

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

// Both invitation paths and existing-member recovery use this one transport.
export async function joinRoom(code: Database['public']['Functions']['join_room']['Args']['p_room_code']) {
  try {
    await bootstrapAnonymousSession();
    const { data, error } = await getSupabase().rpc('join_room', { p_room_code: code });
    if (error) throw new RoomServiceError();
    return narrowJoinResult(data);
  } catch { throw new RoomServiceError(); }
}

export type RoomProjection = Pick<Database['public']['Tables']['rooms']['Row'], 'id' | 'code'> & { state: 'waiting' | 'ready' };

// The accepted RPC supplies the immutable ID; RLS independently authorizes this read.
export async function refetchRoom(roomId: string): Promise<RoomProjection> {
  try {
    await bootstrapAnonymousSession();
    const { data, error } = await getSupabase().from('rooms').select('id, code, state').eq('id', roomId).limit(2);
    if (error || !Array.isArray(data) || data.length !== 1) throw new RoomServiceError();
    const row = data[0];
    if (!row || Object.keys(row).sort().join(',') !== 'code,id,state' || row.id !== roomId ||
      typeof row.code !== 'string' || normalizeRoomCode(row.code) !== row.code ||
      (row.state !== 'waiting' && row.state !== 'ready')) throw new RoomServiceError();
    return { id: row.id, code: row.code, state: row.state };
  } catch { throw new RoomServiceError(); }
}
