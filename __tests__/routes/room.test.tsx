import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import RoomRouteScreen from '../../app/room/[code]';
const mockJoin = jest.fn();
jest.mock('../../src/rooms/service', () => ({ joinRoom: (code: string) => mockJoin(code) }));
const host = { outcome: 'already_member', room_id: '11111111-1111-4111-8111-111111111111', room_code: 'ABCDEF0123', room_state: 'waiting', participant_role: 'host', participant_count: 1 };
beforeEach(() => { jest.resetAllMocks(); mockJoin.mockResolvedValue(host); });
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
  expect(screen.getByText('Unable to open this room. Please try again.')).toBeVisible();
  expect(screen.queryByLabelText('Invitation link')).toBeNull();
});
it('rejects missing code without calling the service', async () => {
  renderRouter({ index: RoomRouteScreen }, { initialUrl: '/' });
  await act(async () => {});
  expect(mockJoin).not.toHaveBeenCalled();
  expect(screen.getByText('Unable to open this room. Please try again.')).toBeVisible();
});
it('discards a result belonging to a different code', async () => {
  mockJoin.mockResolvedValue({ ...host, room_code: '012345ABCD' });
  await mount();
  expect(screen.queryByText('012345ABCD')).toBeNull();
  expect(screen.queryByText('Waiting')).toBeNull();
});
