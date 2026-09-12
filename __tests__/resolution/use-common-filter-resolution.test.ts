import { act, renderHook } from '@testing-library/react-native';
import { StrictMode } from 'react';
import { useCommonFilterResolution } from '../../src/resolution/use-common-filter-resolution';
import type { AcceptedRoomState } from '../../src/rooms/state';

const mockResolve = jest.fn();
jest.mock('../../src/resolution/service', () => ({
  resolveCommonFilters: (roomId: string) => mockResolve(roomId),
}));

const pending: AcceptedRoomState = {
  kind: 'accepted', id: '11111111-1111-4111-8111-111111111111', code: 'ABCDEF0123',
  isCreator: true, isVoter: true, state: 'ready', title: 'Ready', voterCount: 2,
  requiredVoterCount: 2, filterCompletedCount: 2, filtersComplete: true,
  filterResolutionStatus: 'pending', resolutionIntegrityError: false,
};
const compatible = { outcome: 'compatible', filter_resolution_status: 'compatible' } as const;
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => { jest.clearAllMocks(); mockResolve.mockResolvedValue(compatible); });

it.each([
  null,
  { ...pending, state: 'waiting' as const, title: 'Waiting' as const, voterCount: 1,
    filterCompletedCount: 0, filtersComplete: false },
  { ...pending, filterCompletedCount: 1, filtersComplete: false },
  { ...pending, filterResolutionStatus: 'compatible' as const },
  { ...pending, filterResolutionStatus: 'incompatible' as const },
])('makes zero call without exact Ready N/N pending authority %#', async room => {
  const observe = jest.fn();
  const hook = renderHook(() => useCommonFilterResolution(room, observe));
  await act(async () => {});
  expect(mockResolve).not.toHaveBeenCalled();
  expect(hook.result.current.attempt).toBe('inactive');
});

it('shares one automatic flight through React Strict effect replay and adopts status only', async () => {
  const flight = deferred<typeof compatible>(); mockResolve.mockReturnValue(flight.promise);
  const observe = jest.fn();
  const hook = renderHook(() => useCommonFilterResolution(pending, observe), { wrapper: StrictMode });
  await act(async () => {});
  expect(mockResolve.mock.calls).toEqual([[pending.id]]);
  expect(hook.result.current).toMatchObject({ status: 'pending', attempt: 'resolving' });
  await act(async () => { flight.resolve(compatible); });
  expect(observe).toHaveBeenCalledWith('compatible');
  expect(hook.result.current).toMatchObject({ status: 'compatible', attempt: 'inactive' });
  expect(JSON.stringify(hook.result.current)).not.toMatch(/release_year|genre|clause|candidate/i);
});

it('starts one automatic flight when the same room advances from partial to exact N/N', async () => {
  const flight = deferred<typeof compatible>(); mockResolve.mockReturnValue(flight.promise);
  const partial = { ...pending, filterCompletedCount: 1, filtersComplete: false };
  const hook = renderHook(({ room }: { room: AcceptedRoomState }) =>
    useCommonFilterResolution(room), { initialProps: { room: partial } });
  await act(async () => {});
  expect(mockResolve).not.toHaveBeenCalled();
  await act(async () => { hook.rerender({ room: pending }); });
  expect(mockResolve.mock.calls).toEqual([[pending.id]]);
  expect(hook.result.current.attempt).toBe('resolving');
  await act(async () => { flight.resolve(compatible); });
  expect(hook.result.current).toMatchObject({ status: 'compatible', attempt: 'inactive' });
});

it('treats pending as one retryable error without an automatic render loop', async () => {
  mockResolve.mockResolvedValue({ outcome: 'pending', filter_resolution_status: 'pending' });
  const observe = jest.fn();
  const hook = renderHook(({ room }: { room: AcceptedRoomState }) =>
    useCommonFilterResolution(room, observe), { initialProps: { room: pending } });
  await act(async () => {});
  expect(hook.result.current).toMatchObject({ status: 'pending', attempt: 'error' });
  await act(async () => { hook.rerender({ room: { ...pending } }); });
  expect(mockResolve).toHaveBeenCalledTimes(1);
  expect(observe).not.toHaveBeenCalled();
});

