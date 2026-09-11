import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { router } from 'expo-router';
import { StrictMode } from 'react';
import QRCode from 'react-native-qrcode-svg';
import RoomRouteScreen from '../../app/room/[code]';

const mockJoin = jest.fn(), mockRefetch = jest.fn(), mockBootstrap = jest.fn(), mockRemove = jest.fn();
const mockRecover = jest.fn(), mockSubmit = jest.fn(), mockEnsureCandidate = jest.fn();
jest.mock('../../src/rooms/service', () => ({
  joinRoom: (code: string) => mockJoin(code), refetchRoom: (id: string) => mockRefetch(id),
}));
jest.mock('../../src/filters/service', () => ({
  recoverMyParticipantFilter: (id: string) => mockRecover(id),
  submitMyParticipantFilter: (id: string, genres: string[], from: number, to: number) =>
    mockSubmit(id, genres, from, to),
}));
jest.mock('../../src/candidates/service', () => ({ ensureRoomCandidate: (id: string) => mockEnsureCandidate(id) }));
jest.mock('../../src/auth/anonymous-session', () => ({ bootstrapAnonymousSession: () => mockBootstrap() }));

type TestChannel = { on: jest.Mock; subscribe: jest.Mock; status: (value: string) => void;
  update: () => void; system: (payload: unknown) => void };
const channels: TestChannel[] = [];
const mockChannel = jest.fn(() => {
  const channel: TestChannel = { on: jest.fn(), subscribe: jest.fn(), status: () => {}, update: () => {}, system: () => {} };
  channel.on.mockImplementation((type, _filter, callback) => {
    if (type === 'system') channel.system = callback; else channel.update = callback;
    return channel;
  });
  channel.subscribe.mockImplementation(callback => { channel.status = callback; return channel; });
  channels.push(channel);
  return channel;
});
jest.mock('../../src/lib/supabase', () => ({ getSupabase: () => ({ channel: mockChannel, removeChannel: mockRemove }) }));

const host = { outcome: 'already_member', room_id: '11111111-1111-4111-8111-111111111111',
  room_code: 'ABCDEF0123', room_state: 'waiting', is_creator: true, is_voter: true,
  voter_count: 1, required_voter_count: 2, filter_completed_count: 0 } as const;
const absent = { outcome: 'not_submitted', genres: null, release_year_from: null, release_year_to: null,
  filter_completed_count: 0, required_voter_count: 2, allowed_release_year_max: 2026 } as const;
const saved = { outcome: 'saved', genres: ['action'], release_year_from: 1990, release_year_to: 2020,
  filter_completed_count: 1, required_voter_count: 2, allowed_release_year_max: 2026 } as const;

beforeEach(() => {
  jest.clearAllMocks(); channels.length = 0;
  mockJoin.mockReset().mockResolvedValue(host);
  mockBootstrap.mockReset().mockResolvedValue({ user: { id: 'retained' } });
  mockRefetch.mockReset().mockResolvedValue({ id: host.room_id, code: host.room_code, state: 'ready',
    voter_count: 2, required_voter_count: 2, filter_completed_count: 0 });
  mockRecover.mockReset().mockResolvedValue(absent);
  mockSubmit.mockReset().mockResolvedValue(saved);
  mockEnsureCandidate.mockReset().mockResolvedValue({ outcome: 'available' });
  mockRemove.mockReset().mockImplementation(async (channel: TestChannel) => { channel.status('CLOSED'); return 'ok'; });
});
afterEach(() => jest.restoreAllMocks());

async function mount(initialUrl = '/room/ABCDEF0123', strict = false) {
  const view = renderRouter({ 'room/[code]': RoomRouteScreen },
    { initialUrl, ...(strict ? { wrapper: StrictMode } : {}) });
  await act(async () => {});
  return view;
}

function ready(patch: Record<string, unknown> = {}) {
  return { ...host, room_state: 'ready', voter_count: 2, ...patch };
}

function expectNoFutureSurface() {
  expect(screen.queryByTestId('candidate-card')).toBeNull();
  expect(screen.queryByText(/loading movie|candidate|swipe|match|resolution|progression/i)).toBeNull();
  expect(mockEnsureCandidate).not.toHaveBeenCalled();
}

