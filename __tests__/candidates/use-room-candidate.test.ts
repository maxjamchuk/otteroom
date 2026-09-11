import { StrictMode, useEffect } from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { useRoomCandidate } from '../../src/candidates/use-room-candidate';
import type { AcceptedRoomState } from '../../src/rooms/state';
import type { CandidateResult } from '../../src/candidates/contracts';
import * as posters from '../../src/candidates/posters';

const mockEnsure = jest.fn(), mockChannel = jest.fn(), mockFrom = jest.fn(), mockBootstrap = jest.fn();
jest.mock('../../src/candidates/service', () => ({ ensureRoomCandidate: (id: string) => mockEnsure(id) }));
jest.mock('../../src/lib/supabase', () => ({ getSupabase: () => ({ channel: mockChannel, from: mockFrom }) }));
jest.mock('../../src/auth/anonymous-session', () => ({ bootstrapAnonymousSession: () => mockBootstrap() }));
const waiting: AcceptedRoomState = { kind: 'accepted', id: '11111111-1111-4111-8111-111111111111', code: 'ABCDEF0123', isCreator: true, isVoter: true, state: 'waiting', title: 'Waiting', voterCount: 1, requiredVoterCount: 2, filterCompletedCount: 0, filtersComplete: false, filterResolutionStatus: 'pending', resolutionIntegrityError: false };
const ready: AcceptedRoomState = { ...waiting, state: 'ready', title: 'Ready', voterCount: 2, requiredVoterCount: 2 };
const available = { outcome: 'available', candidate_id: 'fixture-cardboard-comet', title: 'The Cardboard Comet', release_year: 2020, poster_key: 'cardboard-comet' } as const;
const candidate = { candidate_id: available.candidate_id, title: available.title, release_year: available.release_year, poster_key: available.poster_key };
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function mount(room: AcceptedRoomState | null = ready) {
  const h = renderHook(({ room }: { room: AcceptedRoomState | null }) => useRoomCandidate(room), { initialProps: { room } });
  await act(async () => {}); return h;
}
beforeEach(() => { jest.clearAllMocks(); mockEnsure.mockReset().mockResolvedValue(available); });
afterEach(() => {
  expect(mockChannel).not.toHaveBeenCalled(); expect(mockFrom).not.toHaveBeenCalled(); expect(mockBootstrap).not.toHaveBeenCalled();
  jest.restoreAllMocks();
});

