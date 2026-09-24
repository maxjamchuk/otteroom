import { acceptedRoomState, applyRoomCandidateStatus, applyRoomFilterProgress, applyRoomRefetch, applyRoomResolutionStatus, createErrorState, joinRoomState, joinErrorState, malformedInvitationState } from '../../src/rooms/state';
import { narrowCreateResult, narrowJoinResult } from '../../src/rooms/contracts';

const row = { outcome: 'created', room_id: '11111111-1111-4111-8111-111111111111', room_code: 'ABCDEF0123',
  is_creator: true, is_voter: true, room_state: 'waiting', voter_count: 1, required_voter_count: 3,
  filter_completed_count: 0, filter_resolution_status: 'pending', candidate_acquisition_status: 'pending',
  candidate_progression_status: 'inactive', candidate_sequence: 0, decision_completed_count: 0 } as const;
it.each([[true,true],[true,false],[false,true]] as const)('projects independent creator=%s/voter=%s with actual counts', (is_creator,is_voter) => {
  for(const voter_count of [is_voter?1:0,2,3]) {
    const room_state=voter_count===3?'ready':'waiting';
    const result=narrowJoinResult([{...row,outcome:'already_member',is_creator,is_voter,voter_count,room_state}]);
    expect(joinRoomState(result)).toEqual({kind:'accepted',id:row.room_id,code:row.room_code,
      isCreator:is_creator,isVoter:is_voter,state:room_state,title:room_state==='ready'?'Ready':'Waiting',voterCount:voter_count,requiredVoterCount:3,
      filterCompletedCount:0,filtersComplete:false,filterResolutionStatus:'pending',
      resolutionIntegrityError:false,candidateAcquisitionStatus:'pending',candidateIntegrityError:false,
      candidateProgressionStatus:'inactive',candidateSequence:0,decisionCompletedCount:0});
  }
});
it('create failure contains only generic retry presentation, never a room/invitation', () => {
  expect(createErrorState()).toEqual({ kind: 'error', message: 'Unable to create your room. Please try again.' });
});
it.each([
  ['invalid_code', 'malformed', 'Malformed invitation. Enter a valid room code.'],
  ['not_found', 'not-found', 'Room not found. Check your invitation.'],
  ['full', 'full', 'Room Full. The voting group is already assembled.'],
])('maps %s with no room projection', (outcome, kind, message) => {
  const result = narrowJoinResult([{ outcome, room_id: null, room_code: null, room_state: null, is_creator:null,is_voter:null,voter_count:null,required_voter_count:null,filter_completed_count:null,filter_resolution_status:null,candidate_acquisition_status:null,candidate_progression_status:null,candidate_sequence:null,decision_completed_count:null }]);
  expect(joinRoomState(result)).toEqual({ kind, message });
});
it('distinguishes local malformed input from generic infrastructure failure', () => {
  expect(malformedInvitationState()).toEqual({ kind: 'malformed', message: 'Malformed invitation. Enter a valid room code.' });
  expect(joinErrorState()).toEqual({ kind: 'error', message: 'Unable to open this room. Please try again.' });
});
const waiting=acceptedRoomState(narrowCreateResult(row));
const projection=(count:number)=>({id:row.room_id,code:row.room_code,state:count===3?'ready' as const:'waiting' as const,voter_count:count,required_voter_count:3,filter_completed_count:0,filter_resolution_status:'pending' as const,candidate_acquisition_status:'pending' as const,candidate_progression_status:'inactive' as const,candidate_sequence:0,decision_completed_count:0});
it('advances intermediate Waiting monotonically, retaining immutable flags and target',()=>{
  const middle=applyRoomRefetch(waiting,projection(2));
  expect(middle).toEqual({...waiting,voterCount:2});
  expect(applyRoomRefetch(middle,projection(1))).toBe(middle);
  expect(applyRoomRefetch(middle,projection(2))).toEqual(middle);
  const ready=applyRoomRefetch(middle,projection(3));
  expect(ready).toEqual({...middle,voterCount:3,state:'ready',title:'Ready'});
  expect(applyRoomRefetch(ready,projection(2))).toBe(ready);
});

