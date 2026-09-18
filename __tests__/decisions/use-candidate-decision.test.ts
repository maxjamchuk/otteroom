import { act, renderHook } from '@testing-library/react-native';
import { useCandidateDecision } from '../../src/decisions/use-candidate-decision';
import type { AcceptedRoomState } from '../../src/rooms/state';

const mockGet = jest.fn(), mockSubmit = jest.fn();
jest.mock('../../src/decisions/service', () => ({
  getCandidateDecision: (...args: unknown[]) => mockGet(...args),
  submitCandidateDecision: (...args: unknown[]) => mockSubmit(...args),
}));

const room: AcceptedRoomState = { kind: 'accepted', id: '11111111-1111-4111-8111-111111111111',
  code: 'ABCDEF0123', isCreator: false, isVoter: true, state: 'ready', title: 'Ready',
  voterCount: 2, requiredVoterCount: 2, filterCompletedCount: 2, filtersComplete: true,
  filterResolutionStatus: 'compatible', resolutionIntegrityError: false,
  candidateAcquisitionStatus: 'assigned', candidateIntegrityError: false,
  decisionCompletedCount: 0 };
const candidateBase = { roomId: room.id, eligible: true, authoritativeStatus: 'assigned', generation: 1,
  requestAttempt: 0, imageAttempt: 0, attempt: 'available', status: 'available',
  candidate: { tmdbMovieId: 42 as number, title: 'One Film', releaseYear: 2020, posterUrl: null },
  message: null, posterSource: null, imageKey: '1:0:0', retry: jest.fn(), onLoad: jest.fn(), onError: jest.fn() } as const;
const projection = { myDecision: null, completedCount: 0, requiredVoterCount: 2,
  decisionSetComplete: false, twoVoterAgreement: false } as const;

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue({ outcome: 'not_decided', ...projection });
  mockSubmit.mockResolvedValue({ outcome: 'accepted', ...projection,
    myDecision: 'yes', completedCount: 1 });
});

it.each(['loading-poster', 'poster-error', 'available', 'no-poster'] as const)(
  'recovers before enabling a recognizable %s candidate', async attempt => {
    const pending = deferred<unknown>(); mockGet.mockReturnValue(pending.promise);
    const hook = renderHook(() => useCandidateDecision(room, { ...candidateBase, attempt, status: attempt } as never));
    expect(hook.result.current).toMatchObject({ kind: 'recovering', controlsVisible: true,
      controlsEnabled: false });
    expect(mockGet).toHaveBeenCalledWith(room.id, 42);
    await act(async () => pending.resolve({ outcome: 'not_decided', ...projection }));
    expect(hook.result.current).toMatchObject({ kind: 'undecided', controlsEnabled: true });
  });

it.each(['inactive','acquiring','acquisition-error','loading-metadata','metadata-error',
  'no-candidates','integrity-error'] as const)('suppresses decision authority for %s', async attempt => {
  const hook = renderHook(() => useCandidateDecision(room,
    { ...candidateBase, attempt, status: attempt,
      candidate: attempt === 'integrity-error' || attempt === 'no-candidates' ? null : candidateBase.candidate } as never));
  await act(async () => {});
  expect(hook.result.current).toMatchObject({ kind: 'unavailable', controlsVisible: false });
  expect(mockGet).not.toHaveBeenCalled();
});

it('recovers aggregate-only observer state without exposing controls', async () => {
  mockGet.mockResolvedValue({ outcome: 'observer', ...projection, completedCount: 1 });
  const hook = renderHook(() => useCandidateDecision({ ...room, isCreator: true, isVoter: false }, candidateBase as never));
  await act(async () => {});
  expect(mockGet).toHaveBeenCalledWith(room.id, 42);
  expect(hook.result.current).toMatchObject({ kind: 'unavailable', controlsVisible: false,
    projection: { completedCount: 1, myDecision: null } });
});

