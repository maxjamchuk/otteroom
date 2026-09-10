import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { router } from 'expo-router';
import { StrictMode, useEffect } from 'react';
import RoomRouteScreen from '../../app/room/[code]';
const mockJoin = jest.fn(), mockEnsureCandidate = jest.fn();
const candidate = { candidate_id: 'fixture-cardboard-comet', title: 'The Cardboard Comet', release_year: 2020, poster_key: 'cardboard-comet' };
jest.mock('../../src/candidates/service', () => ({ ensureRoomCandidate: (id: string) => mockEnsureCandidate(id) }));
const mockRefetch = jest.fn(), mockBootstrap = jest.fn(), mockRemove = jest.fn();
type TestChannel = { on: jest.Mock; subscribe: jest.Mock; status: (value: string) => void; update: () => void; system: (payload: unknown) => void };
const channels: TestChannel[] = [];
const mockChannel = jest.fn(() => {
  const channel: TestChannel = { on: jest.fn(), subscribe: jest.fn(), status: () => {}, update: () => {}, system: () => {} };
  channel.on.mockImplementation((type, _filter, cb) => { if (type === 'system') channel.system = cb; else channel.update = cb; return channel; });
  channel.subscribe.mockImplementation(cb => { channel.status = cb; return channel; });
  channels.push(channel); return channel;
});
jest.mock('../../src/rooms/service', () => ({ joinRoom: (code: string) => mockJoin(code), refetchRoom: (id: string) => mockRefetch(id) }));
jest.mock('../../src/auth/anonymous-session', () => ({ bootstrapAnonymousSession: () => mockBootstrap() }));
jest.mock('../../src/lib/supabase', () => ({ getSupabase: () => ({ channel: mockChannel, removeChannel: mockRemove }) }));
const host = { outcome: 'already_member', room_id: '11111111-1111-4111-8111-111111111111', room_code: 'ABCDEF0123', room_state: 'waiting', is_creator: true, is_voter: true, voter_count: 1, required_voter_count: 2 };
beforeEach(() => {
  mockEnsureCandidate.mockReset().mockResolvedValue({ outcome: 'available', ...candidate });
  jest.clearAllMocks(); channels.length = 0; mockJoin.mockReset().mockResolvedValue(host);
  mockBootstrap.mockReset().mockResolvedValue({ user: { id: 'retained' } });
  mockRefetch.mockReset().mockResolvedValue({ id: host.room_id, code: host.room_code, state: 'ready', voter_count: 2, required_voter_count: 2 });
  mockRemove.mockReset().mockImplementation(async (channel: TestChannel) => { channel.status('CLOSED'); return 'ok'; });
});
afterEach(() => jest.restoreAllMocks());
async function mount(initialUrl = '/room/ABCDEF0123') {
  const view = renderRouter({ 'room/[code]': RoomRouteScreen }, { initialUrl });
  await act(async () => {}); return view;
}
it('recovers host by code after create navigation, not hidden result state', async () => {
  const view = await mount();
  expect(mockJoin.mock.calls).toEqual([['ABCDEF0123']]);
  expect(view.getSegments()).toEqual(['room', '[code]']);
  expect(screen.getByText('Waiting')).toBeVisible();
  expect(screen.getByText('1 of 2 voters')).toBeVisible();
  expect(screen.getByText('ABCDEF0123')).toBeVisible();
  expect(screen.getByText('Waiting for the voting group.')).toBeVisible();
  expect(screen.getByLabelText('Invitation link').props.children).toContain('/room/ABCDEF0123');
  expect(screen.queryByText(host.room_id)).toBeNull();
  expect(screen.queryByText('host')).toBeNull();
});
it('renders loading without room data while bootstrap/transport is pending', async () => {
  let resolve!: (value: unknown) => void;
  mockJoin.mockReturnValue(new Promise(done => { resolve = done; }));
  await mount();
  expect(screen.getByText('Loading room…')).toBeVisible();
  expect(screen.queryByText('ABCDEF0123')).toBeNull();
  await act(async () => { resolve(host); });
  expect(screen.getByText('Waiting')).toBeVisible();
});
it('renders authoritative host Ready on recovery', async () => {
  mockJoin.mockResolvedValue({ ...host, room_state: 'ready', voter_count: 2, required_voter_count: 2 });
  await mount();
  expect(screen.getByText('Ready')).toBeVisible();
  expect(screen.getByText('2 of 2 voters')).toBeVisible();
  expect(screen.queryByText('Waiting for the voting group.')).toBeNull();
});
it('offers generic recovery without backend/identity details', async () => {
  mockJoin.mockRejectedValueOnce(new Error('private SQL and Auth UUID'));
  await mount();
  expect(screen.queryByText('private SQL and Auth UUID')).toBeNull();
  expect(screen.queryByText('ABCDEF0123')).toBeNull();
  expect(screen.queryByLabelText('Invitation link')).toBeNull();
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Retry room' })); });
  expect(mockJoin.mock.calls).toEqual([['ABCDEF0123'], ['ABCDEF0123']]);
  expect(screen.getByText('Waiting')).toBeVisible();
});
it('rejects malformed route input without calling the service', async () => {
  await mount('/room/invalid');
  expect(mockJoin).not.toHaveBeenCalled();
  expect(screen.getByText('Malformed invitation. Enter a valid room code.')).toBeVisible();
  expect(screen.queryByLabelText('Invitation link')).toBeNull();
});
it('rejects missing code without calling the service', async () => {
  renderRouter({ index: RoomRouteScreen }, { initialUrl: '/' });
  await act(async () => {});
  expect(mockJoin).not.toHaveBeenCalled();
  expect(screen.getByText('Malformed invitation. Enter a valid room code.')).toBeVisible();
});
it('discards a result belonging to a different code', async () => {
  mockJoin.mockResolvedValue({ ...host, room_code: '012345ABCD' });
  await mount();
  expect(screen.queryByText('012345ABCD')).toBeNull();
  expect(screen.queryByText('Waiting')).toBeNull();
});

