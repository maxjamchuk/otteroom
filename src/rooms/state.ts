import type { AcceptedRoomResult, CandidateAcquisitionStatus, CandidateProgressionStatus, JoinResult, RoomResolutionStatus } from './contracts';
import { RoomContractError, validCandidateStatus, validDecisionCount, validFilterCount, validProgression, validResolutionStatus, validVoterCounts } from './contracts';
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
    candidateProgressionStatus:result.candidate_progression_status,
    candidateSequence:result.candidate_sequence,
    candidateIntegrityError:false,
    decisionCompletedCount:result.decision_completed_count,
  };
}
export type AcceptedRoomState = ReturnType<typeof acceptedRoomState>;

type ProgressionNode = Readonly<{ status: CandidateProgressionStatus; sequence: number; count: number;
  acquisition: CandidateAcquisitionStatus }>;

function reachable(from: ProgressionNode, to: ProgressionNode): boolean {
  if (from.status === to.status && from.sequence === to.sequence && from.count === to.count &&
      from.acquisition === to.acquisition) return true;
  if (from.status === 'agreed' || from.status === 'exhausted') return false;
  if (from.status === 'inactive') {
    if (from.acquisition === 'no_candidates') return false;
    return to.status === 'inactive' ? to.acquisition === 'no_candidates' : true;
  }
  if (to.sequence < from.sequence) return false;
  if (to.sequence > from.sequence) return from.status === 'collecting' || from.status === 'advancing';
  if (from.status === 'collecting') return to.status === 'collecting' && to.count >= from.count ||
    to.status === 'agreed' || to.status === 'advancing' || to.status === 'exhausted';
  return from.status === 'advancing' && to.status === 'exhausted';
}

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
    !validDecisionCount(row.decision_completed_count,row.required_voter_count,row.state,
      row.filter_completed_count,row.filter_resolution_status,row.candidate_acquisition_status) ||
    !validProgression(row.candidate_progression_status,row.candidate_sequence,
      row.decision_completed_count,row.required_voter_count,row.candidate_acquisition_status,
      row.state,row.filter_completed_count,row.filter_resolution_status) ||
    current.isVoter && row.voter_count === 0) throw new RoomContractError();
  // Membership is fixed: delayed authoritative reads cannot undo observed admissions.
  const voterCount=Math.max(current.voterCount,row.voter_count);
  const filterCompletedCount = Math.max(current.filterCompletedCount, row.filter_completed_count);
  const state=voterCount===current.requiredVoterCount?'ready' as const:'waiting' as const;
  let filterResolutionStatus=current.filterResolutionStatus;
  let resolutionIntegrityError=current.resolutionIntegrityError;
  const candidateIntegrityError=current.candidateIntegrityError;
  const localNode={status:current.candidateProgressionStatus,sequence:current.candidateSequence,
    count:current.decisionCompletedCount,acquisition:current.candidateAcquisitionStatus};
  const incomingNode={status:row.candidate_progression_status,sequence:row.candidate_sequence,
    count:row.decision_completed_count,acquisition:row.candidate_acquisition_status};
  const forward=reachable(localNode,incomingNode);
  if(!forward&&!reachable(incomingNode,localNode))throw new RoomContractError();
  const progression=forward?incomingNode:localNode;
  const candidateAcquisitionStatus=forward
    ?row.candidate_acquisition_status:current.candidateAcquisitionStatus;
  const decisionCompletedCount=progression.count;
  if(!resolutionIntegrityError&&row.filter_resolution_status!=='pending'){
    if(filterResolutionStatus==='pending')filterResolutionStatus=row.filter_resolution_status;
    else if(filterResolutionStatus!==row.filter_resolution_status)resolutionIntegrityError=true;
  }
  if(voterCount===current.voterCount&&filterCompletedCount===current.filterCompletedCount
    &&filterResolutionStatus===current.filterResolutionStatus
    &&resolutionIntegrityError===current.resolutionIntegrityError
    &&candidateAcquisitionStatus===current.candidateAcquisitionStatus
    &&candidateIntegrityError===current.candidateIntegrityError
    &&decisionCompletedCount===current.decisionCompletedCount
    &&progression.status===current.candidateProgressionStatus
    &&progression.sequence===current.candidateSequence)return current;
  return { ...current,state,title:state==='ready'?'Ready':'Waiting',voterCount,filterCompletedCount,
    filtersComplete:filterCompletedCount===current.requiredVoterCount,filterResolutionStatus,
    resolutionIntegrityError,candidateAcquisitionStatus,candidateIntegrityError,
    candidateProgressionStatus:progression.status,candidateSequence:progression.sequence,
    decisionCompletedCount };
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