it('starts only one submission, makes no optimistic claim, and commits while a peer is absent', async () => {
  const pending = deferred<unknown>(); mockSubmit.mockReturnValue(pending.promise);
  const hook = renderHook(() => useCandidateDecision(room, candidateBase as never));
  await act(async () => {});
  expect(hook.result.current.kind).toBe('undecided');
  act(() => { hook.result.current.submit('yes'); hook.result.current.submit('no'); });
  expect(mockSubmit).toHaveBeenCalledTimes(1);
  expect(mockSubmit).toHaveBeenCalledWith(room.id, 42, 'yes');
  expect(hook.result.current).toMatchObject({ kind: 'submitting', pendingIntent: 'yes' });
  expect(hook.result.current.projection?.myDecision).toBeNull();
  await act(async () => pending.resolve({ outcome: 'accepted', ...projection,
    myDecision: 'yes', completedCount: 1 }));
  expect(hook.result.current).toMatchObject({ kind: 'decided',
    projection: { myDecision: 'yes', completedCount: 1 } });
});

it('ignores a retired room/candidate recovery result', async () => {
  const old = deferred<unknown>(); mockGet.mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce({ outcome: 'not_decided', ...projection });
  const hook = renderHook(({ value, candidate }: { value: AcceptedRoomState; candidate: typeof candidateBase }) =>
    useCandidateDecision(value, candidate as never), { initialProps: { value: room, candidate: candidateBase } });
  await act(async () => hook.rerender({ value: { ...room, id: '22222222-2222-4222-8222-222222222222' },
    candidate: { ...candidateBase, roomId: '22222222-2222-4222-8222-222222222222',
      candidate: { ...candidateBase.candidate, tmdbMovieId: 99 } } }));
  expect(hook.result.current.generation).toMatchObject({ tmdbMovieId: 99 });
  await act(async () => old.resolve({ outcome: 'decided', ...projection,
    myDecision: 'yes', completedCount: 1 }));
  expect(hook.result.current.projection?.myDecision).toBeNull();
});

it('adopts the stored winner after an opposite-value conflict', async () => {
  mockSubmit.mockResolvedValue({ outcome: 'conflict', ...projection,
    myDecision: 'no', completedCount: 1 });
  const hook = renderHook(() => useCandidateDecision(room, candidateBase as never));
  await act(async () => {});
  await act(async () => hook.result.current.submit('yes'));
  expect(hook.result.current).toMatchObject({ kind: 'decided', notice: 'conflict',
    projection: { myDecision: 'no' } });
  hook.result.current.submit('yes');
  expect(mockSubmit).toHaveBeenCalledTimes(1);
});

it('reconciles a lost success explicitly and never queues a second request', async () => {
  const lost = deferred<unknown>(); mockSubmit.mockReturnValue(lost.promise);
  const hook = renderHook(() => useCandidateDecision(room, candidateBase as never));
  await act(async () => {});
  act(() => { hook.result.current.submit('no'); hook.result.current.submit('yes'); });
  expect(mockSubmit).toHaveBeenCalledTimes(1);
  await act(async () => lost.reject(new Error('discarded acknowledgement')));
  expect(hook.result.current).toMatchObject({ kind: 'recoverable-error', pendingIntent: null });
  mockGet.mockResolvedValueOnce({ outcome: 'decided', ...projection,
    myDecision: 'no', completedCount: 1 });
  await act(async () => hook.result.current.retry());
  expect(mockGet).toHaveBeenCalledTimes(2);
  expect(hook.result.current).toMatchObject({ kind: 'decided',
    projection: { myDecision: 'no' } });
});

it('keeps precommit and malformed-response failures uncertain until explicit recovery', async () => {
  for (const failure of [new Error('precommit'), new Error('malformed')]) {
    mockSubmit.mockRejectedValueOnce(failure);
    const hook = renderHook(() => useCandidateDecision(room, candidateBase as never));
    await act(async () => {});
    await act(async () => hook.result.current.submit('yes'));
    expect(hook.result.current.kind).toBe('recoverable-error');
    hook.unmount();
  }
});

