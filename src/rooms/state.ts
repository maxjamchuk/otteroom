import type { AcceptedRoomResult, CandidateAcquisitionStatus, JoinResult, RoomResolutionStatus } from './contracts';
import { RoomContractError, validCandidateStatus, validFilterCount, validResolutionStatus, validVoterCounts } from './contracts';
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
    filterResolutionStatus:result.filter_resolution_status,
    resolutionIntegrityError:false,
    candidateAcquisitionStatus:result.candidate_acquisition_status,
    candidateIntegrityError:false,
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

export function applyRoomResolutionStatus(current: AcceptedRoomState,
  status: RoomResolutionStatus): AcceptedRoomState {
  if (!validResolutionStatus(status, current.filterCompletedCount,
      current.requiredVoterCount, current.state)) throw new RoomContractError();
  if (current.resolutionIntegrityError) return current;
  if (status === 'pending' || status === current.filterResolutionStatus) return current;
  if (current.filterResolutionStatus !== 'pending') {
    return { ...current, resolutionIntegrityError: true };
  }
  return { ...current, filterResolutionStatus: status };
}

export function applyRoomCandidateStatus(current: AcceptedRoomState,
  status: CandidateAcquisitionStatus): AcceptedRoomState {
  if (!validCandidateStatus(status, current.filterResolutionStatus, current.filterCompletedCount,
      current.requiredVoterCount, current.state)) throw new RoomContractError();
  if (current.candidateIntegrityError || status === 'pending' ||
      status === current.candidateAcquisitionStatus) return current;
  if (current.candidateAcquisitionStatus !== 'pending')
    return { ...current, candidateIntegrityError: true };
  return { ...current, candidateAcquisitionStatus: status };
}

export function applyRoomRefetch(current: AcceptedRoomState, row: RoomProjection): AcceptedRoomState {
  if (current.id !== row.id || current.code !== row.code || current.requiredVoterCount !== row.required_voter_count ||
    !validVoterCounts(row.voter_count, row.required_voter_count, row.state) ||
    !validFilterCount(row.filter_completed_count, row.required_voter_count, row.state) ||
    !validResolutionStatus(row.filter_resolution_status,row.filter_completed_count,
      row.required_voter_count,row.state) ||
    !validCandidateStatus(row.candidate_acquisition_status,row.filter_resolution_status,
      row.filter_completed_count,row.required_voter_count,row.state) ||
    current.isVoter && row.voter_count === 0) throw new RoomContractError();
  // Membership is fixed: delayed authoritative reads cannot undo observed admissions.
  const voterCount=Math.max(current.voterCount,row.voter_count);
  const filterCompletedCount = Math.max(current.filterCompletedCount, row.filter_completed_count);
  const state=voterCount===current.requiredVoterCount?'ready' as const:'waiting' as const;
  let filterResolutionStatus=current.filterResolutionStatus;
  let resolutionIntegrityError=current.resolutionIntegrityError;
  let candidateAcquisitionStatus=current.candidateAcquisitionStatus;
  let candidateIntegrityError=current.candidateIntegrityError;
  if(!resolutionIntegrityError&&row.filter_resolution_status!=='pending'){
    if(filterResolutionStatus==='pending')filterResolutionStatus=row.filter_resolution_status;
    else if(filterResolutionStatus!==row.filter_resolution_status)resolutionIntegrityError=true;
  }
  if(!candidateIntegrityError&&row.candidate_acquisition_status!=='pending'){
    if(candidateAcquisitionStatus==='pending')candidateAcquisitionStatus=row.candidate_acquisition_status;
    else if(candidateAcquisitionStatus!==row.candidate_acquisition_status)candidateIntegrityError=true;
  }
  if(voterCount===current.voterCount&&filterCompletedCount===current.filterCompletedCount
    &&filterResolutionStatus===current.filterResolutionStatus
    &&resolutionIntegrityError===current.resolutionIntegrityError
    &&candidateAcquisitionStatus===current.candidateAcquisitionStatus
    &&candidateIntegrityError===current.candidateIntegrityError)return current;
  return { ...current,state,title:state==='ready'?'Ready':'Waiting',voterCount,filterCompletedCount,
    filtersComplete:filterCompletedCount===current.requiredVoterCount,filterResolutionStatus,
    resolutionIntegrityError,candidateAcquisitionStatus,candidateIntegrityError };
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
