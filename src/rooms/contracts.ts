import type { Database } from '../types/database.generated';
import { normalizeRoomCode } from './code';

type GeneratedRow = Database['public']['Functions']['join_room']['Returns'][number];
export type RoomResolutionStatus = Database['public']['Enums']['filter_resolution_status'];
export type CandidateAcquisitionStatus = Database['public']['Enums']['candidate_acquisition_status'];
export type CandidateProgressionStatus = Database['public']['Enums']['candidate_progression_status'];
type Projection = Pick<GeneratedRow, 'room_id' | 'room_code' | 'voter_count' | 'required_voter_count'|'filter_completed_count'|'filter_resolution_status'|'decision_completed_count'> & {
  room_state: 'waiting' | 'ready';
  candidate_acquisition_status: CandidateAcquisitionStatus;
  candidate_progression_status: CandidateProgressionStatus;
  candidate_sequence: number;
};
type Member = { is_creator: true; is_voter: boolean } | { is_creator: false; is_voter: true };
export type CreateResult = Projection & { outcome: 'created' | 'already_created'; is_creator: true; is_voter: boolean };
export type AcceptedJoinResult = Projection & (
  { outcome: 'joined'; is_creator: false; is_voter: true } | { outcome: 'already_member' } & Member
);
type RejectedJoinResult = { outcome: 'invalid_code' | 'not_found' | 'full' } & {
  [K in Exclude<keyof GeneratedRow, 'outcome'>]: null
};
export type JoinResult = AcceptedJoinResult | RejectedJoinResult;
export type AcceptedRoomResult = CreateResult | AcceptedJoinResult;

export class RoomContractError extends Error {
  constructor() { super('Unable to read room information. Please try again.'); this.name = 'RoomContractError'; }
}