it('privately rereads after room count advances and coalesces the active generation', async () => {
  mockGet.mockResolvedValueOnce({ outcome: 'decided', ...projection,
    myDecision: 'yes', completedCount: 1 }).mockResolvedValueOnce({ outcome: 'decided',
    ...projection, myDecision: 'yes', completedCount: 2, decisionSetComplete: true,
    twoVoterAgreement: true });
  const hook = renderHook(({ value }: { value: AcceptedRoomState }) =>
    useCandidateDecision(value, candidateBase as never),
  { initialProps: { value: { ...room, decisionCompletedCount: 1 } } });
  await act(async () => {});
  expect(hook.result.current).toMatchObject({ kind: 'decided',
    projection: { completedCount: 1, myDecision: 'yes' } });
  await act(async () => hook.rerender({ value: { ...room, decisionCompletedCount: 2 } }));
  expect(mockGet).toHaveBeenCalledTimes(2);
  expect(hook.result.current).toMatchObject({ kind: 'decided',
    projection: { completedCount: 2, decisionSetComplete: true, twoVoterAgreement: true } });
});

it('withholds an undecided peer until count-advance private recovery restores keyboard eligibility', async () => {
  const recovery = deferred<unknown>();
  mockGet.mockResolvedValueOnce({ outcome: 'not_decided', ...projection })
    .mockReturnValueOnce(recovery.promise);
  const hook = renderHook(({ value }: { value: AcceptedRoomState }) =>
    useCandidateDecision(value, candidateBase as never), { initialProps: { value: room } });
  await act(async () => {});
  expect(hook.result.current).toMatchObject({ kind: 'undecided', controlsEnabled: true,
    projection: { completedCount: 0, myDecision: null } });

  await act(async () => hook.rerender({ value: { ...room, decisionCompletedCount: 1 } }));
  expect(hook.result.current).toMatchObject({ kind: 'recovering', controlsEnabled: false,
    projection: { completedCount: 0, myDecision: null } });
  act(() => hook.result.current.submit('no'));
  expect(mockSubmit).not.toHaveBeenCalled();

  await act(async () => recovery.resolve({ outcome: 'not_decided', ...projection,
    completedCount: 1 }));
  expect(hook.result.current).toMatchObject({ kind: 'undecided', controlsEnabled: true,
    projection: { completedCount: 1, myDecision: null } });
  await act(async () => hook.result.current.submit('no'));
  expect(mockSubmit).toHaveBeenCalledWith(room.id, 42, 'no');
});

it('explicitly synchronizes a safe last-known result and ignores work after unmount', async () => {
  mockGet.mockResolvedValueOnce({ outcome: 'decided', ...projection,
    myDecision: 'no', completedCount: 1 });
  const second = deferred<unknown>();
  const hook = renderHook(() => useCandidateDecision(room, candidateBase as never));
  await act(async () => {});
  mockGet.mockReturnValueOnce(second.promise);
  act(() => { hook.result.current.synchronize(); hook.result.current.synchronize(); });
  expect(mockGet).toHaveBeenCalledTimes(2);
  expect(hook.result.current).toMatchObject({ kind: 'recovering',
    projection: { myDecision: 'no' } });
  hook.unmount();
  await act(async () => second.resolve({ outcome: 'not_decided', ...projection }));
  expect(mockSubmit).not.toHaveBeenCalled();
});

it('retires an old pending submit without blocking the new generation', async () => {
  const old = deferred<unknown>(); mockSubmit.mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce({ outcome: 'accepted', ...projection, myDecision: 'no', completedCount: 1 });
  const hook = renderHook(({ value, candidate }: { value: AcceptedRoomState; candidate: typeof candidateBase }) =>
    useCandidateDecision(value, candidate as never), { initialProps: { value: room, candidate: candidateBase } });
  await act(async () => {});
  act(() => hook.result.current.submit('yes'));
  await act(async () => hook.rerender({ value: { ...room, id: '22222222-2222-4222-8222-222222222222' },
    candidate: { ...candidateBase, roomId: '22222222-2222-4222-8222-222222222222',
      candidate: { ...candidateBase.candidate, tmdbMovieId: 99 } } }));
  act(() => hook.result.current.submit('no'));
  await act(async () => {});
  expect(mockSubmit).toHaveBeenCalledTimes(2);
  expect(hook.result.current.projection?.myDecision).toBe('no');
  await act(async () => old.resolve({ outcome: 'accepted', ...projection,
    myDecision: 'yes', completedCount: 1 }));
  expect(hook.result.current.projection?.myDecision).toBe('no');
});
