import { createRoom, joinRoom, RoomServiceError } from '../../src/rooms/service';
import { normalizeRoomCode } from '../../src/rooms/code';
const mockBootstrap = jest.fn();
const mockRpc = jest.fn();
jest.mock('../../src/auth/anonymous-session', () => ({ bootstrapAnonymousSession: () => mockBootstrap() }));
jest.mock('../../src/lib/supabase', () => ({ getSupabase: () => ({ rpc: mockRpc }) }));
const row = { outcome: 'created', room_id: '11111111-1111-4111-8111-111111111111', room_code: 'ABCDEF0123', room_state: 'waiting', participant_role: 'host', participant_count: 1 };
const requestId = '22222222-2222-4222-8222-222222222222';
beforeEach(() => { jest.resetAllMocks(); mockBootstrap.mockResolvedValue({ user: { id: 'private-participant' } }); mockRpc.mockResolvedValue({ data: [row], error: null }); });
it('forwards only the creation request UUID through the typed RPC', async () => {
  expect(await createRoom(requestId)).toEqual(row);
  expect(mockRpc).toHaveBeenCalledWith('create_room', { p_creation_request_id: requestId });
});
it('retries supplied UUID and accepts already_created', async () => {
  mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'private SQL failure' } });
  await expect(createRoom(requestId)).rejects.toThrow(RoomServiceError);
  mockRpc.mockResolvedValueOnce({ data: [{ ...row, outcome: 'already_created' }], error: null });
  expect((await createRoom(requestId)).outcome).toBe('already_created');
  expect(mockRpc.mock.calls).toEqual(Array(2).fill(['create_room', { p_creation_request_id: requestId }]));
});
it.each(['create', 'join'])('%s waits for bootstrap before RPC', async operation => {
  let resolve!: () => void;
  mockBootstrap.mockReturnValue(new Promise<void>(done => { resolve = done; }));
  mockRpc.mockResolvedValue({ data: [{ ...row, outcome: operation === 'create' ? 'created' : 'already_member' }], error: null });
  const pending = operation === 'create' ? createRoom(requestId) : joinRoom(row.room_code);
  await Promise.resolve(); expect(mockRpc).not.toHaveBeenCalled();
  resolve(); await pending; expect(mockRpc).toHaveBeenCalledTimes(1);
});
it('uses shared code-only join for host re-entry', async () => {
  mockRpc.mockResolvedValue({ data: [{ ...row, outcome: 'already_member' }], error: null });
  expect((await joinRoom(row.room_code)).participant_role).toBe('host');
  expect(mockRpc).toHaveBeenCalledWith('join_room', { p_room_code: row.room_code });
});
it.each(['bootstrap', 'transport', 'rpc', 'contract'])('maps %s failure generically without retry', async boundary => {
  if (boundary === 'bootstrap') mockBootstrap.mockRejectedValue(new Error('private backend failure'));
  if (boundary === 'transport') mockRpc.mockRejectedValue(new Error('private backend failure'));
  if (boundary === 'rpc') mockRpc.mockResolvedValue({ data: [row], error: { message: 'private backend failure' } });
  if (boundary === 'contract') mockRpc.mockResolvedValue({ data: [], error: null });
  for (const action of [() => createRoom(requestId), () => joinRoom(row.room_code)]) {
    await expect(action()).rejects.toEqual(new RoomServiceError());
  }
  expect(mockRpc).toHaveBeenCalledTimes(boundary === 'bootstrap' ? 0 : 2);
});

const guest = { ...row, outcome: 'joined', participant_role: 'guest', room_state: 'ready', participant_count: 2 };
it.each([
  guest, { ...guest, outcome: 'already_member' },
  { ...row, outcome: 'already_member' },
  { ...guest, outcome: 'already_member', participant_role: 'host' },
  ...['invalid_code', 'not_found', 'full'].map(outcome => ({ outcome, room_id: null, room_code: null, room_state: null, participant_role: null, participant_count: null })),
])('shared join preserves the closed server outcome %#', async result => {
  mockRpc.mockResolvedValue({ data: [result], error: null });
  expect(await joinRoom(row.room_code)).toEqual(result);
  expect(mockBootstrap).toHaveBeenCalledTimes(1);
  expect(mockRpc.mock.calls).toEqual([['join_room', { p_room_code: row.room_code }]]);
});
it.each([null, [], [guest, guest], [{ ...guest, room_id: null }], [{ ...guest, extra: 'private' }]])('join rejects invalid response %# without retry or partial data', async data => {
  mockRpc.mockResolvedValue({ data, error: null });
  await expect(joinRoom(row.room_code)).rejects.toEqual(new RoomServiceError());
  expect(mockRpc).toHaveBeenCalledTimes(1);
});
it('link and normalized manual entry use the identical gated transport', async () => {
  let resolve!: () => void;
  mockBootstrap.mockReturnValue(new Promise<void>(done => { resolve = done; }));
  mockRpc.mockResolvedValue({ data: [guest], error: null });
  const calls = [joinRoom(row.room_code), joinRoom(normalizeRoomCode(' abcdef0123 ')!)];
  await Promise.resolve(); expect(mockRpc).not.toHaveBeenCalled();
  resolve(); await Promise.all(calls);
  expect(mockRpc.mock.calls).toEqual(Array(2).fill(['join_room', { p_room_code: row.room_code }]));
});