it.each(['joined', 'already_member'])('renders authoritative guest Ready for %s and no private projection', async outcome => {
  mockJoin.mockResolvedValue({ ...host, outcome, is_creator: false, is_voter: true, room_state: 'ready', voter_count: 2, required_voter_count: 2 });
  await mount();
  expect(screen.getByText('Ready')).toBeVisible(); expect(screen.getByText('2 of 2 voters')).toBeVisible();
  expect(screen.queryByText(host.room_id)).toBeNull(); expect(screen.queryByText('guest')).toBeNull();
  expect(screen.queryByLabelText('Invitation link')).toBeNull();
});
it.each([
  ['invalid_code', 'Malformed invitation. Enter a valid room code.'],
  ['not_found', 'Room not found. Check your invitation.'],
  ['full', 'Room Full. The voting group is already assembled.'],
])('renders distinct %s with no room details or retry mutation', async (outcome, message) => {
  mockJoin.mockResolvedValue({ outcome, room_id: null, room_code: null, room_state: null, is_creator: null, is_voter: null, voter_count: null, required_voter_count: null });
  await mount();
  expect(screen.getByText(message)).toBeVisible();
  expect(screen.queryByLabelText('Room code')).toBeNull(); expect(screen.queryByLabelText('Invitation link')).toBeNull();
  expect(screen.queryByText(/of 2/)).toBeNull(); expect(screen.queryByText(host.room_id)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Retry room' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Back to home' })).toBeVisible();
});
it('rejects repeated route values even if both are valid codes', async () => {
  renderRouter({ index: RoomRouteScreen }, { initialUrl: '/?code=ABCDEF0123&code=012345ABCD' });
  await act(async () => {});
  expect(mockJoin).not.toHaveBeenCalled();
  expect(screen.getByText('Malformed invitation. Enter a valid room code.')).toBeVisible();
});
it('canonical replacement and effect replay share one logical join', async () => {
  const replace = jest.spyOn(router, 'replace');
  let resolve!: (value: unknown) => void;
  mockJoin.mockReturnValue(new Promise(done => { resolve = done; }));
  const view = renderRouter({ 'room/[code]': RoomRouteScreen }, { initialUrl: '/room/abcdef0123', wrapper: StrictMode });
  await act(async () => {});
  expect(replace).toHaveBeenCalledWith('/room/ABCDEF0123');
  expect(view.getPathname()).toBe('/room/ABCDEF0123');
  expect(mockJoin.mock.calls).toEqual([['ABCDEF0123']]);
  await act(async () => { router.setParams({ code: 'ABCDEF0123' }); });
  expect(mockJoin).toHaveBeenCalledTimes(1);
  await act(async () => { resolve(host); });
  expect(screen.getByText('Waiting')).toBeVisible();
});
it('actually replays effects while retaining a single pending canonical join', async () => {
  let setups = 0, cleanups = 0, resolve!: (value: unknown) => void;
  mockJoin.mockReturnValue(new Promise(done => { resolve = done; }));
  function ObservedRoute() {
    useEffect(() => { setups++; return () => { cleanups++; }; }, []);
    return <RoomRouteScreen />;
  }
  const view = renderRouter({ 'room/[code]': ObservedRoute }, { initialUrl: '/room/ABCDEF0123', wrapper: StrictMode });
  await act(async () => {});
  expect(setups).toBe(2); expect(cleanups).toBe(1);
  expect(mockJoin.mock.calls).toEqual([['ABCDEF0123']]);
  await act(async () => { resolve(host); });
  expect(screen.getByText('Waiting')).toBeVisible();
  view.unmount(); expect(cleanups).toBe(2);
});
it.each(['resolve', 'reject'])('invalidates the old room before pending %s can affect new room', async completion => {
  let resolve!: (value: unknown) => void, reject!: (reason: unknown) => void;
  mockJoin.mockReturnValueOnce(new Promise((yes, no) => { resolve = yes; reject = no; }));
  mockJoin.mockResolvedValue({ ...host, room_code: '012345ABCD', room_state: 'ready', voter_count: 2, required_voter_count: 2 });
  await mount();
  await act(async () => { router.setParams({ code: '012345ABCD' }); });
  expect(mockJoin.mock.calls).toEqual([['ABCDEF0123'], ['012345ABCD']]);
  await act(async () => { if (completion === 'resolve') resolve(host); else reject(new Error('old private failure')); });
  expect(screen.getByText('012345ABCD')).toBeVisible(); expect(screen.getByText('Ready')).toBeVisible();
  expect(screen.queryByText('ABCDEF0123')).toBeNull(); expect(screen.queryByText('Waiting')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Retry room' })).toBeNull();
});
it('hides accepted old projection immediately while new code is pending', async () => {
  await mount();
  mockJoin.mockReturnValue(new Promise(() => {}));
  await act(async () => { router.setParams({ code: '012345ABCD' }); });
  expect(screen.getByText('Loading room…')).toBeVisible();
  expect(screen.queryByLabelText('Room code')).toBeNull(); expect(screen.queryByText('Waiting')).toBeNull();
});
it('a new A generation does not reuse the pending result from an earlier A', async () => {
  let old!: (value: unknown) => void;
  mockJoin.mockReturnValueOnce(new Promise(done => { old = done; }));
  await mount();
  mockJoin.mockResolvedValueOnce({ ...host, room_code: '012345ABCD' });
  await act(async () => { router.setParams({ code: '012345ABCD' }); });
  mockJoin.mockResolvedValueOnce({ ...host, room_state: 'ready', voter_count: 2, required_voter_count: 2 });
  await act(async () => { router.setParams({ code: 'ABCDEF0123' }); });
  await act(async () => { old(host); });
  expect(mockJoin.mock.calls).toEqual([['ABCDEF0123'], ['012345ABCD'], ['ABCDEF0123']]);
  expect(screen.getByText('Ready')).toBeVisible(); expect(screen.queryByText('Waiting')).toBeNull();
});

it('subscribes only after accepted join, then reaches Ready without navigation or another join', async () => {
  const replace = jest.spyOn(router, 'replace');
  await mount(); expect(channels).toHaveLength(1);
  expect(screen.getByText('Waiting')).toBeVisible();
  await act(async () => { channels[0].status('SUBSCRIBED'); channels[0].system({ extension: 'postgres_changes', status: 'ok' }); });
  expect(screen.getByText('Ready')).toBeVisible(); expect(screen.getByText('2 of 2 voters')).toBeVisible();
  expect(screen.getByLabelText('Invitation link').props.children).toContain('/room/ABCDEF0123'); expect(mockJoin).toHaveBeenCalledTimes(1);
  expect(replace).not.toHaveBeenCalled(); expect(screen.queryByText(host.room_id)).toBeNull();
});
it('sync failure preserves the accepted UI and retry repairs subscription, never join RPC', async () => {
  await mount(); await act(async () => { channels[0].status('CHANNEL_ERROR'); });
  expect(screen.getByText('Waiting')).toBeVisible();
  expect(screen.getByText('Unable to synchronize this room. Please try again.')).toBeVisible();
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Retry synchronization' })); });
  expect(mockRemove).toHaveBeenCalledWith(channels[0]); expect(channels).toHaveLength(2);
  await act(async () => { channels[1].status('SUBSCRIBED'); channels[1].system({ extension: 'postgres_changes', status: 'ok' }); });
  expect(screen.getByText('Ready')).toBeVisible(); expect(mockJoin).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Unable to synchronize this room. Please try again.')).toBeNull();
});
it('old refetch/channel cannot contaminate a new code and unmount removes its channel', async () => {
  let resolve!: (value: unknown) => void;
  mockRefetch.mockReturnValueOnce(new Promise(done => { resolve = done; }));
  const view = await mount(); await act(async () => { channels[0].status('SUBSCRIBED'); channels[0].system({ extension: 'postgres_changes', status: 'ok' }); });
  const next = { ...host, room_id: '22222222-2222-4222-8222-222222222222', room_code: '012345ABCD' };
  mockJoin.mockResolvedValueOnce(next);
  await act(async () => { router.setParams({ code: next.room_code }); });
  expect(mockRemove).toHaveBeenCalledWith(channels[0]);
  await act(async () => { resolve({ id: host.room_id, code: host.room_code, state: 'ready', voter_count: 2, required_voter_count: 2 }); channels[0].status('CLOSED'); channels[0].update(); });
  expect(screen.getByText(next.room_code)).toBeVisible(); expect(screen.getByText('Waiting')).toBeVisible();
  expect(screen.queryByText(host.room_code)).toBeNull(); expect(screen.queryByRole('button', { name: 'Retry synchronization' })).toBeNull();
  view.unmount(); await act(async () => {}); expect(mockRemove).toHaveBeenCalledWith(channels[1]);
});
it.each(['invalid_code', 'not_found', 'full'])('creates no channel on %s', async outcome => {
  mockJoin.mockResolvedValue({ outcome, room_id: null, room_code: null, room_state: null, is_creator: null, is_voter: null, voter_count: null, required_voter_count: null });
  await mount(); expect(mockChannel).not.toHaveBeenCalled();
});

it('transport-only join keeps Waiting; system-error is generic and system-ok recovers without another join', async () => {
  await mount();
  await act(async () => { channels[0].status('SUBSCRIBED'); });
  expect(screen.getByText('Waiting')).toBeVisible(); expect(mockRefetch).not.toHaveBeenCalled();
  await act(async () => { channels[0].system({ extension: 'postgres_changes', status: 'error', message: 'private server details' }); });
  expect(screen.getByText('Waiting')).toBeVisible(); expect(screen.queryByText('private server details')).toBeNull();
  expect(screen.getByText('Unable to synchronize this room. Please try again.')).toBeVisible();
  await act(async () => { channels[0].system({ extension: 'postgres_changes', status: 'ok' }); });
  expect(screen.getByText('Ready')).toBeVisible(); expect(mockJoin).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Unable to synchronize this room. Please try again.')).toBeNull();
});


describe('accepted room candidate integration', () => {
  function loadedPoster() {
    const poster = screen.getByTestId('candidate-poster');
    expect(poster.props.source).toEqual(require('../../assets/candidates/cardboard-comet.png'));
    fireEvent(poster, 'load');
  }

  it('Waiting including transport-only binding has no card, loading or acquisition', async () => {
    await mount();
    await act(async () => { channels[0].status('SUBSCRIBED'); });
    expect(screen.getByText('Waiting for the voting group.')).toBeVisible();
    expect(screen.queryByTestId('candidate-card')).toBeNull();
    expect(screen.queryByTestId('candidate-status')).toBeNull();
    expect(mockEnsureCandidate).not.toHaveBeenCalled();
  });

  it.each(['host', 'guest'])('automatically loads the same local card for immediate %s Ready', async role => {
    let finish!: (value: unknown) => void;
    mockEnsureCandidate.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    mockJoin.mockResolvedValue({ ...host, is_creator: role === 'host', is_voter: true, room_state: 'ready', voter_count: 2, required_voter_count: 2 });
    await mount();
    expect(mockEnsureCandidate.mock.calls).toEqual([[host.room_id]]);
    expect(screen.getByTestId('candidate-status')).toHaveTextContent('Loading movie…');
    expect(screen.queryByTestId('candidate-title')).toBeNull();
    await act(async () => { finish({ outcome: 'available', ...candidate }); });
    expect(screen.getByTestId('candidate-title')).toHaveTextContent(candidate.title);
    expect(screen.getByTestId('candidate-year')).toHaveTextContent('2020');
    expect(screen.queryByText(candidate.candidate_id)).toBeNull();
    act(loadedPoster);
    expect(screen.queryByTestId('candidate-status')).toBeNull();
    expect(screen.getByText('Ready')).toBeVisible();
    expect(screen.getByText('2 of 2 voters')).toBeVisible();
    expect(channels).toHaveLength(1);
  });

  it('host acquires once after authoritative refetch and retains the card across UPDATE and sync recovery', async () => {
    await mount();
    expect(mockEnsureCandidate).not.toHaveBeenCalled();
    await act(async () => { channels[0].system({ extension: 'postgres_changes', status: 'ok' }); });
    act(loadedPoster);
    const source = screen.getByTestId('candidate-poster').props.source;
    await act(async () => { channels[0].update(); });
    expect(mockEnsureCandidate.mock.calls).toEqual([[host.room_id]]);
    await act(async () => { channels[0].status('CHANNEL_ERROR'); });
    expect(screen.getByText('Unable to synchronize this room. Please try again.')).toBeVisible();
    expect(screen.getByTestId('candidate-title')).toHaveTextContent(candidate.title);
    expect(screen.queryByTestId('candidate-status')).toBeNull();
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Retry synchronization' })); });
    await act(async () => { channels[1].system({ extension: 'postgres_changes', status: 'ok' }); });
    expect(screen.getByTestId('candidate-poster').props.source).toEqual(source);
    expect(mockEnsureCandidate).toHaveBeenCalledTimes(1);
    expect(mockJoin).toHaveBeenCalledTimes(1);
    expect(mockRemove).toHaveBeenCalledWith(channels[0]);
  });

  it('candidate failure retries safely while room and membership stay Ready', async () => {
    mockJoin.mockResolvedValue({ ...host, room_state: 'ready', voter_count: 2, required_voter_count: 2 });
    mockEnsureCandidate.mockRejectedValueOnce(new Error('private backend credential'));
    await mount();
    expect(screen.getByText('Ready')).toBeVisible();
    expect(screen.getByText('2 of 2 voters')).toBeVisible();
    expect(screen.queryByText('private backend credential')).toBeNull();
    expect(screen.getByTestId('candidate-status')).toHaveTextContent('Unable to load this movie. Please try again.');
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Retry candidate' })); });
    act(loadedPoster);
    expect(mockEnsureCandidate.mock.calls).toEqual([[host.room_id], [host.room_id]]);
    expect(mockJoin).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('candidate-status')).toBeNull();
  });

  it('poster retry retains title/year and same source without acquiring again', async () => {
    mockJoin.mockResolvedValue({ ...host, room_state: 'ready', voter_count: 2, required_voter_count: 2 });
    await mount();
    const source = screen.getByTestId('candidate-poster').props.source;
    act(() => fireEvent(screen.getByTestId('candidate-poster'), 'error'));
    expect(screen.getByTestId('candidate-title')).toHaveTextContent(candidate.title);
    expect(screen.getByTestId('candidate-year')).toHaveTextContent('2020');
    act(() => fireEvent.press(screen.getByRole('button', { name: 'Retry candidate' })));
    expect(screen.getByTestId('candidate-poster').props.source).toEqual(source);
    act(loadedPoster);
    expect(mockEnsureCandidate).toHaveBeenCalledTimes(1);
  });

  it('canonical replacement/replay does not duplicate acquisition and a new RoomEntry discards a stale candidate', async () => {
    let finish!: (value: unknown) => void;
    mockJoin.mockResolvedValue({ ...host, room_state: 'ready', voter_count: 2, required_voter_count: 2 });
    mockEnsureCandidate.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    renderRouter({ 'room/[code]': RoomRouteScreen }, { initialUrl: '/room/abcdef0123', wrapper: StrictMode });
    await act(async () => {});
    expect(mockEnsureCandidate.mock.calls).toEqual([[host.room_id]]);
    mockJoin.mockResolvedValue({ ...host, room_id: '22222222-2222-4222-8222-222222222222', room_code: '012345ABCD' });
    await act(async () => { router.setParams({ code: '012345ABCD' }); });
    await act(async () => { finish({ outcome: 'available', ...candidate }); });
    expect(screen.getByText('Waiting')).toBeVisible();
    expect(screen.getByText('012345ABCD')).toBeVisible();
    expect(screen.queryByTestId('candidate-card')).toBeNull();
    expect(mockEnsureCandidate).toHaveBeenCalledTimes(1);
  });
});


