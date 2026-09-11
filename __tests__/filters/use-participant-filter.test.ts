import { act, renderHook } from '@testing-library/react-native';
import { useParticipantFilter } from '../../src/filters/use-participant-filter';
import type { AcceptedRoomState } from '../../src/rooms/state';
import type { FilterRecoveryResult, FilterSubmissionResult } from '../../src/filters/contracts';

const mockRecover = jest.fn(), mockSubmit = jest.fn();
jest.mock('../../src/filters/service', () => ({
  recoverMyParticipantFilter: (id: string) => mockRecover(id),
  submitMyParticipantFilter: (id: string, genres: string[], from: number, to: number) => mockSubmit(id, genres, from, to),
}));
const ready: AcceptedRoomState = { kind: 'accepted', id: '11111111-1111-4111-8111-111111111111',
  code: 'ABCDEF0123', isCreator: false, isVoter: true, state: 'ready', title: 'Ready',
  voterCount: 3, requiredVoterCount: 3, filterCompletedCount: 0, filtersComplete: false };
const absent = { outcome: 'not_submitted', genres: null, release_year_from: null, release_year_to: null,
  filter_completed_count: 0, required_voter_count: 3, allowed_release_year_max: 2026 } as const;
const saved = { outcome: 'saved', genres: ['action'], release_year_from: 1990,
  release_year_to: 2020, filter_completed_count: 1, required_voter_count: 3,
  allowed_release_year_max: 2026 } satisfies Extract<FilterRecoveryResult, { outcome: 'saved' | 'locked' }>;
function deferred<T>() { let resolve!: (value:T)=>void, reject!: (reason:unknown)=>void;
  const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;}); return {promise,resolve,reject}; }

beforeEach(()=>{ jest.resetAllMocks(); mockRecover.mockResolvedValue(absent); mockSubmit.mockResolvedValue(saved); });

it.each([{...ready,state:'waiting',title:'Waiting'} as AcceptedRoomState,{...ready,isVoter:false}])
('makes no detail or submit request for ineligible room %#',async room=>{
  const h=renderHook(()=>useParticipantFilter(room,false)); await act(async()=>{});
  await act(async()=>{h.result.current.save();h.result.current.retryRecovery();});
  expect(mockRecover).not.toHaveBeenCalled();expect(mockSubmit).not.toHaveBeenCalled();
});

it('recovers before exposing defaults and performs one-flight canonical save',async()=>{
  const recovery=deferred<typeof absent>();mockRecover.mockReturnValue(recovery.promise);
  const save=deferred<typeof saved>();mockSubmit.mockReturnValue(save.promise);
  const h=renderHook(()=>useParticipantFilter(ready,false));await act(async()=>{});
  expect(h.result.current.recovery).toBe('loading');expect(h.result.current.draft).toBeNull();
  await act(async()=>{recovery.resolve(absent);});
  expect(h.result.current.draft).toEqual({genres:[],releaseYearFrom:'1900',releaseYearTo:'2026'});
  await act(async()=>{h.result.current.toggleGenre('action');h.result.current.setReleaseYearFrom('1990');h.result.current.setReleaseYearTo('2020');});
  act(()=>{h.result.current.save();h.result.current.save();});
  expect(mockSubmit.mock.calls).toEqual([[ready.id,['action'],1990,2020]]);
  await act(async()=>{save.resolve(saved);});
  expect(h.result.current.accepted?.genres).toEqual(['action']);expect(h.result.current.recovery).toBe('saved');
});

it('keeps a failed draft and separates retry-save from recover',async()=>{
  mockSubmit.mockRejectedValueOnce(new Error('private SQL')).mockResolvedValueOnce(saved);
  const h=renderHook(()=>useParticipantFilter(ready,false));await act(async()=>{});
  await act(async()=>{h.result.current.setReleaseYearFrom('1990');h.result.current.setReleaseYearTo('2020');h.result.current.save();});
  expect(h.result.current.submission).toBe('error');expect(h.result.current.draft?.releaseYearFrom).toBe('1990');
  await act(async()=>{h.result.current.retrySave();});expect(mockSubmit).toHaveBeenCalledTimes(2);
  await act(async()=>{h.result.current.retryRecovery();});expect(mockRecover).toHaveBeenCalledTimes(2);
});

it('recovers a committed save after its acknowledgement is lost without optimistic progress',async()=>{
  mockSubmit.mockRejectedValueOnce(new Error('response lost after commit'));
  mockRecover.mockResolvedValueOnce(absent).mockResolvedValueOnce(saved);
  const progress=jest.fn();
  const h=renderHook(()=>useParticipantFilter(ready,false,progress));await act(async()=>{});
  await act(async()=>{h.result.current.setReleaseYearFrom('1990');h.result.current.setReleaseYearTo('2020');h.result.current.save();});
  expect(h.result.current.submission).toBe('error');expect(h.result.current.filterCompletedCount).toBe(0);
  await act(async()=>{h.result.current.retryRecovery();});
  expect(h.result.current.accepted?.genres).toEqual(['action']);expect(h.result.current.filterCompletedCount).toBe(1);
  expect(progress).toHaveBeenLastCalledWith(1);
});

