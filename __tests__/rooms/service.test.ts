import { createRoom, joinRoom, RoomServiceError } from '../../src/rooms/service';
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
