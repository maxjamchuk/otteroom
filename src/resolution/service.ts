import { bootstrapAnonymousSession } from '../auth/anonymous-session';
import { getSupabase } from '../lib/supabase';
import { isRoomId } from '../rooms/contracts';
import { narrowResolutionResult } from './contracts';

export class ResolutionServiceError extends Error {
  constructor() {
    super('Unable to resolve common filters. Please try again.');
    this.name = 'ResolutionServiceError';
  }
}

export async function resolveCommonFilters(roomId: string) {
  if (!isRoomId(roomId)) throw new ResolutionServiceError();
  try {
    await bootstrapAnonymousSession();
    const { data, error } = await getSupabase().rpc('resolve_common_filters', { p_room_id: roomId });
    if (error) throw new ResolutionServiceError();
    return narrowResolutionResult(data);
  } catch {
    throw new ResolutionServiceError();
  }
}