describe('candidate terminal watermark',()=>{
  const compatible={...waiting,state:'ready' as const,title:'Ready',voterCount:3,
    filterCompletedCount:3,filtersComplete:true,filterResolutionStatus:'compatible' as const};
  it.each(['assigned','no_candidates'] as const)('advances pending to %s and suppresses delayed pending',status=>{
    const terminal=applyRoomCandidateStatus(compatible,status);
    expect(terminal.candidateAcquisitionStatus).toBe(status);
    expect(applyRoomCandidateStatus(terminal,status)).toBe(terminal);
    expect(applyRoomCandidateStatus(terminal,'pending')).toBe(terminal);
  });
  it('fails closed when both incomparable terminals are observed',()=>{
    const assigned=applyRoomCandidateStatus(compatible,'assigned');
    expect(applyRoomCandidateStatus(assigned,'no_candidates')).toEqual({...assigned,candidateIntegrityError:true});
  });
});
describe('decision completion watermark',()=>{
  const assigned={...waiting,state:'ready' as const,title:'Ready',voterCount:3,
    filterCompletedCount:3,filtersComplete:true,filterResolutionStatus:'compatible' as const,
    candidateAcquisitionStatus:'assigned' as const,candidateProgressionStatus:'collecting' as const,
    candidateSequence:1};
  const assignedProjection={...projection(3),filter_completed_count:3,
    filter_resolution_status:'compatible' as const,candidate_acquisition_status:'assigned' as const,
    candidate_progression_status:'collecting' as const,candidate_sequence:1};
  it('merges valid current-candidate progress monotonically',()=>{
    const one=applyRoomRefetch(assigned,{...assignedProjection,decision_completed_count:1});
    const two=applyRoomRefetch(one,{...assignedProjection,decision_completed_count:2});
    const complete=applyRoomRefetch(two,{...assignedProjection,decision_completed_count:3,
      candidate_progression_status:'agreed'});
    expect(one.decisionCompletedCount).toBe(1);
    expect(two.decisionCompletedCount).toBe(2);
    expect(complete.decisionCompletedCount).toBe(3);
    expect(applyRoomRefetch(two,{...assignedProjection,decision_completed_count:1})).toBe(two);
  });
  it.each([-1,4,1.5])('rejects invalid count %s',decision_completed_count=>{
    expect(()=>applyRoomRefetch(assigned,{...assignedProjection,decision_completed_count})).toThrow();
  });
  it('rejects positive progress before an assigned compatible candidate',()=>{
    expect(()=>applyRoomRefetch(waiting,{...projection(1),decision_completed_count:1})).toThrow();
  });
});
it.each([[true,true],[true,false],[false,true]] as const)('never regresses Ready for creator=%s/voter=%s', (isCreator,isVoter)=>{
  const ready={...waiting,state:'ready' as const,title:'Ready',voterCount:3,isCreator,isVoter};
  expect(applyRoomRefetch(ready,projection(1))).toBe(ready);
  expect(applyRoomRefetch(ready,projection(3))).toEqual(ready);
});
it('keeps non-voting creator at zero until authoritative voter admission',()=>{
  const zero={...waiting,isVoter:false,voterCount:0};
  expect(applyRoomRefetch(zero,projection(0))).toEqual(zero);
  expect(applyRoomRefetch(zero,projection(1))).toEqual({...zero,voterCount:1});
});
it('merges filter progress monotonically from every validated same-room authority and freezes N/N',()=>{
  const assembled={...waiting,state:'ready' as const,title:'Ready',voterCount:3};
  const one=applyRoomFilterProgress(assembled,1),two=applyRoomFilterProgress(one,2);
  expect(one.filterCompletedCount).toBe(1);expect(two.filterCompletedCount).toBe(2);
  expect(applyRoomFilterProgress(two,1)).toBe(two);
  const complete=applyRoomFilterProgress(two,3);
  expect(complete.filtersComplete).toBe(true);expect(complete.filterCompletedCount).toBe(3);
  expect(applyRoomFilterProgress(complete,2)).toBe(complete);
});
it.each([
  {id:'other'},{code:'012345ABCD'},{required_voter_count:4},{required_voter_count:1},
  {voter_count:-1},{voter_count:4},{voter_count:1.5},{voter_count:0},
  {state:'ready' as const,voter_count:2},{state:'waiting' as const,voter_count:3},
])('rejects inconsistent/mismatched read %# without changing accepted state',patch=>{
  const before={...waiting};expect(()=>applyRoomRefetch(waiting,{...projection(2),...patch})).toThrow();expect(waiting).toEqual(before);
});

