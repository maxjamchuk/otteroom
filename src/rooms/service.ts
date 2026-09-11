import { bootstrapAnonymousSession } from '../auth/anonymous-session';
import { getSupabase } from '../lib/supabase';
import type { Database } from '../types/database.generated';
import { isRoomId, narrowCreateResult, narrowJoinResult, validFilterCount, validResolutionStatus, validVoterCounts } from './contracts';
import { normalizeRoomCode } from './code';

export class RoomServiceError extends Error {
  constructor() { super('Unable to complete the room request. Please try again.'); this.name = 'RoomServiceError'; }
}

type CreateArgs = Database['public']['Functions']['create_room']['Args'];
export async function createRoom(requestId: CreateArgs['p_creation_request_id'],
  requiredVoterCount: CreateArgs['p_required_voter_count'], creatorIsVoter: CreateArgs['p_creator_is_voter']) {
  try {
    await bootstrapAnonymousSession();
    const { data, error } = await getSupabase().rpc('create_room', {
      p_creation_request_id: requestId, p_required_voter_count: requiredVoterCount, p_creator_is_voter: creatorIsVoter,
    });
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

export type RoomProjection = Pick<Database['public']['Tables']['rooms']['Row'], 'id' | 'code' | 'voter_count' | 'required_voter_count'|'filter_completed_count'|'filter_resolution_status'> & { state: 'waiting' | 'ready' };

// The accepted RPC supplies the immutable ID; RLS independently authorizes this read.
export async function refetchRoom(roomId: string): Promise<RoomProjection> {
  try {
    await bootstrapAnonymousSession();
    const { data, error } = await getSupabase().from('rooms').select('id, code, state, voter_count, required_voter_count, filter_completed_count, filter_resolution_status').eq('id', roomId).limit(2);
    if (error || !Array.isArray(data) || data.length !== 1) throw new RoomServiceError();
    const row = data[0];
    if (!row || Object.keys(row).sort().join(',') !== 'code,filter_completed_count,filter_resolution_status,id,required_voter_count,state,voter_count' || !isRoomId(row.id) || row.id !== roomId ||
      typeof row.code !== 'string' || normalizeRoomCode(row.code) !== row.code ||
      (row.state !== 'waiting' && row.state !== 'ready') ||
      !validVoterCounts(row.voter_count, row.required_voter_count, row.state)
      ||!validFilterCount(row.filter_completed_count,row.required_voter_count,row.state)
      ||!validResolutionStatus(row.filter_resolution_status,row.filter_completed_count,
        row.required_voter_count,row.state)) throw new RoomServiceError();
    return { id: row.id, code: row.code, state: row.state, voter_count: row.voter_count,
      required_voter_count: row.required_voter_count,filter_completed_count:row.filter_completed_count,
      filter_resolution_status:row.filter_resolution_status };
  } catch { throw new RoomServiceError(); }
}
