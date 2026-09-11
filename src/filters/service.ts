import { bootstrapAnonymousSession } from '../auth/anonymous-session';
import { getSupabase } from '../lib/supabase';
import type { Database } from '../types/database.generated';
import { isRoomId } from '../rooms/contracts';
import { narrowFilterRecoveryResult,narrowFilterSubmissionResult } from './contracts';
import type { ParticipantGenre } from './genres';

export type FilterFailureKind='genres'|'years'|'generic';
export class FilterServiceError extends Error {
  constructor(public readonly kind:FilterFailureKind='generic'){
    super(kind==='genres'?'Choose only the available genres.':kind==='years'
      ?'Enter a valid release-year range.':'Unable to save participant filters. Please try again.');
    this.name='FilterServiceError';
  }
}
function transportKind(error:unknown):FilterFailureKind{
  if(error&&typeof error==='object'&&'code'in error){
    const code=String(error.code);
    if(code==='22P02')return 'genres';
    if(code==='22003')return 'years';
  }
  return 'generic';
}
export async function recoverMyParticipantFilter(roomId:string){
  try{
    if(!isRoomId(roomId))throw new FilterServiceError();
    await bootstrapAnonymousSession();
    const {data,error}=await getSupabase().rpc('get_my_participant_filter',{p_room_id:roomId});
    if(error)throw new FilterServiceError();
    return narrowFilterRecoveryResult(data);
  }catch(error){if(error instanceof FilterServiceError)throw error;throw new FilterServiceError();}
}
type SubmitArgs=Database['public']['Functions']['submit_my_participant_filter']['Args'];
export async function submitMyParticipantFilter(roomId:string,genres:readonly ParticipantGenre[],
  releaseYearFrom:number,releaseYearTo:number){
  try{
    if(!isRoomId(roomId))throw new FilterServiceError();
    await bootstrapAnonymousSession();
    const args:SubmitArgs={p_room_id:roomId,p_genres:[...genres],
      p_release_year_from:releaseYearFrom,p_release_year_to:releaseYearTo};
    const {data,error}=await getSupabase().rpc('submit_my_participant_filter',args);
    if(error)throw new FilterServiceError(transportKind(error));
    return narrowFilterSubmissionResult(data);
  }catch(error){if(error instanceof FilterServiceError)throw error;throw new FilterServiceError();}
}
