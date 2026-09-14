import { StrictMode } from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { useRoomCandidate } from '../../src/candidates/use-room-candidate';
import type { AcceptedRoomState } from '../../src/rooms/state';
import type { CandidateResult } from '../../src/candidates/contracts';

const mockEnsure = jest.fn();
jest.mock('../../src/candidates/service', () => ({ ensureRoomCandidate: (id: string) => mockEnsure(id) }));
const base: AcceptedRoomState = { kind: 'accepted', id: '11111111-1111-4111-8111-111111111111',
  code: 'ABCDEF0123', isCreator: true, isVoter: true, state: 'ready', title: 'Ready',
  voterCount: 2, requiredVoterCount: 2, filterCompletedCount: 2, filtersComplete: true,
  filterResolutionStatus: 'compatible', resolutionIntegrityError: false,
  candidateAcquisitionStatus: 'pending', candidateIntegrityError: false };
const available = { outcome: 'available', candidate: { tmdbMovieId: 7, title: 'TMDB Film',
  releaseYear: 2020, posterUrl: 'https://image.tmdb.org/t/p/w500/a.jpg' } } as const;
function deferred<T>() { let resolve!: (value:T)=>void, reject!: (value:unknown)=>void;
  const promise = new Promise<T>((yes,no)=>{resolve=yes;reject=no;}); return {promise,resolve,reject}; }
async function mount(room: AcceptedRoomState | null = base) {
  const hook = renderHook(({ value }: { value: AcceptedRoomState | null }) => useRoomCandidate(value),
    { initialProps: { value: room } }); await act(async()=>{}); return hook;
}
beforeEach(()=>{ jest.clearAllMocks(); mockEnsure.mockResolvedValue(available); });

it.each([null, { ...base, state:'waiting', title:'Waiting', voterCount:1,
  filterCompletedCount:0, filtersComplete:false, filterResolutionStatus:'pending' } as AcceptedRoomState,
  { ...base, filterResolutionStatus:'pending' } as AcceptedRoomState,
  { ...base, filterResolutionStatus:'incompatible' } as AcceptedRoomState])(
  'stays inactive outside exact compatible authority %#', async room => {
    const hook=await mount(room); expect(hook.result.current.attempt).toBe('inactive');
    expect(mockEnsure).not.toHaveBeenCalled();
  });

it.each([[true,true],[true,false],[false,true]] as const)(
  'uses one role-equal compatible-pending flight creator=%s voter=%s', async(isCreator,isVoter)=>{
    const pending=deferred<CandidateResult>(); mockEnsure.mockReturnValue(pending.promise);
    const hook=await mount({...base,isCreator,isVoter});
    expect(hook.result.current.attempt).toBe('acquiring'); expect(mockEnsure.mock.calls).toEqual([[base.id]]);
    for(let i=0;i<3;i++) await act(async()=>hook.rerender({value:{...base,isCreator,isVoter}}));
    expect(mockEnsure).toHaveBeenCalledTimes(1);
    await act(async()=>pending.resolve(available));
    expect(hook.result.current.candidate).toEqual(available.candidate);
    expect(hook.result.current.posterSource).toEqual({uri:available.candidate.posterUrl});
  });

it('shares the exact promise through StrictMode effect replay', async()=>{
  const pending=deferred<CandidateResult>(); mockEnsure.mockReturnValue(pending.promise);
  const hook=renderHook(()=>useRoomCandidate(base),{wrapper:StrictMode}); await act(async()=>{});
  expect(mockEnsure).toHaveBeenCalledTimes(1); await act(async()=>pending.resolve(available));
  expect(hook.result.current.candidate?.tmdbMovieId).toBe(7);
});

it('assigned recovery requests Details through Edge while no-candidates makes no call',async()=>{
  const assigned=await mount({...base,candidateAcquisitionStatus:'assigned'});
  expect(mockEnsure).toHaveBeenCalledTimes(1); expect(assigned.result.current.candidate?.tmdbMovieId).toBe(7);
  mockEnsure.mockClear(); const empty=await mount({...base,candidateAcquisitionStatus:'no_candidates'});
  expect(empty.result.current.attempt).toBe('no-candidates'); expect(mockEnsure).not.toHaveBeenCalled();
});

it('committed-response loss retries once and adopts the recovered terminal',async()=>{
  mockEnsure.mockRejectedValueOnce(new Error('lost')).mockResolvedValueOnce(available);
  const hook=await mount(); expect(hook.result.current.attempt).toBe('acquisition-error');
  await act(async()=>hook.result.current.retry());
  expect(mockEnsure.mock.calls).toEqual([[base.id],[base.id]]);
  expect(hook.result.current.candidate?.tmdbMovieId).toBe(7);
});

it('metadata Retry uses Edge for assigned ID while poster Retry never does',async()=>{
  mockEnsure.mockResolvedValueOnce({outcome:'metadata_unavailable'}).mockResolvedValueOnce(available);
  const hook=await mount({...base,candidateAcquisitionStatus:'assigned'});
  expect(hook.result.current.attempt).toBe('metadata-error');
  await act(async()=>hook.result.current.retry()); expect(mockEnsure).toHaveBeenCalledTimes(2);
  const calls=mockEnsure.mock.calls.length; await act(async()=>hook.result.current.onError());
  expect(hook.result.current.attempt).toBe('poster-error');
  await act(async()=>hook.result.current.retry()); expect(mockEnsure).toHaveBeenCalledTimes(calls);
  expect(hook.result.current.imageAttempt).toBe(1);
});

it('retires room A→B→A success and error callbacks by generation',async()=>{
  const a=deferred<CandidateResult>(), b=deferred<CandidateResult>(), a2=deferred<CandidateResult>();
  mockEnsure.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise).mockReturnValueOnce(a2.promise);
  const hook=await mount();
  const other={...base,id:'22222222-2222-4222-8222-222222222222',code:'012345ABCD'};
  await act(async()=>hook.rerender({value:other})); await act(async()=>hook.rerender({value:base}));
  await act(async()=>{a.resolve({...available,candidate:{...available.candidate,tmdbMovieId:8}});b.reject(new Error('late'));});
  expect(hook.result.current.candidate).toBeNull(); expect(hook.result.current.attempt).toBe('acquiring');
  await act(async()=>a2.resolve(available)); expect(hook.result.current.candidate?.tmdbMovieId).toBe(7);
});

it('terminal refetch clears stale acquisition error and suppresses conflict',async()=>{
  mockEnsure.mockRejectedValueOnce(new Error('temporary'));
  const hook=await mount(); expect(hook.result.current.attempt).toBe('acquisition-error');
  mockEnsure.mockResolvedValueOnce(available);
  await act(async()=>hook.rerender({value:{...base,candidateAcquisitionStatus:'assigned'}}));
  expect(hook.result.current.candidate?.tmdbMovieId).toBe(7);
  await act(async()=>hook.rerender({value:{...base,candidateAcquisitionStatus:'assigned',candidateIntegrityError:true}}));
  expect(hook.result.current.attempt).toBe('integrity-error');
});
