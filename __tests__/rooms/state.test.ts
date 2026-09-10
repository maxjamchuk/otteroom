import { acceptedRoomState, applyRoomRefetch, createErrorState, joinRoomState, joinErrorState, malformedInvitationState } from '../../src/rooms/state';
import { narrowCreateResult, narrowJoinResult } from '../../src/rooms/contracts';

const row = { outcome: 'created', room_id: '11111111-1111-4111-8111-111111111111', room_code: 'ABCDEF0123',
  is_creator: true, is_voter: true, room_state: 'waiting', voter_count: 1, required_voter_count: 3 };
it.each([[true,true],[true,false],[false,true]] as const)('projects independent creator=%s/voter=%s with actual counts', (is_creator,is_voter) => {
  for(const voter_count of [is_voter?1:0,2,3]) {
    const room_state=voter_count===3?'ready':'waiting';
    const result=narrowJoinResult([{...row,outcome:'already_member',is_creator,is_voter,voter_count,room_state}]);
    expect(joinRoomState(result)).toEqual({kind:'accepted',id:row.room_id,code:row.room_code,
      isCreator:is_creator,isVoter:is_voter,state:room_state,title:room_state==='ready'?'Ready':'Waiting',voterCount:voter_count,requiredVoterCount:3});
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
  const result = narrowJoinResult([{ outcome, room_id: null, room_code: null, room_state: null, is_creator:null,is_voter:null,voter_count:null,required_voter_count:null }]);
  expect(joinRoomState(result)).toEqual({ kind, message });
});
it('distinguishes local malformed input from generic infrastructure failure', () => {
  expect(malformedInvitationState()).toEqual({ kind: 'malformed', message: 'Malformed invitation. Enter a valid room code.' });
  expect(joinErrorState()).toEqual({ kind: 'error', message: 'Unable to open this room. Please try again.' });
});
const waiting=acceptedRoomState(narrowCreateResult([row]));
const projection=(count:number)=>({id:row.room_id,code:row.room_code,state:count===3?'ready' as const:'waiting' as const,voter_count:count,required_voter_count:3});
it('advances intermediate Waiting monotonically, retaining immutable flags and target',()=>{
  const middle=applyRoomRefetch(waiting,projection(2));
  expect(middle).toEqual({...waiting,voterCount:2});
  expect(applyRoomRefetch(middle,projection(1))).toBe(middle);
  expect(applyRoomRefetch(middle,projection(2))).toEqual(middle);
  const ready=applyRoomRefetch(middle,projection(3));
  expect(ready).toEqual({...middle,voterCount:3,state:'ready',title:'Ready'});
  expect(applyRoomRefetch(ready,projection(2))).toBe(ready);
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
it.each([
  {id:'other'},{code:'012345ABCD'},{required_voter_count:4},{required_voter_count:1},
  {voter_count:-1},{voter_count:4},{voter_count:1.5},{voter_count:0},
  {state:'ready' as const,voter_count:2},{state:'waiting' as const,voter_count:3},
])('rejects inconsistent/mismatched read %# without changing accepted state',patch=>{
  const before={...waiting};expect(()=>applyRoomRefetch(waiting,{...projection(2),...patch})).toThrow();expect(waiting).toEqual(before);
});
