import { act, renderHook } from '@testing-library/react-native';
import { useRoomSubscription } from '../../src/rooms/use-room-subscription';
import type { AcceptedRoomState } from '../../src/rooms/state';
import { spawnSync } from 'node:child_process';

type Channel = { on: jest.Mock; subscribe: jest.Mock; update: (payload?: unknown) => void; status: (value: string, error?: Error) => void; system: (payload: unknown) => void };
const channels: Channel[] = [];
const mockBootstrap = jest.fn(), mockRefetch = jest.fn(), mockRemove = jest.fn();
const mockChannel = jest.fn(() => {
  const c: Channel = { on: jest.fn(), subscribe: jest.fn(), update: () => {}, status: () => {}, system: () => {} };
  c.on.mockImplementation((type, _filter, fn) => { if (type === 'system') c.system = fn; else c.update = fn; return c; });
  c.subscribe.mockImplementation(fn => { c.status = fn; return c; });
  channels.push(c); return c;
});
const mockClient = { channel: mockChannel, removeChannel: mockRemove };
jest.mock('../../src/lib/supabase', () => ({ getSupabase: () => mockClient }));
jest.mock('../../src/auth/anonymous-session', () => ({ bootstrapAnonymousSession: () => mockBootstrap() }));
jest.mock('../../src/rooms/service', () => ({ refetchRoom: (id: string) => mockRefetch(id) }));
const room: AcceptedRoomState = { kind: 'accepted', id: '11111111-1111-4111-8111-111111111111', code: 'ABCDEF0123', isCreator: true, isVoter: true, state: 'waiting', title: 'Waiting', voterCount: 1, requiredVoterCount: 2, filterCompletedCount: 0, filtersComplete: false };
const other: AcceptedRoomState = { ...room, id: '22222222-2222-4222-8222-222222222222', code: '012345ABCD' };
const ready = (value = room) => ({ id: value.id, code: value.code, state: 'ready', voter_count: value.requiredVoterCount, required_voter_count: value.requiredVoterCount, filter_completed_count: value.filterCompletedCount });
function deferred<T>() { let resolve!: (value: T) => void, reject!: (error: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function mount(value: AcceptedRoomState | null = room) {
  const hook = renderHook(({ accepted }: { accepted: AcceptedRoomState | null }) => useRoomSubscription(accepted), { initialProps: { accepted: value } });
  await act(async () => {}); return hook;
}
beforeEach(() => {
  jest.clearAllMocks(); channels.length = 0;
  mockBootstrap.mockReset().mockResolvedValue({ user: { id: 'retained-participant' } });
  mockRefetch.mockReset().mockResolvedValue(ready());
  mockRemove.mockReset().mockImplementation(async (c: Channel) => { c.status('CLOSED'); return 'ok'; });
});
it('opens no channel for a rejected/unaccepted route', async () => {
  const h = await mount(null); expect(h.result.current.room).toBeNull(); expect(mockChannel).not.toHaveBeenCalled(); expect(mockBootstrap).not.toHaveBeenCalled();
});
it('awaits Auth and uses the exact pinned channel shape; no read before binding', async () => {
  const auth = deferred<void>(); mockBootstrap.mockReturnValue(auth.promise);
  const h = await mount(); expect(mockChannel).not.toHaveBeenCalled(); expect(h.result.current.room).toBe(room);
  await act(async () => { auth.resolve(); });
  expect(mockChannel).toHaveBeenCalledWith(`room:${room.id}`);
  expect(channels[0].on).toHaveBeenCalledWith('system', {}, expect.any(Function));
  expect(channels[0].on.mock.invocationCallOrder.every(order => order < channels[0].subscribe.mock.invocationCallOrder[0])).toBe(true);
  expect(channels[0].on).toHaveBeenCalledWith('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}`, select: ['id'] }, expect.any(Function));
  expect(mockRefetch).not.toHaveBeenCalled();
});
it('first system-ok recovers a completely missed initial UPDATE', async () => {
  const h = await mount(); await act(async () => { channels[0].status('SUBSCRIBED'); channels[0].system({ extension: 'postgres_changes', status: 'ok' }); });
  expect(mockRefetch).toHaveBeenCalledWith(room.id); expect(h.result.current.room?.state).toBe('ready'); expect(h.result.current.error).toBe(false);
});
it('UPDATE is only invalidation, never payload state', async () => {
  mockRefetch.mockResolvedValue({ id: room.id, code: room.code, state: 'waiting', voter_count: 1, required_voter_count: 2, filter_completed_count: 0 });
  const h = await mount(); await act(async () => { channels[0].status('SUBSCRIBED'); channels[0].system({ extension: 'postgres_changes', status: 'ok' }); });
  await act(async () => { channels[0].update({ new: { id: room.id, state: 'ready', code: other.code } }); });
  expect(mockRefetch).toHaveBeenCalledTimes(2); expect(h.result.current.room).toEqual(room);
});
it('coalesces a burst into one follow-up and ignores superseded request completion', async () => {
  const first = deferred<ReturnType<typeof ready>>(), second = deferred<ReturnType<typeof ready>>();
  mockRefetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const h = await mount(); await act(async () => { channels[0].status('SUBSCRIBED'); channels[0].system({ extension: 'postgres_changes', status: 'ok' }); });
  await act(async () => { for (let i = 0; i < 10; i++) channels[0].update(); });
  expect(mockRefetch).toHaveBeenCalledTimes(1);
  await act(async () => { first.resolve(ready()); });
  expect(mockRefetch).toHaveBeenCalledTimes(2); expect(h.result.current.room?.state).toBe('waiting');
  await act(async () => { second.resolve(ready()); }); expect(h.result.current.room?.state).toBe('ready');
});
it('repeated system-ok recovers changes missed while disconnected', async () => {
  mockRefetch.mockResolvedValueOnce({ ...ready(), state: 'waiting', voter_count: 1, required_voter_count: 2 });
  const h = await mount(); await act(async () => { channels[0].status('SUBSCRIBED'); channels[0].system({ extension: 'postgres_changes', status: 'ok' }); });
  await act(async () => { channels[0].status('CHANNEL_ERROR', new Error('private')); });
  expect(h.result.current.room).toEqual(room); expect(h.result.current.error).toBe(true);
  await act(async () => { channels[0].status('SUBSCRIBED'); channels[0].update(); });
  expect(mockRefetch).toHaveBeenCalledTimes(1); expect(h.result.current.error).toBe(true);
  await act(async () => { channels[0].status('SUBSCRIBED'); channels[0].system({ extension: 'postgres_changes', status: 'ok' }); });
  expect(mockRefetch).toHaveBeenCalledTimes(2); expect(h.result.current.room?.state).toBe('ready'); expect(h.result.current.error).toBe(false);
});
it.each(['CLOSED', 'CHANNEL_ERROR', 'TIMED_OUT'])('preserves the last accepted state on %s and replaces exactly one channel on retry', async status => {
  const h = await mount(); await act(async () => { channels[0].status(status, new Error('private SQL detail')); });
  expect(h.result.current.error).toBe(true); expect(h.result.current.room).toEqual(room);
  await act(async () => { h.result.current.retry(); h.result.current.retry(); });
  expect(mockRemove).toHaveBeenCalledTimes(1); expect(mockRemove).toHaveBeenCalledWith(channels[0]);
  expect(mockBootstrap).toHaveBeenCalledTimes(2); expect(mockChannel).toHaveBeenCalledTimes(2);
  expect(mockRemove.mock.invocationCallOrder[0]).toBeLessThan(mockChannel.mock.invocationCallOrder[1]);
  await act(async () => { channels[1].status('SUBSCRIBED'); channels[1].system({ extension: 'postgres_changes', status: 'ok' }); });
  expect(h.result.current.error).toBe(false); expect(h.result.current.room?.state).toBe('ready');
});
it('refetch denial stays recoverable, with no payload fallback', async () => {
  mockRefetch.mockRejectedValueOnce(new Error('private denial'));
  const h = await mount(); await act(async () => { channels[0].status('SUBSCRIBED'); channels[0].system({ extension: 'postgres_changes', status: 'ok' }); });
  expect(h.result.current.room).toEqual(room); expect(h.result.current.error).toBe(true);
  await act(async () => { h.result.current.retry(); });
  await act(async () => { channels[1].status('SUBSCRIBED'); channels[1].system({ extension: 'postgres_changes', status: 'ok' }); }); expect(h.result.current.room?.state).toBe('ready');
});
it.each(['resolve', 'reject'])('ignores delayed old room %s and old channel callbacks after room change', async mode => {
  const old = deferred<ReturnType<typeof ready>>(); mockRefetch.mockReturnValueOnce(old.promise).mockResolvedValue(ready(other));
  const h = await mount(); await act(async () => { channels[0].status('SUBSCRIBED'); channels[0].system({ extension: 'postgres_changes', status: 'ok' }); });
  await act(async () => { h.rerender({ accepted: other }); });
  expect(mockRemove).toHaveBeenCalledWith(channels[0]); expect(h.result.current.room).toEqual(other);
  await act(async () => { channels[1].status('SUBSCRIBED'); channels[1].system({ extension: 'postgres_changes', status: 'ok' }); });
  await act(async () => { channels[0].system({ extension: 'postgres_changes', status: 'ok' }); channels[0].system({ extension: 'postgres_changes', status: 'error' }); channels[0].update(); channels[0].status('CLOSED'); if (mode === 'resolve') old.resolve(ready()); else old.reject(new Error('private')); });
  expect(mockRefetch.mock.calls).toEqual([[room.id], [other.id]]); expect(h.result.current.room?.id).toBe(other.id); expect(h.result.current.error).toBe(false);
});
it('ignores a stale completion after same-room retry, not only after a different ID', async () => {
  const old = deferred<ReturnType<typeof ready>>(); mockRefetch.mockReturnValueOnce(old.promise);
  const h = await mount(); await act(async () => { channels[0].status('SUBSCRIBED'); channels[0].system({ extension: 'postgres_changes', status: 'ok' }); channels[0].status('CLOSED'); });
  await act(async () => { h.result.current.retry(); });
  await act(async () => { old.resolve(ready()); });
  expect(h.result.current.room?.state).toBe('waiting');
  await act(async () => { channels[1].status('SUBSCRIBED'); channels[1].system({ extension: 'postgres_changes', status: 'ok' }); }); expect(h.result.current.room?.state).toBe('ready');
});
it('invalidates before unmount removal and ignores self CLOSED and in-flight data', async () => {
  const read = deferred<ReturnType<typeof ready>>(); mockRefetch.mockReturnValue(read.promise);
  const h = await mount(); await act(async () => { channels[0].status('SUBSCRIBED'); channels[0].system({ extension: 'postgres_changes', status: 'ok' }); });
  await act(async () => { h.unmount(); });
  await act(async () => { read.resolve(ready()); channels[0].status('SUBSCRIBED'); channels[0].system({ extension: 'postgres_changes', status: 'ok' }); channels[0].update(); });
  expect(mockRemove).toHaveBeenCalledTimes(1); expect(mockRefetch).toHaveBeenCalledTimes(1);
});
it('waits for removal before Auth recovery/replacement and retries failed cleanup safely', async () => {
  const removal = deferred<string>(); mockRemove.mockReturnValueOnce(removal.promise);
  const h = await mount(); await act(async () => { channels[0].status('CLOSED'); h.result.current.retry(); });
  // State updates become visible after act, so issue the user retry on the next turn.
  await act(async () => { h.result.current.retry(); });
  expect(mockChannel).toHaveBeenCalledTimes(1);
  await act(async () => { removal.resolve('timed out'); });
  expect(h.result.current.error).toBe(true); expect(mockChannel).toHaveBeenCalledTimes(1);
  await act(async () => { h.result.current.retry(); }); expect(mockChannel).toHaveBeenCalledTimes(2);
});
it('failed Auth recovery creates no replacement channel and leaves the room recoverable', async () => {
  const h = await mount(); await act(async () => { channels[0].status('CLOSED'); });
  mockBootstrap.mockRejectedValueOnce(new Error('private auth failure'));
  await act(async () => { h.result.current.retry(); });
  expect(mockChannel).toHaveBeenCalledTimes(1); expect(h.result.current.room).toEqual(room); expect(h.result.current.error).toBe(true);
});
it('rejects a mismatched refetch without changing the accepted room', async () => {
  mockRefetch.mockResolvedValue(ready(other)); const h = await mount();
  await act(async () => { channels[0].status('SUBSCRIBED'); channels[0].system({ extension: 'postgres_changes', status: 'ok' }); });
  expect(h.result.current.error).toBe(true); expect(h.result.current.room).toEqual(room);
});
it('never polls and duplicate older responses cannot regress Ready', async () => {
  jest.useFakeTimers();
  try {
    const h = await mount(); await act(async () => { channels[0].status('SUBSCRIBED'); channels[0].system({ extension: 'postgres_changes', status: 'ok' }); });
    mockRefetch.mockResolvedValue({ ...ready(), state: 'waiting', voter_count: 1, required_voter_count: 2 });
    await act(async () => { channels[0].update(); });
    await act(async () => { jest.advanceTimersByTime(60000); });
    expect(mockRefetch).toHaveBeenCalledTimes(2); expect(h.result.current.room?.state).toBe('ready'); h.unmount();
  } finally { jest.useRealTimers(); }
});
it('retains monotonically observed Ready across explicit same-room retry', async () => {
  const h = await mount(); await act(async () => { channels[0].status('SUBSCRIBED'); channels[0].system({ extension: 'postgres_changes', status: 'ok' }); });
  await act(async () => { channels[0].status('CLOSED'); });
  await act(async () => { h.result.current.retry(); });
  mockRefetch.mockResolvedValue({ ...ready(), state: 'waiting', voter_count: 1, required_voter_count: 2 });
  await act(async () => { channels[1].status('SUBSCRIBED'); channels[1].system({ extension: 'postgres_changes', status: 'ok' }); });
  expect(h.result.current.room?.state).toBe('ready'); expect(h.result.current.room?.voterCount).toBe(2);
});
it('pinned SDK refresh propagates authorization to the same owned channel without new identity', () => {
  const child = spawnSync(process.execPath, ['--input-type=module'], { encoding: 'utf8', timeout: 15000, input: `
    import assert from 'node:assert/strict';
    import { randomUUID } from 'node:crypto';
    import { createClient } from '@supabase/supabase-js';
    const id = randomUUID(), key = 'sb-synthetic-auth-token';
    const token = () => Array.from({length:3},()=>randomUUID().replaceAll('-','')).join('.');
    const original = {access_token:token(),refresh_token:randomUUID(),token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id,is_anonymous:true}};
    const next = {...original,access_token:token(),refresh_token:randomUUID()};
    const values = new Map([[key,JSON.stringify(original)]]); let refreshes=0;
    const client = createClient('http://synthetic.invalid','synthetic-public',{
      // No subscribed transport in this isolated refresh test; do not retain
      // the SDK's default 50-second empty-channel grace timer after removal.
      realtime:{disconnectOnEmptyChannelsAfterMs:0},
      auth:{storageKey:key,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}},
      global:{fetch:async url=>{assert.equal(String(url).endsWith('/auth/v1/token?grant_type=refresh_token'),true);refreshes++;return new Response(JSON.stringify(next),{status:200,headers:{'content-type':'application/json'}});}}
    });
    try {
      await client.auth.getSession();
      const channel=client.channel('room:synthetic');
      await client.realtime.setAuth();
      assert.equal(await client.realtime.accessToken()===original.access_token,true);
      const originalSetAuth=client.realtime.setAuth.bind(client.realtime);
      let propagated; let automaticCalls=0;
      client.realtime.setAuth=(value)=>{
        const work=originalSetAuth(value);
        if(value===next.access_token){automaticCalls++;propagated=work;}
        return work;
      };
      const refreshed=await client.auth.refreshSession();
      assert.equal(automaticCalls,1); await propagated;
      assert.equal(refreshed.data.session.user.id===id,true);
      assert.equal(channel.channelAdapter.getChannel().joinPush.payload().access_token===next.access_token,true);
      assert.equal(client.getChannels().length,1); assert.equal(client.getChannels()[0]===channel,true); assert.equal(refreshes,1);
      await client.removeChannel(channel); assert.equal(client.getChannels().length,0);
    } finally {await client.auth.dispose();values.clear();}
  ` });
  // Subprocess assertions use booleans; never forward synthetic credentials/errors.
  expect(child.status).toBe(0);
});

it('SUBSCRIBED alone and generic system signals never satisfy DB readiness, even after time passes', async () => {
  jest.useFakeTimers();
  try {
    const h = await mount();
    await act(async () => {
      channels[0].status('SUBSCRIBED');
      channels[0].system({ extension: 'system', status: 'ok' });
      channels[0].system({ extension: 'postgres_changes', status: 'unknown' });
      channels[0].system(null);
      channels[0].update();
      jest.advanceTimersByTime(60000);
    });
    expect(mockRefetch).not.toHaveBeenCalled(); expect(h.result.current.room).toEqual(room);
    h.unmount();
  } finally { jest.useRealTimers(); }
});
it('system readiness does not depend on the English message or a subsequent transport notification', async () => {
  const h = await mount();
  await act(async () => { channels[0].system({ extension: 'postgres_changes', status: 'ok', message: 'localized' }); });
  expect(mockRefetch).toHaveBeenCalledTimes(1); expect(h.result.current.room?.state).toBe('ready');
  await act(async () => { channels[0].status('SUBSCRIBED'); });
  expect(mockRefetch).toHaveBeenCalledTimes(1);
});
it('duplicate system-ok coalesces with in-flight read, without parallel requests or membership mutation', async () => {
  const first = deferred<ReturnType<typeof ready>>(); mockRefetch.mockReturnValueOnce(first.promise);
  const h = await mount();
  await act(async () => { for (let i = 0; i < 10; i++) channels[0].system({ extension: 'postgres_changes', status: 'ok' }); });
  expect(mockRefetch).toHaveBeenCalledTimes(1);
  await act(async () => { first.resolve(ready()); });
  expect(mockRefetch).toHaveBeenCalledTimes(2); expect(h.result.current.room?.state).toBe('ready');
});
it.each(['waiting', 'ready'])('system-error preserves %s and requires new system-ok after transport-only rejoin', async state => {
  const accepted = { ...room, state, voterCount: state === 'ready' ? 2 : 1, title: state === 'ready' ? 'Ready' : 'Waiting' } as AcceptedRoomState;
  const h = await mount(accepted);
  await act(async () => { channels[0].system({ extension: 'postgres_changes', status: 'error', message: 'private detail' }); });
  expect(h.result.current.error).toBe(true); expect(h.result.current.room).toEqual(accepted);
  await act(async () => { channels[0].status('SUBSCRIBED'); channels[0].update(); });
  expect(mockRefetch).not.toHaveBeenCalled(); expect(h.result.current.error).toBe(true);
  expect(mockRemove).not.toHaveBeenCalled();
  await act(async () => { channels[0].system({ extension: 'postgres_changes', status: 'ok' }); });
  expect(mockRefetch).toHaveBeenCalledTimes(1); expect(h.result.current.error).toBe(false); expect(h.result.current.room?.state).toBe('ready');
});
it('system-error invalidates an active read and pending UPDATE; recovery requires a newer authoritative read', async () => {
  const first = deferred<ReturnType<typeof ready>>(); mockRefetch.mockReturnValueOnce(first.promise);
  const h = await mount();
  await act(async () => { channels[0].system({ extension: 'postgres_changes', status: 'ok' }); channels[0].update(); });
  await act(async () => { channels[0].system({ extension: 'postgres_changes', status: 'error' }); first.resolve(ready()); });
  expect(h.result.current.room).toEqual(room); expect(h.result.current.error).toBe(true); expect(mockRefetch).toHaveBeenCalledTimes(1);
  await act(async () => { channels[0].system({ extension: 'postgres_changes', status: 'ok' }); });
  expect(mockRefetch).toHaveBeenCalledTimes(2); expect(h.result.current.error).toBe(false);
});
it('old-generation system events cannot recover or degrade a replacement for the same room', async () => {
  const h = await mount();
  await act(async () => { channels[0].system({ extension: 'postgres_changes', status: 'error' }); });
  await act(async () => { h.result.current.retry(); });
  await act(async () => { channels[0].system({ extension: 'postgres_changes', status: 'ok' }); channels[0].system({ extension: 'postgres_changes', status: 'error' }); });
  expect(mockRefetch).not.toHaveBeenCalled();
  await act(async () => { channels[1].system({ extension: 'postgres_changes', status: 'ok' }); });
  expect(h.result.current.error).toBe(false);
  await act(async () => { channels[0].system({ extension: 'postgres_changes', status: 'error' }); });
  expect(h.result.current.error).toBe(false); expect(mockRefetch).toHaveBeenCalledTimes(1);
});

it('owns one route-level filter watermark across recovery, submit and stale refetch snapshots',async()=>{
  const assembled:AcceptedRoomState={...room,state:'ready',title:'Ready',voterCount:2,
    filterCompletedCount:0,filtersComplete:false};
  const h=await mount(assembled);
  await act(async()=>{h.result.current.observeFilterProgress(1);});
  expect(h.result.current.room?.filterCompletedCount).toBe(1);
  mockRefetch.mockResolvedValue({...ready(assembled),filter_completed_count:0});
  await act(async()=>{channels[0].system({extension:'postgres_changes',status:'ok'});});
  expect(h.result.current.room?.filterCompletedCount).toBe(1);
  await act(async()=>{h.result.current.observeFilterProgress(2);h.result.current.observeFilterProgress(1);});
  expect(h.result.current.room?.filterCompletedCount).toBe(2);
  expect(h.result.current.room?.filtersComplete).toBe(true);
  expect(mockChannel).toHaveBeenCalledTimes(1);
});

it('refetches intermediate Waiting counts, preserves zero-slot creator and ignores stale count before exact Ready', async () => {
  const accepted={...room,isVoter:false,voterCount:0,requiredVoterCount:3};
  const h=await mount(accepted);
  for(const count of [0,1,2,1,3]) {
    mockRefetch.mockResolvedValue({id:room.id,code:room.code,state:count===3?'ready':'waiting',voter_count:count,required_voter_count:3,filter_completed_count:0});
    await act(async()=>{channels[0].system({extension:'postgres_changes',status:'ok'});});
    expect(h.result.current.room?.voterCount).toBe(count===1 && mockRefetch.mock.calls.length===4?2:count);
    expect(h.result.current.room?.isCreator).toBe(true);expect(h.result.current.room?.isVoter).toBe(false);
  }
  const before=h.result.current.room;
  await act(async()=>{channels[0].update({new:{movie_candidate_id:'untrusted',voter_count:0}});});
  expect(h.result.current.room).toEqual(before);expect(mockChannel).toHaveBeenCalledTimes(1);
});
it('immutable target mismatch remains recoverable without changing flags or occupancy',async()=>{
  const h=await mount();mockRefetch.mockResolvedValue({...ready(),required_voter_count:3});
  await act(async()=>{channels[0].system({extension:'postgres_changes',status:'ok'});});
  expect(h.result.current.error).toBe(true);expect(h.result.current.room).toEqual(room);
});