describe('resolution watermark',()=>{
  const frozen={...waiting,state:'ready' as const,title:'Ready',voterCount:3,
    filterCompletedCount:3,filtersComplete:true};
  it.each(['compatible','incompatible'] as const)('advances pending to terminal %s and suppresses delayed pending',status=>{
    const terminal=applyRoomResolutionStatus(frozen,status);
    expect(terminal).toEqual({...frozen,filterResolutionStatus:status});
    expect(applyRoomResolutionStatus(terminal,status)).toBe(terminal);
    expect(applyRoomResolutionStatus(terminal,'pending')).toBe(terminal);
    expect(applyRoomRefetch(terminal,{...projection(3),filter_completed_count:2,
      filter_resolution_status:'pending'})).toBe(terminal);
  });
  it('rejects terminal meaning before frozen Ready N/N',()=>{
    expect(()=>applyRoomResolutionStatus(waiting,'compatible')).toThrow();
    expect(()=>applyRoomRefetch(waiting,{...projection(2),filter_resolution_status:'incompatible'})).toThrow();
  });
  it('fails closed on incomparable terminals and never clears the overlay in this generation',()=>{
    const compatible=applyRoomResolutionStatus(frozen,'compatible');
    const conflict=applyRoomResolutionStatus(compatible,'incompatible');
    expect(conflict).toEqual({...compatible,resolutionIntegrityError:true});
    expect(applyRoomResolutionStatus(conflict,'compatible')).toBe(conflict);
    expect(applyRoomRefetch(conflict,{...projection(3),filter_completed_count:3,
      filter_resolution_status:'compatible'})).toBe(conflict);
  });
});

describe('candidate progression reachability lattice',()=>{
  const compatible={...waiting,state:'ready' as const,title:'Ready',voterCount:3,
    filterCompletedCount:3,filtersComplete:true,filterResolutionStatus:'compatible' as const};
  const read=(candidate_progression_status:'inactive'|'collecting'|'advancing'|'agreed'|'exhausted',
    candidate_sequence:number,decision_completed_count:number)=>({id:row.room_id,code:row.room_code,
      state:'ready' as const,voter_count:3,required_voter_count:3,filter_completed_count:3,
      filter_resolution_status:'compatible' as const,candidate_progression_status,candidate_sequence,
      decision_completed_count,candidate_acquisition_status:candidate_progression_status==='collecting'||
        candidate_progression_status==='agreed'?'assigned' as const:
        candidate_progression_status==='exhausted'?'no_candidates' as const:'pending' as const});

  it('adopts P0 to E0 or first collecting and ignores their reverse stale P0',()=>{
    const e0=applyRoomRefetch(compatible,read('inactive',0,0));
    expect(e0.candidateAcquisitionStatus).toBe('pending');
    const empty=applyRoomRefetch(e0,{...read('inactive',0,0),candidate_acquisition_status:'no_candidates'});
    expect(empty.candidateAcquisitionStatus).toBe('no_candidates');
    const c1=applyRoomRefetch(compatible,read('collecting',1,0));
    expect(c1).toMatchObject({candidateProgressionStatus:'collecting',candidateSequence:1,
      decisionCompletedCount:0});
    expect(applyRoomRefetch(c1,read('inactive',0,0))).toBe(c1);
  });

  it('replaces counts within an occurrence and across a successor instead of using global max',()=>{
    const c1=applyRoomRefetch(compatible,read('collecting',1,0));
    const c1two=applyRoomRefetch(c1,read('collecting',1,2));
    const advancing=applyRoomRefetch(c1two,read('advancing',1,0));
    const c2=applyRoomRefetch(advancing,read('collecting',2,0));
    expect(c1two.decisionCompletedCount).toBe(2);
    expect(advancing.decisionCompletedCount).toBe(0);
    expect(c2).toMatchObject({candidateSequence:2,decisionCompletedCount:0});
    expect(applyRoomRefetch(c2,read('collecting',1,2))).toBe(c2);
  });

  it('adopts missed advancing, exhaustion, terminals, and multi-sequence forward jumps',()=>{
    const c1=applyRoomRefetch(compatible,read('collecting',1,1));
    expect(applyRoomRefetch(c1,read('exhausted',1,0)).candidateProgressionStatus).toBe('exhausted');
    expect(applyRoomRefetch(c1,read('agreed',1,3)).candidateProgressionStatus).toBe('agreed');
    expect(applyRoomRefetch(c1,read('collecting',4,0))).toMatchObject({candidateSequence:4,
      decisionCompletedCount:0});
  });

  it('fails closed for incomparable lower terminals versus newer authority',()=>{
    const empty={...compatible,candidateAcquisitionStatus:'no_candidates' as const};
    expect(()=>applyRoomRefetch(empty,read('collecting',2,0))).toThrow();
    const agreed=applyRoomRefetch(compatible,read('agreed',1,3));
    expect(()=>applyRoomRefetch(agreed,read('collecting',2,0))).toThrow();
  });
});