it('starts at most one explicit retry and stops permanently after a terminal room update', async () => {
  mockResolve.mockRejectedValueOnce(new Error('private')).mockResolvedValueOnce(compatible);
  const observe = jest.fn();
  const hook = renderHook(({ room }: { room: AcceptedRoomState }) =>
    useCommonFilterResolution(room, observe), { initialProps: { room: pending } });
  await act(async () => {});
  expect(hook.result.current.attempt).toBe('error');
  await act(async () => { hook.result.current.retry(); hook.result.current.retry(); });
  expect(mockResolve).toHaveBeenCalledTimes(2);
  await act(async () => {});
  await act(async () => { hook.rerender({ room: { ...pending, filterResolutionStatus: 'compatible' } }); });
  expect(hook.result.current.status).toBe('compatible');
  expect(mockResolve).toHaveBeenCalledTimes(2);
});

it('recovers a committed response loss from terminal room authority and clears local error',async()=>{
  const lost=deferred<typeof compatible>();mockResolve.mockReturnValue(lost.promise);
  const observe=jest.fn();
  const hook=renderHook(({room}:{room:AcceptedRoomState})=>
    useCommonFilterResolution(room,observe),{initialProps:{room:pending}});
  await act(async()=>{});
  await act(async()=>{lost.reject(new Error('response discarded'));});
  expect(hook.result.current.attempt).toBe('error');
  await act(async()=>{hook.rerender({room:{...pending,filterResolutionStatus:'compatible'}});});
  expect(hook.result.current).toMatchObject({status:'compatible',attempt:'inactive',message:null});
  expect(mockResolve).toHaveBeenCalledTimes(1);
});

it('peer terminal success clears a failed local attempt without invoking another call',async()=>{
  mockResolve.mockRejectedValue(new Error('private transport'));
  const hook=renderHook(({room}:{room:AcceptedRoomState})=>
    useCommonFilterResolution(room),{initialProps:{room:pending}});
  await act(async()=>{});expect(hook.result.current.attempt).toBe('error');
  await act(async()=>{hook.rerender({room:{...pending,filterResolutionStatus:'incompatible'}});});
  expect(hook.result.current).toMatchObject({status:'incompatible',attempt:'inactive',message:null});
  expect(mockResolve).toHaveBeenCalledTimes(1);
});

it('keeps one flight for same-generation clones and starts one new flight after explicit Retry',async()=>{
  const first=deferred<typeof compatible>(),second=deferred<typeof compatible>();
  mockResolve.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const hook=renderHook(({room}:{room:AcceptedRoomState})=>
    useCommonFilterResolution(room),{initialProps:{room:pending}});
  await act(async()=>{hook.rerender({room:{...pending}});hook.rerender({room:{...pending}});});
  expect(mockResolve).toHaveBeenCalledTimes(1);
  await act(async()=>{first.reject(new Error('private'));});
  await act(async()=>{hook.result.current.retry();hook.result.current.retry();});
  expect(mockResolve).toHaveBeenCalledTimes(2);
  await act(async()=>{second.resolve(compatible);});
  expect(hook.result.current.status).toBe('compatible');
});

it.each(['success','error'] as const)('rejects stale A callbacks after A→B→A navigation: %s',async mode=>{
  const oldA=deferred<typeof compatible>(),roomB={...pending,id:'22222222-2222-4222-8222-222222222222',
    code:'012345ABCD'},newA=deferred<typeof compatible>();
  mockResolve.mockReturnValueOnce(oldA.promise)
    .mockResolvedValueOnce({outcome:'incompatible',filter_resolution_status:'incompatible'})
    .mockReturnValueOnce(newA.promise);
  const observe=jest.fn();
  const hook=renderHook(({room}:{room:AcceptedRoomState})=>
    useCommonFilterResolution(room,observe),{initialProps:{room:pending}});
  await act(async()=>{});
  await act(async()=>{hook.rerender({room:roomB});});
  await act(async()=>{hook.rerender({room:pending});});
  expect(mockResolve.mock.calls).toEqual([[pending.id],[roomB.id],[pending.id]]);
  await act(async()=>{if(mode==='success')oldA.resolve(compatible);else oldA.reject(new Error('private'));});
  expect(hook.result.current).toMatchObject({status:'pending',attempt:'resolving'});
  await act(async()=>{newA.resolve(compatible);});
  expect(hook.result.current.status).toBe('compatible');
  expect(observe.mock.calls.at(-1)).toEqual(['compatible']);
});