it('adopts unchanged equal retry and allows a different pre-lock replacement without a second contribution',async()=>{
  mockRecover.mockResolvedValue(saved);
  mockSubmit.mockResolvedValueOnce({...saved,outcome:'unchanged'}).mockResolvedValueOnce({
    ...saved,outcome:'saved',genres:['drama'],release_year_from:2000,release_year_to:2024,
  });
  const h=renderHook(()=>useParticipantFilter(ready,false));await act(async()=>{});
  await act(async()=>{h.result.current.save();});
  expect(h.result.current.filterCompletedCount).toBe(1);
  await act(async()=>{h.result.current.toggleGenre('action');h.result.current.toggleGenre('drama');
    h.result.current.setReleaseYearFrom('2000');h.result.current.setReleaseYearTo('2024');h.result.current.save();});
  expect(h.result.current.accepted).toEqual({genres:['drama'],releaseYearFrom:2000,releaseYearTo:2024});
  expect(h.result.current.filterCompletedCount).toBe(1);expect(mockSubmit).toHaveBeenCalledTimes(2);
});

it('collapses overlapping same-voter taps into one active transport and one contribution',async()=>{
  const pending=deferred<FilterSubmissionResult>();mockSubmit.mockReturnValue(pending.promise);
  const h=renderHook(()=>useParticipantFilter(ready,false));await act(async()=>{});
  act(()=>{for(let index=0;index<10;index++)h.result.current.save();});
  expect(mockSubmit).toHaveBeenCalledTimes(1);expect(h.result.current.filterCompletedCount).toBe(0);
  await act(async()=>{pending.resolve(saved);});
  expect(h.result.current.filterCompletedCount).toBe(1);
});

it('rejects local invalid input and sync degradation without transport',async()=>{
  const h=renderHook(({syncError}:{syncError:boolean})=>useParticipantFilter(ready,syncError),{initialProps:{syncError:false}});await act(async()=>{});
  await act(async()=>{h.result.current.setReleaseYearFrom('2027');h.result.current.save();});
  expect(h.result.current.submission).toBe('validation-error');expect(mockSubmit).not.toHaveBeenCalled();
  await act(async()=>{h.rerender({syncError:true});});
  await act(async()=>{h.result.current.setReleaseYearFrom('1900');h.result.current.save();});
  expect(mockSubmit).not.toHaveBeenCalled();expect(h.result.current.canSave).toBe(false);
});

it('drops retired A results across A to B to A generations',async()=>{
  const old=deferred<typeof absent>(), other: AcceptedRoomState={...ready,id:'22222222-2222-4222-8222-222222222222',code:'012345ABCD'};
  mockRecover.mockReturnValueOnce(old.promise).mockResolvedValue(absent);
  const h=renderHook(({room}:{room:AcceptedRoomState})=>useParticipantFilter(room,false),{initialProps:{room:ready}});await act(async()=>{});
  await act(async()=>{h.rerender({room:other});});
  await act(async()=>{h.rerender({room:ready});});
  await act(async()=>{old.resolve({...absent,allowed_release_year_max:2025} as unknown as typeof absent);});
  expect(h.result.current.roomId).toBe(ready.id);expect(h.result.current.allowedReleaseYearMax).toBe(2026);
  expect(mockRecover.mock.calls).toEqual([[ready.id],[other.id],[ready.id]]);
});

it.each(['saved','locked'] as const)('keeps an active save alive when N/N arrives and adopts %s detail without reopening',async outcome=>{
  const pending=deferred<FilterSubmissionResult>();
  const response={outcome,genres:['action'],release_year_from:1990,release_year_to:2020,
    filter_completed_count:3,required_voter_count:3,allowed_release_year_max:2026} satisfies FilterSubmissionResult;
  mockSubmit.mockReturnValue(pending.promise);
  const h=renderHook(({room}:{room:AcceptedRoomState})=>useParticipantFilter(room,false),{initialProps:{room:ready}});await act(async()=>{});
  act(()=>{h.result.current.save();});
  await act(async()=>{h.rerender({room:{...ready,filterCompletedCount:3,filtersComplete:true}});});
  expect(h.result.current.filtersComplete).toBe(true);expect(h.result.current.canSave).toBe(false);
  await act(async()=>{pending.resolve(response);});
  expect(h.result.current.recovery).toBe('locked');expect(h.result.current.accepted?.genres).toEqual(['action']);
});

it('turns a lost active-save response after observed N/N into explicit read-only recovery',async()=>{
  const pending=deferred<FilterSubmissionResult>();mockSubmit.mockReturnValue(pending.promise);
  const h=renderHook(({room}:{room:AcceptedRoomState})=>useParticipantFilter(room,false),{initialProps:{room:ready}});await act(async()=>{});
  act(()=>{h.result.current.save();});
  await act(async()=>{h.rerender({room:{...ready,filterCompletedCount:3,filtersComplete:true}});});
  await act(async()=>{pending.reject(new Error('committed acknowledgement lost'));});
  expect(h.result.current.filtersComplete).toBe(true);expect(h.result.current.recovery).toBe('error');
  expect(h.result.current.draft).toEqual({genres:[],releaseYearFrom:'1900',releaseYearTo:'2026'});
  expect(h.result.current.message).toBe('Unable to load your filters. Please try again.');
});