it('preserves canonical join recovery, Waiting assembly, invitation link and QR with no filter call', async () => {
  const view = await mount();
  expect(mockJoin.mock.calls).toEqual([['ABCDEF0123']]);
  expect(view.getSegments()).toEqual(['room', '[code]']);
  expect(screen.getByText('Waiting')).toBeVisible();
  expect(screen.getByText('1 of 2 voters')).toBeVisible();
  expect(screen.getByText('Waiting for the voting group.')).toBeVisible();
  expect(screen.getByLabelText('Invitation link').props.children).toContain('/room/ABCDEF0123');
  expect(screen.UNSAFE_getByType(QRCode).props.value).toBe(screen.getByLabelText('Invitation link').props.children);
  expect(mockRecover).not.toHaveBeenCalled(); expect(mockSubmit).not.toHaveBeenCalled();
  expectNoFutureSurface();
});

it.each(['host', 'guest'])('Ready %s voter recovers own values before showing editable defaults', async role => {
  let resolve!: (value: typeof absent) => void;
  mockRecover.mockReturnValue(new Promise(done => { resolve = done; }));
  mockJoin.mockResolvedValue(ready({ is_creator: role === 'host' }));
  await mount();
  expect(mockRecover.mock.calls).toEqual([[host.room_id]]);
  expect(screen.getByText('Loading your filters…')).toBeVisible();
  expect(screen.queryByRole('checkbox')).toBeNull();
  await act(async () => { resolve(absent); });
  expect(screen.getAllByRole('checkbox')).toHaveLength(19);
  expect(screen.getByText('Any genre')).toBeVisible();
  expect(screen.getByLabelText('Release year from')).toHaveProp('value', '1900');
  expect(screen.getByLabelText('Release year to')).toHaveProp('value', '2026');
  if (role === 'guest') expect(screen.queryByLabelText('Invitation link')).toBeNull();
  expectNoFutureSurface();
});

it('Ready non-voting creator observes aggregate progress only and never requests detail', async () => {
  mockJoin.mockResolvedValue(ready({ is_voter: false, filter_completed_count: 1 }));
  await mount();
  expect(screen.getByText('1 of 2 filters collected')).toBeVisible();
  expect(screen.getByText('Waiting for voters to finish their filters.')).toBeVisible();
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(mockRecover).not.toHaveBeenCalled(); expect(mockSubmit).not.toHaveBeenCalled();
  expectNoFutureSurface();
});

it('saves a voter-owned draft, adopts canonical values, and remains at the filter handoff boundary', async () => {
  mockJoin.mockResolvedValue(ready());
  await mount();
  fireEvent.press(screen.getByRole('checkbox', { name: 'Action' }));
  fireEvent.changeText(screen.getByLabelText('Release year from'), '1990');
  fireEvent.changeText(screen.getByLabelText('Release year to'), '2020');
  fireEvent.press(screen.getByRole('button', { name: 'Save filters' }));
  await act(async () => {});
  expect(mockSubmit.mock.calls).toEqual([[host.room_id, ['action'], 1990, 2020]]);
  expect(screen.getByText('Saved filters: Action; 1990–2020')).toBeVisible();
  expect(screen.getByText('Your filters are saved. Waiting for the other voters.')).toBeVisible();
  expect(screen.getByText('1 of 2 filters collected')).toBeVisible();
  expectNoFutureSurface();
});

it('shows local validation without a submit and preserves invitation and membership', async () => {
  mockJoin.mockResolvedValue(ready());
  await mount();
  fireEvent.changeText(screen.getByLabelText('Release year from'), '2027');
  fireEvent.press(screen.getByRole('button', { name: 'Save filters' }));
  expect(screen.getByText('Enter years from 1900 through 2026.')).toBeVisible();
  expect(mockSubmit).not.toHaveBeenCalled();
  expect(screen.getByText('2 of 2 voters')).toBeVisible();
  expect(screen.getByLabelText('Invitation link')).toBeVisible();
});