it.each([true,false])('renders real 0/1→2→3 voter counts and immutable creator mode, voting=%s', async voting => {
  mockJoin.mockResolvedValue({...host,is_voter:voting,voter_count:voting?1:0,required_voter_count:3});
  const view=await mount();
  expect(screen.getByText(`${voting?1:0} of 3 voters`)).toBeVisible();
  const explanation=voting?'You created this room and are voting.':'You created this room and are not voting.';
  expect(screen.getByText(explanation)).toBeVisible();
  expect(screen.getByLabelText('Invitation link').props.children).toContain('/room/ABCDEF0123');
  for(const count of (voting?[2,3]:[1,2,3])) {
    mockRefetch.mockResolvedValue({id:host.room_id,code:host.room_code,state:count===3?'ready':'waiting',voter_count:count,required_voter_count:3});
    await act(async()=>{channels[0].system({extension:'postgres_changes',status:'ok'});});
    expect(screen.getByText(`${count} of 3 voters`)).toBeVisible();
    expect(screen.getByText(explanation)).toBeVisible();
    expect(screen.getByLabelText('Invitation link').props.children).toContain('/room/ABCDEF0123');
    expect(mockEnsureCandidate).toHaveBeenCalledTimes(count===3?1:0);
  }
  expect(screen.getByText('Ready')).toBeVisible(); expect(mockJoin).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(host.room_id)).toBeNull();
  expect(screen.queryByLabelText('Invitation QR code')).toBeNull();
  view.unmount();
});
it.each([true,false])('creator recovery retains invitation after assembly, voting=%s', async voting => {
  mockJoin.mockResolvedValue({...host,is_voter:voting,room_state:'ready',voter_count:3,required_voter_count:3});
  await mount();expect(screen.getByText('3 of 3 voters')).toBeVisible();
  expect(screen.getByLabelText('Invitation link').props.children).toContain('/room/ABCDEF0123');
  expect(mockEnsureCandidate.mock.calls).toEqual([[host.room_id]]);
});
it.each(['joined', 'already_member'])('Waiting voter keeps invitation sharing after %s and hides it when Ready', async outcome=>{
  mockJoin.mockResolvedValue({...host,outcome,is_creator:false,is_voter:true,voter_count:2,required_voter_count:3});
  await mount();expect(screen.getByText('2 of 3 voters')).toBeVisible();expect(screen.getByText('Waiting')).toBeVisible();
  expect(screen.getByLabelText('Invitation link').props.children).toContain('/room/ABCDEF0123');
  expect(mockEnsureCandidate).not.toHaveBeenCalled();
  mockRefetch.mockResolvedValue({id:host.room_id,code:host.room_code,state:'ready',voter_count:3,required_voter_count:3});
  await act(async()=>{channels[0].system({extension:'postgres_changes',status:'ok'});});
  expect(screen.getByText('3 of 3 voters')).toBeVisible();expect(screen.getByText('Ready')).toBeVisible();
  expect(screen.queryByLabelText('Invitation link')).toBeNull();
  expect(mockJoin).toHaveBeenCalledTimes(1);expect(mockEnsureCandidate).toHaveBeenCalledTimes(1);
});
