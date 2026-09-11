import type { Database } from '../types/database.generated';
import { PARTICIPANT_GENRE_VALUES, isParticipantGenre, type ParticipantGenre } from './genres';

type GeneratedResult=Database['public']['Functions']['get_my_participant_filter']['Returns'][number];
const fields=['outcome','genres','release_year_from','release_year_to','filter_completed_count',
  'required_voter_count','allowed_release_year_max'] as const satisfies readonly (keyof GeneratedResult)[];
const order=new Map(PARTICIPANT_GENRE_VALUES.map((value,index)=>[value,index]));

export type AcceptedFilter={genres:ParticipantGenre[];release_year_from:number;release_year_to:number};
type Counts={filter_completed_count:number;required_voter_count:number;allowed_release_year_max:number};
export type FilterRecoveryResult=
  |({outcome:'not_found';genres:null;release_year_from:null;release_year_to:null;filter_completed_count:null;required_voter_count:null;allowed_release_year_max:null})
  |({outcome:'not_ready'|'not_voter'|'not_submitted';genres:null;release_year_from:null;release_year_to:null}&Counts)
  |({outcome:'saved'|'locked'}&AcceptedFilter&Counts);
export type FilterSubmissionResult=
  |({outcome:'not_found';genres:null;release_year_from:null;release_year_to:null;filter_completed_count:null;required_voter_count:null;allowed_release_year_max:null})
  |({outcome:'not_ready'|'not_voter'|'invalid_genres'|'invalid_year_range';genres:null;release_year_from:null;release_year_to:null}&Counts)
  |({outcome:'saved'|'unchanged'|'locked'}&AcceptedFilter&Counts);

export class FilterContractError extends Error {
  constructor(){super('Unable to read participant filters. Please try again.');this.name='FilterContractError';}
}
function oneRow(data:unknown):Record<(typeof fields)[number],unknown>{
  if(!Array.isArray(data)||data.length!==1)throw new FilterContractError();
  const row=data[0];
  if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).length!==fields.length
    ||!fields.every(key=>Object.hasOwn(row,key)))throw new FilterContractError();
  return row as Record<(typeof fields)[number],unknown>;
}
function validCounts(row:Record<(typeof fields)[number],unknown>):row is typeof row&Counts{
  return typeof row.required_voter_count==='number'&&Number.isInteger(row.required_voter_count)
    &&row.required_voter_count>=2&&row.required_voter_count<=2147483647
    &&typeof row.filter_completed_count==='number'&&Number.isInteger(row.filter_completed_count)
    &&row.filter_completed_count>=0&&row.filter_completed_count<=row.required_voter_count
    &&typeof row.allowed_release_year_max==='number'&&Number.isInteger(row.allowed_release_year_max)
    &&row.allowed_release_year_max>=1900&&row.allowed_release_year_max<=32767;
}
function validDetail(row:Record<(typeof fields)[number],unknown>):boolean{
  if(!validCounts(row)||!Array.isArray(row.genres)||!row.genres.every(isParticipantGenre)
    ||new Set(row.genres).size!==row.genres.length
    ||!row.genres.every((value,index,array)=>index===0||order.get(array[index-1] as ParticipantGenre)!<order.get(value)!)
    ||typeof row.release_year_from!=='number'||!Number.isInteger(row.release_year_from)
    ||typeof row.release_year_to!=='number'||!Number.isInteger(row.release_year_to))return false;
  return row.release_year_from>=1900&&row.release_year_from<=row.release_year_to
    &&row.release_year_to<=row.allowed_release_year_max;
}
function allDetailNull(row:Record<(typeof fields)[number],unknown>):boolean{
  return row.genres===null&&row.release_year_from===null&&row.release_year_to===null;
}
function allCountNull(row:Record<(typeof fields)[number],unknown>):boolean{
  return row.filter_completed_count===null&&row.required_voter_count===null&&row.allowed_release_year_max===null;
}
export function narrowFilterRecoveryResult(data:unknown):FilterRecoveryResult{
  const row=oneRow(data);
  if(row.outcome==='not_found'){
    if(!allDetailNull(row)||!allCountNull(row))throw new FilterContractError();
  }else if(row.outcome==='not_ready'||row.outcome==='not_voter'||row.outcome==='not_submitted'){
    if(!allDetailNull(row)||!validCounts(row)||row.outcome==='not_ready'&&row.filter_completed_count!==0
      ||row.outcome==='not_submitted'&&row.filter_completed_count===row.required_voter_count)throw new FilterContractError();
  }else if(row.outcome==='saved'||row.outcome==='locked'){
    if(!validDetail(row)||row.outcome==='saved'&&row.filter_completed_count===row.required_voter_count
      ||row.outcome==='locked'&&row.filter_completed_count!==row.required_voter_count)throw new FilterContractError();
  }else throw new FilterContractError();
  return row as FilterRecoveryResult;
}
export function narrowFilterSubmissionResult(data:unknown):FilterSubmissionResult{
  const row=oneRow(data);
  if(row.outcome==='not_found'){
    if(!allDetailNull(row)||!allCountNull(row))throw new FilterContractError();
  }else if(row.outcome==='not_ready'||row.outcome==='not_voter'||row.outcome==='invalid_genres'||row.outcome==='invalid_year_range'){
    if(!allDetailNull(row)||!validCounts(row)||row.outcome==='not_ready'&&row.filter_completed_count!==0
      ||(row.outcome==='invalid_genres'||row.outcome==='invalid_year_range')&&row.filter_completed_count===row.required_voter_count)throw new FilterContractError();
  }else if(row.outcome==='saved'||row.outcome==='unchanged'||row.outcome==='locked'){
    if(!validDetail(row)||row.outcome==='locked'&&row.filter_completed_count!==row.required_voter_count)throw new FilterContractError();
  }else throw new FilterContractError();
  return row as FilterSubmissionResult;
}