it.each([null, waiting])('keeps absent/Waiting room inactive with zero candidate requests %#', async room => {
  const h = await mount(room);
  expect(h.result.current.status).toBe('inactive'); expect(h.result.current.candidate).toBeNull();
  expect(h.result.current.posterSource).toBeNull(); expect(h.result.current.message).toBeNull();
  await act(async () => { h.result.current.retry(); });
  expect(mockEnsure).not.toHaveBeenCalled();
});
it.each([[true,true],[true,false],[false,true]] as const)('automatically acquires for Ready creator=%s voter=%s and waits for image onLoad', async (isCreator,isVoter) => {
  const pending = deferred<CandidateResult>(); mockEnsure.mockReturnValue(pending.promise);
  const h = await mount({ ...ready, isCreator, isVoter });
  expect(mockEnsure.mock.calls).toEqual([[ready.id]]); expect(h.result.current.status).toBe('loading');
  expect(h.result.current.candidate).toBeNull();
  await act(async () => { pending.resolve(available); });
  expect(h.result.current.candidate).toEqual(candidate); expect(h.result.current.status).toBe('loading');
  expect(h.result.current.posterSource).not.toBeNull();
  await act(async () => { h.result.current.onLoad(); });
  expect(h.result.current.status).toBe('available'); expect(h.result.current.message).toBeNull();
});
it('acquires when existing authoritative Waiting state becomes Ready', async () => {
  const h = await mount(waiting); expect(mockEnsure).not.toHaveBeenCalled();
  await act(async () => { h.rerender({ room: ready }); });
  expect(mockEnsure.mock.calls).toEqual([[ready.id]]); expect(h.result.current.candidate).toEqual(candidate);
});
it('shares one in-flight request across repeated same-room Ready renders', async () => {
  const pending = deferred<CandidateResult>(); mockEnsure.mockReturnValue(pending.promise);
  const h = await mount();
  for (let i = 0; i < 5; i++) await act(async () => { h.rerender({ room: { ...ready } }); h.result.current.retry(); });
  expect(mockEnsure).toHaveBeenCalledTimes(1);
  await act(async () => { pending.resolve(available); });
  expect(h.result.current.candidate).toEqual(candidate);
});
it('survives actual Strict Mode effect replay with one ensure promise', async () => {
  const pending = deferred<CandidateResult>(); mockEnsure.mockReturnValue(pending.promise);
  let setups = 0, cleanups = 0;
  const h = renderHook(() => {
    useEffect(() => { setups++; return () => { cleanups++; }; }, []);
    return useRoomCandidate(ready);
  }, { wrapper: StrictMode });
  await act(async () => {});
  expect(setups).toBeGreaterThanOrEqual(2); expect(cleanups).toBeGreaterThanOrEqual(1);
  expect(mockEnsure).toHaveBeenCalledTimes(1);
  await act(async () => { pending.resolve(available); });
  expect(h.result.current.candidate).toEqual(candidate);
});
it('preserves success and stable image callbacks through Ready refetch/reconnect-equivalent renders', async () => {
  const h = await mount(); await act(async () => { h.result.current.onLoad(); });
  const prior = h.result.current;
  for (let i = 0; i < 5; i++) await act(async () => { h.rerender({ room: { ...ready } }); });
  expect(h.result.current.candidate).toBe(prior.candidate); expect(h.result.current.status).toBe('available');
  expect(h.result.current.posterSource).toBe(prior.posterSource); expect(h.result.current.imageKey).toBe(prior.imageKey);
  expect(h.result.current.onLoad).toBe(prior.onLoad); expect(h.result.current.onError).toBe(prior.onError);
  expect(mockEnsure).toHaveBeenCalledTimes(1);
});

const other: AcceptedRoomState = { ...ready, id: '22222222-2222-4222-8222-222222222222', code: '012345ABCD' };
const otherAvailable = { ...available, candidate_id: 'fixture-clockwork-orchard', title: 'The Clockwork Orchard', release_year: 2023, poster_key: 'clockwork-orchard' } as const;