export function isRoomId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
export function validVoterCounts(count: unknown, target: unknown, state: unknown): boolean {
  return typeof target === 'number' && Number.isInteger(target) && target >= 2 && target <= 2147483647 &&
    typeof count === 'number' && Number.isInteger(count) && count >= 0 && count <= target &&
    state === (count === target ? 'ready' : 'waiting');
}
export function validFilterCount(count:unknown,target:unknown,state:unknown):boolean{
  return typeof target==='number'&&Number.isInteger(target)&&typeof count==='number'&&Number.isInteger(count)
    &&count>=0&&count<=target&&(count===0||state==='ready');
}
export function validResolutionStatus(status: unknown, filterCount: unknown, target: unknown,
  state: unknown): status is RoomResolutionStatus {
  return status === 'pending' || (status === 'compatible' || status === 'incompatible') &&
    state === 'ready' && filterCount === target;
}
export function validCandidateStatus(status: unknown, resolutionStatus: unknown, filterCount: unknown,
  target: unknown, roomState: unknown): status is CandidateAcquisitionStatus {
  return status === 'pending' || (status === 'assigned' || status === 'no_candidates') &&
    roomState === 'ready' && filterCount === target && resolutionStatus === 'compatible';
}
export function validDecisionCount(count: unknown, target: unknown, roomState: unknown,
  filterCount: unknown, resolutionStatus: unknown, candidateStatus: unknown): boolean {
  return typeof count === 'number' && Number.isInteger(count) && count >= 0 &&
    typeof target === 'number' && Number.isInteger(target) && count <= target &&
    (count === 0 || roomState === 'ready' && filterCount === target &&
      resolutionStatus === 'compatible' && candidateStatus === 'assigned');
}
export function validProgression(status: unknown, sequence: unknown, count: unknown,
  target: unknown, acquisition: unknown, roomState: unknown, filterCount: unknown,
  resolution: unknown): status is CandidateProgressionStatus {
  if (typeof sequence !== 'number' || !Number.isSafeInteger(sequence) || sequence < 0 ||
      typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0 ||
      typeof target !== 'number' || !Number.isSafeInteger(target) || count > target) return false;
  if (status === 'inactive') return sequence === 0 && count === 0 &&
    (acquisition === 'pending' || acquisition === 'no_candidates');
  if (sequence < 1 || roomState !== 'ready' || filterCount !== target || resolution !== 'compatible')
    return false;
  if (status === 'collecting') return acquisition === 'assigned' && count < target;
  if (status === 'agreed') return acquisition === 'assigned' && count === target;
  if (status === 'advancing') return acquisition === 'pending' && count === 0;
  return status === 'exhausted' && acquisition === 'no_candidates' && count === 0;
}
const fields = ['outcome', 'room_id', 'room_code', 'room_state', 'is_creator', 'is_voter', 'voter_count', 'required_voter_count','filter_completed_count','filter_resolution_status','candidate_acquisition_status','candidate_progression_status','candidate_sequence','decision_completed_count'] as const satisfies readonly (keyof GeneratedRow)[];
function oneRow(data: unknown, objectResponse = false): Record<keyof GeneratedRow, unknown> {
  if (objectResponse) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new RoomContractError();
    const row = data as Record<string, unknown>;
    if (Object.keys(row).length !== fields.length || !fields.every(key => Object.hasOwn(row, key)))
      throw new RoomContractError();
    return row as Record<keyof GeneratedRow, unknown>;
  }
  if (!Array.isArray(data) || data.length !== 1) throw new RoomContractError();
  const row: unknown = data[0];
  if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).length !== fields.length ||
    !fields.every(key => Object.hasOwn(row, key))) throw new RoomContractError();
  return row as Record<keyof GeneratedRow, unknown>;
}
function accepted(row: Record<keyof GeneratedRow, unknown>): void {
  if (!isRoomId(row.room_id) || typeof row.room_code !== 'string' || normalizeRoomCode(row.room_code) !== row.room_code ||
    typeof row.is_creator !== 'boolean' || typeof row.is_voter !== 'boolean' || !row.is_creator && !row.is_voter ||
    !validVoterCounts(row.voter_count, row.required_voter_count, row.room_state)
    ||!validFilterCount(row.filter_completed_count,row.required_voter_count,row.room_state)
    ||!validResolutionStatus(row.filter_resolution_status,row.filter_completed_count,
      row.required_voter_count,row.room_state)
    ||!validCandidateStatus(row.candidate_acquisition_status,row.filter_resolution_status,
      row.filter_completed_count,row.required_voter_count,row.room_state)
    ||!validDecisionCount(row.decision_completed_count,row.required_voter_count,row.room_state,
      row.filter_completed_count,row.filter_resolution_status,row.candidate_acquisition_status)
    ||!validProgression(row.candidate_progression_status,row.candidate_sequence,
      row.decision_completed_count,row.required_voter_count,row.candidate_acquisition_status,
      row.room_state,row.filter_completed_count,row.filter_resolution_status)
    || row.is_voter && row.voter_count === 0) {
    throw new RoomContractError();
  }
}
export function narrowCreateResult(data: unknown): CreateResult {
  const row = oneRow(data, true);
  accepted(row);
  if (!row.is_creator || !(row.outcome === 'already_created' || row.outcome === 'created' &&
    row.room_state === 'waiting' && row.voter_count === (row.is_voter ? 1 : 0)
    &&row.filter_completed_count===0&&row.filter_resolution_status==='pending'
    &&row.candidate_acquisition_status==='pending'&&row.candidate_progression_status==='inactive'
    &&row.candidate_sequence===0&&row.decision_completed_count===0)) throw new RoomContractError();
  return row as CreateResult;
}
export function narrowJoinResult(data: unknown): JoinResult {
  const row = oneRow(data);
  if (row.outcome === 'invalid_code' || row.outcome === 'not_found' || row.outcome === 'full') {
    if (!fields.filter(key => key !== 'outcome').every(key => row[key] === null)) throw new RoomContractError();
  } else {
    accepted(row);
    if (!(row.outcome === 'already_member' || row.outcome === 'joined' && !row.is_creator && row.is_voter)) throw new RoomContractError();
  }
  return row as JoinResult;
}
