import type { AcceptedRoomResult, JoinResult } from './contracts';
import { RoomContractError, validFilterCount, validVoterCounts } from './contracts';
import type { RoomProjection } from './service';

export function acceptedRoomState(result: AcceptedRoomResult) {
  return {
    kind: 'accepted' as const,
    id: result.room_id,
    code: result.room_code,
    isCreator: result.is_creator,
    isVoter: result.is_voter,
    state: result.room_state,
    title: result.room_state === 'waiting' ? 'Waiting' : 'Ready',
    voterCount: result.voter_count,
    requiredVoterCount: result.required_voter_count,
    filterCompletedCount:result.filter_completed_count,
    filtersComplete:result.filter_completed_count===result.required_voter_count,
  };
}
export type AcceptedRoomState = ReturnType<typeof acceptedRoomState>;

export function applyRoomFilterProgress(current: AcceptedRoomState, count: number): AcceptedRoomState {
  if (!Number.isInteger(count) || count < 0 || count > current.requiredVoterCount ||
      count > 0 && current.state !== 'ready') throw new RoomContractError();
  const filterCompletedCount = Math.max(current.filterCompletedCount, count);
  if (filterCompletedCount === current.filterCompletedCount) return current;
  return { ...current, filterCompletedCount,
    filtersComplete: filterCompletedCount === current.requiredVoterCount };
}

export function applyRoomRefetch(current: AcceptedRoomState, row: RoomProjection): AcceptedRoomState {
  if (current.id !== row.id || current.code !== row.code || current.requiredVoterCount !== row.required_voter_count ||
    !validVoterCounts(row.voter_count, row.required_voter_count, row.state) ||
    !validFilterCount(row.filter_completed_count, row.required_voter_count, row.state) ||
    current.isVoter && row.voter_count === 0) throw new RoomContractError();
  // Membership is fixed: delayed authoritative reads cannot undo observed admissions.
  const voterCount=Math.max(current.voterCount,row.voter_count);
  const filterCompletedCount = Math.max(current.filterCompletedCount, row.filter_completed_count);
  const state=voterCount===current.requiredVoterCount?'ready' as const:'waiting' as const;
  if(voterCount===current.voterCount&&filterCompletedCount===current.filterCompletedCount)return current;
  return { ...current,state,title:state==='ready'?'Ready':'Waiting',voterCount,filterCompletedCount,
    filtersComplete:filterCompletedCount===current.requiredVoterCount };
}
export function createErrorState() {
  return { kind: 'error' as const, message: 'Unable to create your room. Please try again.' };
}
export function malformedInvitationState() {
  return { kind: 'malformed' as const, message: 'Malformed invitation. Enter a valid room code.' };
}
export function joinErrorState() {
  return { kind: 'error' as const, message: 'Unable to open this room. Please try again.' };
}
export function joinRoomState(result: JoinResult) {
  switch (result.outcome) {
    case 'joined':
    case 'already_member': return acceptedRoomState(result);
    case 'invalid_code': return malformedInvitationState();
    case 'not_found': return { kind: 'not-found' as const, message: 'Room not found. Check your invitation.' };
    case 'full': return { kind: 'full' as const, message: 'Room Full. The voting group is already assembled.' };
  }
}