it('renders N/N immediately, with frozen own values and no automatic next-feature action', async () => {
  mockJoin.mockResolvedValue(ready({ filter_completed_count: 2 }));
  mockRecover.mockResolvedValue({ ...saved, outcome: 'locked', filter_completed_count: 2 });
  await mount();
  expect(screen.getByText('2 of 2 filters collected')).toBeVisible();
  expect(screen.getByText('All filters collected. Feature 005 is next.')).toBeVisible();
  expect(screen.getByText('Your filters: Action; 1990–2020')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Save filters' })).toBeNull();
  expectNoFutureSurface();
});

it('keeps N/N handoff visible while own recovery fails and retries detail separately', async () => {
  mockJoin.mockResolvedValue(ready({ filter_completed_count: 2 }));
  mockRecover.mockRejectedValueOnce(new Error('private SQL')).mockResolvedValueOnce({ ...saved,
    outcome: 'locked', filter_completed_count: 2 });
  await mount();
  expect(screen.getByText('All filters collected. Feature 005 is next.')).toBeVisible();
  expect(screen.queryByText('private SQL')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Retry filter recovery' }));
  await act(async () => {});
  expect(mockRecover).toHaveBeenCalledTimes(2);
  expect(screen.getByText('Your filters: Action; 1990–2020')).toBeVisible();
});

it('sync degradation preserves filter state, disables new saves, and uses only room retry', async () => {
  mockJoin.mockResolvedValue(ready());
  await mount();
  await act(async () => { channels[0].status('CHANNEL_ERROR'); });
  expect(screen.getByText('Unable to synchronize this room. Please try again.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Save filters' })).toBeDisabled();
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Retry synchronization' })); });
  expect(mockJoin).toHaveBeenCalledTimes(1); expect(mockRecover).toHaveBeenCalledTimes(1);
  expect(mockRemove).toHaveBeenCalledWith(channels[0]);
});

it('uses exactly one rooms UPDATE/id channel and aggregate invalidation refetch', async () => {
  mockJoin.mockResolvedValue(ready());
  await mount();
  expect(channels).toHaveLength(1);
  expect(mockChannel).toHaveBeenCalledWith(`room:${host.room_id}`);
  expect(channels[0].on).toHaveBeenCalledWith('postgres_changes', {
    event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${host.room_id}`, select: ['id'],
  }, expect.any(Function));
  await act(async () => { channels[0].system({ extension: 'postgres_changes', status: 'ok' }); });
  expect(mockRefetch).toHaveBeenCalledWith(host.room_id);
  expect(mockRecover).toHaveBeenCalledTimes(1);
});

it('invalidates old room filter work during A to B to A route navigation', async () => {
  let resolve!: (value: typeof absent) => void;
  mockJoin.mockResolvedValueOnce(ready()).mockResolvedValueOnce(ready({
    room_id: '22222222-2222-4222-8222-222222222222', room_code: '012345ABCD',
  })).mockResolvedValueOnce(ready());
  mockRecover.mockReturnValueOnce(new Promise(done => { resolve = done; })).mockResolvedValue(absent);
  await mount('/room/ABCDEF0123', true);
  await act(async () => { router.setParams({ code: '012345ABCD' }); });
  await act(async () => { router.setParams({ code: 'ABCDEF0123' }); });
  await act(async () => { resolve({ ...absent, allowed_release_year_max: 2025 } as unknown as typeof absent); });
  expect(screen.getByText('ABCDEF0123')).toBeVisible();
  expect(screen.getByLabelText('Release year to')).toHaveProp('value', '2026');
  expect(screen.queryByText('012345ABCD')).toBeNull();
});

it.each([
  ['invalid_code', 'Malformed invitation. Enter a valid room code.'],
  ['not_found', 'Room not found. Check your invitation.'],
  ['full', 'Room Full. The voting group is already assembled.'],
])('keeps rejected %s projection private and opens no channel or filter request', async (outcome, message) => {
  mockJoin.mockResolvedValue({ outcome, room_id: null, room_code: null, room_state: null,
    is_creator: null, is_voter: null, voter_count: null, required_voter_count: null,
    filter_completed_count: null });
  await mount();
  expect(screen.getByText(message)).toBeVisible();
  expect(mockChannel).not.toHaveBeenCalled(); expect(mockRecover).not.toHaveBeenCalled();
});

it('rejects malformed route input without joining or exposing a room', async () => {
  await mount('/room/invalid');
  expect(mockJoin).not.toHaveBeenCalled(); expect(mockRecover).not.toHaveBeenCalled();
  expect(screen.getByText('Malformed invitation. Enter a valid room code.')).toBeVisible();
});
