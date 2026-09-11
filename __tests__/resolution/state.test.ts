import {
  createResolutionState, failResolution, receiveResolutionResult, retryResolution,
  sameResolutionRequest, syncResolutionRoom,
} from '../../src/resolution/state';
import type { AcceptedRoomState } from '../../src/rooms/state';

const pending: AcceptedRoomState = {
  kind: 'accepted', id: '11111111-1111-4111-8111-111111111111', code: 'ABCDEF0123',
  isCreator: true, isVoter: true, state: 'ready', title: 'Ready', voterCount: 2,
  requiredVoterCount: 2, filterCompletedCount: 2, filtersComplete: true,
  filterResolutionStatus: 'pending', resolutionIntegrityError: false,
};

it('is inactive without exact Ready N/N pending authority', () => {
  expect(createResolutionState(null)).toMatchObject({ status: null, attempt: 'inactive' });
  for (const room of [
    { ...pending, state: 'waiting' as const, title: 'Waiting' as const, voterCount: 1,
      filterCompletedCount: 0, filtersComplete: false },
    { ...pending, filterCompletedCount: 1, filtersComplete: false },
    { ...pending, filterResolutionStatus: 'compatible' as const },
    { ...pending, filterResolutionStatus: 'incompatible' as const },
  ]) expect(createResolutionState(room)).toMatchObject({ attempt: 'inactive',
    status: room.filterResolutionStatus });
});

it('begins one generation-scoped attempt only at Ready N/N pending', () => {
  const state = createResolutionState(pending, 7);
  expect(state).toEqual({ request: { roomId: pending.id, generation: 7 }, status: 'pending',
    attempt: 'resolving', message: null });
  expect(sameResolutionRequest(state.request, { ...state.request })).toBe(true);
  expect(sameResolutionRequest(state.request, { ...state.request, generation: 8 })).toBe(false);
});

it('adopts compatible without deriving or storing resolved constraints', () => {
  const state = createResolutionState(pending);
  const next = receiveResolutionResult(state, state.request,
    { outcome: 'compatible', filter_resolution_status: 'compatible' });
  expect(next).toEqual({ ...state, status: 'compatible', attempt: 'inactive', message: null });
  expect(JSON.stringify(next)).not.toMatch(/releaseYear|genre|clause|candidate|member|user/i);
  expect(receiveResolutionResult(next, next.request,
    { outcome: 'compatible', filter_resolution_status: 'compatible' })).toBe(next);
});

it('turns unexpected pending and operational failure into one retryable overlay, never incompatible', () => {
  const state = createResolutionState(pending);
  const unexpected = receiveResolutionResult(state, state.request,
    { outcome: 'pending', filter_resolution_status: 'pending' });
  expect(unexpected).toEqual({ ...state, attempt: 'error',
    message: 'Unable to resolve common filters. Please try again.' });
  expect(failResolution(state, state.request)).toEqual(unexpected);
  const retry = retryResolution(unexpected);
  expect(retry).toEqual({ ...state, request: { ...state.request, generation: 1 } });
});

it('ignores stale results and terminal room authority clears a transient error', () => {
  const state = createResolutionState(pending);
  const error = failResolution(state, state.request);
  expect(receiveResolutionResult(error, { ...state.request, generation: 99 },
    { outcome: 'incompatible', filter_resolution_status: 'incompatible' })).toBe(error);
  expect(syncResolutionRoom(error, { ...pending, filterResolutionStatus: 'compatible' }))
    .toEqual({ ...error, status: 'compatible', attempt: 'inactive', message: null });
});

it.each(['compatible', 'incompatible'] as const)('merges pending to %s, ignores delayed pending and treats equal terminal as a no-op', status => {
  const state = createResolutionState(pending);
  const terminal = syncResolutionRoom(state, { ...pending, filterResolutionStatus: status });
  expect(terminal).toMatchObject({ status, attempt: 'inactive', message: null });
  expect(syncResolutionRoom(terminal, pending)).toBe(terminal);
  expect(syncResolutionRoom(terminal, { ...pending, filterResolutionStatus: status })).toBe(terminal);
});

it('makes a terminal conflict generation-sticky and suppresses all terminal meaning', () => {
  const compatible = receiveResolutionResult(createResolutionState(pending),
    createResolutionState(pending).request,
    { outcome: 'compatible', filter_resolution_status: 'compatible' });
  const conflict = syncResolutionRoom(compatible, { ...pending,
    filterResolutionStatus: 'incompatible' });
  expect(conflict).toMatchObject({ status: 'compatible', attempt: 'integrity-error' });
  expect(syncResolutionRoom(conflict, { ...pending,
    filterResolutionStatus: 'compatible' })).toBe(conflict);
  expect(retryResolution(conflict)).toBe(conflict);
});

it('projects a room-owned integrity conflict immediately', () => {
  expect(createResolutionState({ ...pending, filterResolutionStatus: 'incompatible',
    resolutionIntegrityError: true })).toMatchObject({
    status: 'incompatible', attempt: 'integrity-error',
    message: 'Unable to verify common-filter status. Reload the room and try again.',
  });
});
