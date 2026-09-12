import type { AcceptedRoomState } from '../rooms/state';
import type { ResolutionResult, ResolutionStatus } from './contracts';

export type ResolutionRequest = { roomId: string | null; generation: number };
export type ResolutionAttempt = 'inactive' | 'resolving' | 'error' | 'integrity-error';
export type CommonFilterResolutionState = {
  request: ResolutionRequest;
  status: ResolutionStatus | null;
  attempt: ResolutionAttempt;
  message: string | null;
};

const failureMessage = 'Unable to resolve common filters. Please try again.';
const integrityMessage = 'Unable to verify common-filter status. Reload the room and try again.';

function eligible(room: AcceptedRoomState): boolean {
  return room.state === 'ready' && room.filterCompletedCount === room.requiredVoterCount &&
    room.filterResolutionStatus === 'pending' && !room.resolutionIntegrityError;
}

export function createResolutionState(room: AcceptedRoomState | null,
  generation = 0): CommonFilterResolutionState {
  if (!room) return { request: { roomId: null, generation }, status: null,
    attempt: 'inactive', message: null };
  if (room.resolutionIntegrityError) return { request: { roomId: room.id, generation },
    status: room.filterResolutionStatus, attempt: 'integrity-error', message: integrityMessage };
  return { request: { roomId: room.id, generation }, status: room.filterResolutionStatus,
    attempt: eligible(room) ? 'resolving' : 'inactive', message: null };
}

export function sameResolutionRequest(left: ResolutionRequest, right: ResolutionRequest): boolean {
  return left.roomId === right.roomId && left.generation === right.generation;
}

export function failResolution(current: CommonFilterResolutionState,
  request: ResolutionRequest): CommonFilterResolutionState {
  if (!sameResolutionRequest(current.request, request) || current.attempt !== 'resolving' ||
      current.status !== 'pending') return current;
  return { ...current, attempt: 'error', message: failureMessage };
}

export function receiveResolutionResult(current: CommonFilterResolutionState,
  request: ResolutionRequest, result: ResolutionResult): CommonFilterResolutionState {
  if (!sameResolutionRequest(current.request, request) || current.attempt === 'integrity-error') return current;
  if (result.outcome === 'not_found' || result.filter_resolution_status === 'pending') {
    return failResolution(current, request);
  }
  const status = result.filter_resolution_status;
  if (current.status === status && current.attempt === 'inactive' && current.message === null) return current;
  if (current.status !== 'pending' && current.status !== status) {
    return { ...current, attempt: 'integrity-error', message: integrityMessage };
  }
  return { ...current, status, attempt: 'inactive', message: null };
}

export function retryResolution(current: CommonFilterResolutionState): CommonFilterResolutionState {
  if (current.status !== 'pending' || current.attempt !== 'error') return current;
  return { ...current, request: { ...current.request, generation: current.request.generation + 1 },
    attempt: 'resolving', message: null };
}

export function syncResolutionRoom(current: CommonFilterResolutionState,
  room: AcceptedRoomState | null): CommonFilterResolutionState {
  if (current.request.roomId !== (room?.id ?? null)) {
    return createResolutionState(room, current.request.generation + 1);
  }
  if (!room) return current;
  // A terminal disagreement is generation-fatal. Only a newly mounted room
  // entry (or a different room ID) creates a fresh model that may clear it.
  if (current.attempt === 'integrity-error') return current;
  if (room.resolutionIntegrityError) {
    return { ...current, status: room.filterResolutionStatus,
      attempt: 'integrity-error', message: integrityMessage };
  }
  const incoming = room.filterResolutionStatus;
  if (incoming !== 'pending') {
    if (current.status !== 'pending' && current.status !== incoming) {
      return { ...current, attempt: 'integrity-error', message: integrityMessage };
    }
    if (current.status === incoming && current.attempt === 'inactive' && current.message === null) return current;
    return { ...current, status: incoming, attempt: 'inactive', message: null };
  }
  if (current.status !== 'pending') return current;
  if (eligible(room) && current.attempt === 'inactive') {
    return { ...current, attempt: 'resolving', message: null };
  }
  if (!eligible(room) && current.attempt !== 'inactive') {
    return { ...current, attempt: 'inactive', message: null };
  }
  return current;
}