it.each(['resolve', 'reject'])('discards retired room A %s after room B has succeeded', async outcome => {
  const old = deferred<CandidateResult>(); mockEnsure.mockReturnValueOnce(old.promise).mockResolvedValue(otherAvailable);
  const h = await mount();
  await act(async () => { h.rerender({ room: other }); });
  await act(async () => { h.result.current.onLoad(); });
  const before = h.result.current;
  await act(async () => { if (outcome === 'resolve') old.resolve(available); else old.reject(new Error('private retired failure')); });
  expect(h.result.current).toBe(before); expect(before.roomId).toBe(other.id);
  expect(before.candidate?.candidate_id).toBe(otherAvailable.candidate_id); expect(before.status).toBe('available');
  expect(mockEnsure.mock.calls).toEqual([[ready.id], [other.id]]);
});
it('never exposes old metadata during the render that switches rooms', async () => {
  const observed: { roomId: string | null; candidateId: string | undefined }[] = [];
  const h = renderHook(({ room }: { room: AcceptedRoomState | null }) => {
    const result = useRoomCandidate(room);
    observed.push({ roomId: room?.id ?? null, candidateId: result.candidate?.candidate_id });
    return result;
  }, { initialProps: { room: ready } });
  await act(async () => {});
  expect(h.result.current.candidate).toEqual(candidate);
  mockEnsure.mockReturnValue(deferred<CandidateResult>().promise);
  await act(async () => { h.rerender({ room: other }); });
  expect(observed.filter(value => value.roomId === other.id).every(value => value.candidateId === undefined)).toBe(true);
  expect(h.result.current.candidate).toBeNull();
});
it('retires the old generation across A → B → A and ignores its failure after a successful retry', async () => {
  const old = deferred<CandidateResult>();
  mockEnsure.mockReturnValueOnce(old.promise).mockResolvedValueOnce(otherAvailable)
    .mockRejectedValueOnce(new Error('current delivery lost')).mockResolvedValue(available);
  const h = await mount();
  const firstGeneration = h.result.current.generation;
  await act(async () => { h.rerender({ room: other }); });
  await act(async () => { h.rerender({ room: ready }); });
  expect(h.result.current.status).toBe('acquisition-error');
  const oldRetry = h.result.current.retry;
  await act(async () => { oldRetry(); oldRetry(); });
  await act(async () => { h.result.current.onLoad(); });
  const current = h.result.current;
  expect(current.generation).toBeGreaterThan(firstGeneration); expect(current.requestAttempt).toBe(1);
  await act(async () => { old.reject(new Error('retired failure')); oldRetry(); });
  expect(h.result.current).toBe(current); expect(current.status).toBe('available');
  expect(mockEnsure.mock.calls).toEqual([[ready.id], [other.id], [ready.id], [ready.id]]);
});
it.each([null, waiting])('invalidates a Ready request when the current room becomes inactive %#', async room => {
  const old = deferred<CandidateResult>(); mockEnsure.mockReturnValue(old.promise);
  const h = await mount();
  await act(async () => { h.rerender({ room }); old.resolve(available); });
  expect(h.result.current.status).toBe('inactive'); expect(h.result.current.candidate).toBeNull();
  expect(h.result.current.posterSource).toBeNull(); expect(mockEnsure).toHaveBeenCalledTimes(1);
});
it.each(['not_ready', 'not_found', 'failure'])('keeps Ready after %s and explicitly retries the same room once', async outcome => {
  const retry = deferred<CandidateResult>();
  if (outcome === 'failure') mockEnsure.mockRejectedValueOnce(new Error('private backend error'));
  else mockEnsure.mockResolvedValueOnce({ outcome, candidate_id: null, title: null, release_year: null, poster_key: null });
  mockEnsure.mockReturnValueOnce(retry.promise);
  const input = Object.freeze({ ...ready }), h = await mount(input);
  expect(h.result.current.status).toBe('acquisition-error'); expect(h.result.current.candidate).toBeNull();
  expect(h.result.current.message).toBe('Unable to load this movie. Please try again.');
  expect(input).toEqual(ready);
  await act(async () => { h.result.current.retry(); h.result.current.retry(); });
  expect(h.result.current.status).toBe('loading'); expect(h.result.current.requestAttempt).toBe(1);
  expect(mockEnsure.mock.calls).toEqual([[ready.id], [ready.id]]);
  await act(async () => { retry.resolve(available); });
  expect(h.result.current.candidate).toEqual(candidate);
});
it('does not poll or automatically retry a failure on timers or reconnect-equivalent refetches', async () => {
  jest.useFakeTimers();
  try {
    mockEnsure.mockRejectedValue(new Error('private'));
    const h = await mount();
    await act(async () => { h.rerender({ room: { ...ready } }); jest.advanceTimersByTime(60000); });
    expect(mockEnsure).toHaveBeenCalledTimes(1); expect(h.result.current.status).toBe('acquisition-error');
    h.unmount();
  } finally { jest.useRealTimers(); }
});
it('retries only the same poster, retaining metadata and rejecting replaced-image callbacks', async () => {
  const h = await mount(), first = h.result.current;
  await act(async () => { first.onError(); first.onLoad(); });
  expect(h.result.current.status).toBe('poster-error'); expect(h.result.current.candidate).toBe(first.candidate);
  await act(async () => { h.result.current.retry(); h.result.current.retry(); });
  const retry = h.result.current;
  expect(retry.status).toBe('loading'); expect(retry.posterAttempt).toBe(1); expect(retry.requestAttempt).toBe(0);
  expect(retry.imageKey).not.toBe(first.imageKey); expect(retry.posterSource).toBe(first.posterSource);
  expect(retry.candidate).toBe(first.candidate);
  await act(async () => { first.onLoad(); first.onError(); first.retry(); });
  expect(h.result.current).toBe(retry);
  await act(async () => { retry.onLoad(); });
  expect(h.result.current.status).toBe('available'); expect(mockEnsure).toHaveBeenCalledTimes(1);
  expect('onLoadEnd' in h.result.current).toBe(false);
});
it('keeps unknown poster metadata and exposes deterministic retry without RPC or fallback', async () => {
  mockEnsure.mockResolvedValue({ ...available, poster_key: 'unknown-poster' });
  const h = await mount(), original = h.result.current.candidate;
  expect(h.result.current.status).toBe('poster-error'); expect(h.result.current.posterSource).toBeNull();
  await act(async () => { h.result.current.onLoad(); });
  expect(h.result.current.status).toBe('poster-error');
  await act(async () => { h.result.current.retry(); h.result.current.retry(); });
  expect(h.result.current.posterAttempt).toBe(1); expect(h.result.current.status).toBe('poster-error');
  expect(h.result.current.candidate).toBe(original); expect(mockEnsure).toHaveBeenCalledTimes(1);
});
it('re-resolves the same registry key on configuration retry without acquiring another candidate', async () => {
  const original = posters.resolveCandidatePoster;
  const resolve = jest.spyOn(posters, 'resolveCandidatePoster').mockImplementationOnce(() => { throw new Error('private configuration'); });
  resolve.mockImplementationOnce(original);
  const h = await mount(), anchor = h.result.current.candidate;
  expect(h.result.current.status).toBe('poster-error');
  await act(async () => { h.result.current.retry(); });
  expect(h.result.current.status).toBe('loading'); expect(h.result.current.candidate).toBe(anchor);
  await act(async () => { h.result.current.onLoad(); });
  expect(h.result.current.status).toBe('available');
  expect(resolve.mock.calls).toEqual([[available.poster_key], [available.poster_key]]);
  expect(mockEnsure).toHaveBeenCalledTimes(1);
});
it('invalidates retained request/image/retry callbacks synchronously on unmount', async () => {
  const pending = deferred<CandidateResult>(); mockEnsure.mockReturnValue(pending.promise);
  const h = await mount(), old = h.result.current;
  await act(async () => { h.unmount(); old.retry(); old.onLoad(); old.onError(); pending.resolve(available); });
  expect(h.result.current).toBe(old); expect(mockEnsure).toHaveBeenCalledTimes(1);
});
it('ignores callbacks from the prior room after the new room has loaded', async () => {
  const h = await mount(), old = h.result.current;
  mockEnsure.mockResolvedValue(otherAvailable);
  await act(async () => { h.rerender({ room: other }); });
  await act(async () => { h.result.current.onLoad(); });
  const current = h.result.current;
  await act(async () => { old.onLoad(); old.onError(); old.retry(); });
  expect(h.result.current).toBe(current); expect(current.status).toBe('available');
  expect(mockEnsure).toHaveBeenCalledTimes(2);
});

it('three-voter room stays inactive at every Waiting count and preserves candidate on Ready refetch',async()=>{
  const zero={...waiting,isVoter:false,voterCount:0,requiredVoterCount:3};
  const h=await mount(zero);
  for(const voterCount of [1,2]) await act(async()=>{h.rerender({room:{...zero,voterCount}});});
  expect(mockEnsure).not.toHaveBeenCalled();
  const full={...zero,state:'ready' as const,title:'Ready',voterCount:3};
  await act(async()=>{h.rerender({room:full});});
  await act(async()=>{h.result.current.onLoad();});const anchor=h.result.current;
  await act(async()=>{h.rerender({room:{...full}});});
  expect(h.result.current.candidate).toBe(anchor.candidate);expect(h.result.current.imageKey).toBe(anchor.imageKey);
  expect(mockEnsure.mock.calls).toEqual([[full.id]]);
});
