import type { AcceptedRoomResult, JoinResult } from './contracts';

export function acceptedRoomState(result: AcceptedRoomResult) {
  return {
    kind: 'accepted' as const,
    id: result.room_id,
    code: result.room_code,
    role: result.participant_role,
    state: result.room_state,
    title: result.room_state === 'waiting' ? 'Waiting' : 'Ready',
    count: result.participant_count,
  };
}
export type AcceptedRoomState = ReturnType<typeof acceptedRoomState>;
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
    case 'full': return { kind: 'full' as const, message: 'Room Full. This room already has two participants.' };
  }
}
