import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { router } from 'expo-router';
import { StrictMode, useEffect } from 'react';
import RoomRouteScreen from '../../app/room/[code]';
const mockJoin = jest.fn();
jest.mock('../../src/rooms/service', () => ({ joinRoom: (code: string) => mockJoin(code) }));
const host = { outcome: 'already_member', room_id: '11111111-1111-4111-8111-111111111111', room_code: 'ABCDEF0123', room_state: 'waiting', participant_role: 'host', participant_count: 1 };
beforeEach(() => { jest.resetAllMocks(); mockJoin.mockResolvedValue(host); });
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
  expect(screen.getByText('1 of 2')).toBeVisible();
  expect(screen.getByText('ABCDEF0123')).toBeVisible();
  expect(screen.getByText('Waiting for the second participant.')).toBeVisible();
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
it('renders authoritative host Ready on recovery without post-Ready behavior', async () => {
  mockJoin.mockResolvedValue({ ...host, room_state: 'ready', participant_count: 2 });
  await mount();
  expect(screen.getByText('Ready')).toBeVisible();
  expect(screen.getByText('2 of 2')).toBeVisible();
  expect(screen.queryByText('Waiting for the second participant.')).toBeNull();
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
  mockJoin.mockResolvedValue({ ...host, outcome, participant_role: 'guest', room_state: 'ready', participant_count: 2 });
  await mount();
  expect(screen.getByText('Ready')).toBeVisible(); expect(screen.getByText('2 of 2')).toBeVisible();
  expect(screen.queryByText(host.room_id)).toBeNull(); expect(screen.queryByText('guest')).toBeNull();
  expect(screen.queryByLabelText('Invitation link')).toBeNull();
});
it.each([
  ['invalid_code', 'Malformed invitation. Enter a valid room code.'],
  ['not_found', 'Room not found. Check your invitation.'],
  ['full', 'Room Full. This room already has two participants.'],
])('renders distinct %s with no room details or retry mutation', async (outcome, message) => {
  mockJoin.mockResolvedValue({ outcome, room_id: null, room_code: null, room_state: null, participant_role: null, participant_count: null });
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
  mockJoin.mockResolvedValue({ ...host, room_code: '012345ABCD', room_state: 'ready', participant_count: 2 });
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
  mockJoin.mockResolvedValueOnce({ ...host, room_state: 'ready', participant_count: 2 });
  await act(async () => { router.setParams({ code: 'ABCDEF0123' }); });
  await act(async () => { old(host); });
  expect(mockJoin.mock.calls).toEqual([['ABCDEF0123'], ['012345ABCD'], ['ABCDEF0123']]);
  expect(screen.getByText('Ready')).toBeVisible(); expect(screen.queryByText('Waiting')).toBeNull();
});
