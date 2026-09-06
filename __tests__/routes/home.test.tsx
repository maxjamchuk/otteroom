import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';
import RootLayout from '../../app/_layout';
import HomeScreen from '../../app/index';
import RoomRouteScreen from '../../app/room/[code]';

const mockBootstrap = jest.fn();
const mockUnsubscribe = jest.fn();
const mockStopRefresh = jest.fn();
const mockCreate = jest.fn();
const mockJoin = jest.fn();
const mockUuid = jest.fn();
jest.mock('expo-crypto', () => ({ randomUUID: () => mockUuid() }));
jest.mock('../../src/rooms/service', () => ({ createRoom: (id: string) => mockCreate(id), joinRoom: (code: string) => mockJoin(code) }));
jest.mock('../../src/auth/anonymous-session', () => ({ bootstrapAnonymousSession: () => mockBootstrap() }));
jest.mock('../../src/lib/supabase', () => ({ getSupabase: () => ({ auth: {
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: mockUnsubscribe } } }),
  startAutoRefresh: jest.fn(), stopAutoRefresh: mockStopRefresh,
} }) }));
const row = { outcome: 'created', room_id: '11111111-1111-4111-8111-111111111111', room_code: 'ABCDEF0123', room_state: 'waiting', participant_role: 'host', participant_count: 1 };
const firstId = '22222222-2222-4222-8222-222222222222';
const secondId = '33333333-3333-4333-8333-333333333333';
beforeEach(() => {
  jest.resetAllMocks();
  mockBootstrap.mockResolvedValue({ user: { id: 'private-participant' } });
  mockCreate.mockResolvedValue(row); mockJoin.mockResolvedValue({ ...row, outcome: 'already_member' });
  mockUuid.mockReturnValueOnce(firstId).mockReturnValue(secondId);
});
afterEach(() => jest.restoreAllMocks());
const routes = { _layout: RootLayout, index: HomeScreen, 'room/[code]': RoomRouteScreen };
async function mount(initialUrl = '/') {
  const view = renderRouter(routes, { initialUrl });
  await act(async () => {});
  return view;
}

describe('host creation', () => {
  it.each(['created', 'already_created'])('replaces with only canonical code after %s', async outcome => {
    mockCreate.mockResolvedValue({ ...row, outcome });
    const replace = jest.spyOn(router, 'replace');
    const view = await mount();
    expect(mockUuid).not.toHaveBeenCalled();
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Create Room' })); });
    expect(mockCreate).toHaveBeenCalledWith(firstId);
    expect(replace).toHaveBeenCalledWith('/room/ABCDEF0123');
    expect(view.getPathname()).toBe('/room/ABCDEF0123');
    expect(mockJoin).toHaveBeenCalledWith('ABCDEF0123');
    await screen.findByText('Waiting');
    expect(screen.queryByText(row.room_id)).toBeNull();
    expect(screen.queryByText(firstId)).toBeNull();
  });
  it('guards duplicate handler calls independently of disabled UI', async () => {
    let resolve!: (value: unknown) => void;
    mockCreate.mockReturnValue(new Promise(done => { resolve = done; }));
    await mount();
    let button = screen.getByRole('button', { name: 'Create Room' });
    while (typeof button.props.onPress !== 'function' && button.parent) button = button.parent;
    const press = button.props.onPress;
    act(() => { press(); press(); });
    expect(mockUuid).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Creating room…' })).toBeDisabled();
    expect(screen.getByText('Creating your room…')).toBeVisible();
    await act(async () => { resolve(row); });
    await screen.findByText('Waiting');
  });
  it('shows no invitation on failure and reuses UUID on explicit retry', async () => {
    mockCreate.mockRejectedValueOnce(new Error('private SQL failure'));
    const view = await mount();
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Create Room' })); });
    expect(screen.getByText('Unable to create your room. Please try again.')).toBeVisible();
    expect(view.getPathname()).toBe('/');
    expect(screen.queryByText('private SQL failure')).toBeNull();
    expect(screen.queryByLabelText('Invitation link')).toBeNull();
    expect(screen.queryByText(row.room_code)).toBeNull();
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Retry create' })); });
    expect(mockUuid).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls).toEqual([[firstId], [firstId]]);
    await screen.findByText('Waiting');
  });
  it('preserves UUID when successful RPC navigation throws', async () => {
    const replace = jest.spyOn(router, 'replace').mockImplementationOnce(() => { throw new Error('private navigation error'); });
    await mount();
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Create Room' })); });
    expect(screen.queryByLabelText('Invitation link')).toBeNull();
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Retry create' })); });
    expect(mockCreate.mock.calls).toEqual([[firstId], [firstId]]);
    expect(replace).toHaveBeenCalledTimes(2);
  });
  it('new deliberate create after completion uses a new UUID', async () => {
    await mount();
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Create Room' })); });
    await screen.findByText('Waiting');
    await act(async () => { fireEvent.press(screen.getByRole('link', { name: 'Back to home' })); });
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Create Room' })); });
    expect(mockCreate.mock.calls).toEqual([[firstId], [secondId]]);
  });
});

describe('mounted Auth boundary', () => {
  it('does not mount room actions before bootstrap', async () => {
    let resolve!: (value: unknown) => void;
    mockBootstrap.mockReturnValue(new Promise(done => { resolve = done; }));
    const view = await mount();
    expect(screen.getByText('Restoring local session…')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Create Room' })).toBeNull();
    expect(mockUuid).not.toHaveBeenCalled(); expect(mockCreate).not.toHaveBeenCalled();
    expect(view.getPathname()).toBe('/');
    await act(async () => { resolve({ user: { id: 'private-participant' } }); });
    await screen.findByRole('button', { name: 'Create Room' });
  });
  it('keeps routes gated on session failure until retry succeeds', async () => {
    mockBootstrap.mockRejectedValueOnce(new Error('sensitive backend details'));
    await mount('/room/ABCDEF0123');
    const retry = await screen.findByRole('button', { name: 'Retry session' });
    expect(screen.queryByText('sensitive backend details')).toBeNull();
    expect(mockJoin).not.toHaveBeenCalled();
    await act(async () => { fireEvent.press(retry); });
    await screen.findByText('Waiting');
  });
  it('cleans up Auth/refresh listeners on unmount', async () => {
    const view = await mount();
    view.unmount();
    await waitFor(() => expect(mockUnsubscribe).toHaveBeenCalled());
    expect(mockStopRefresh).toHaveBeenCalled();
  });
});
