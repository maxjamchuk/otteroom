import { createRoom, joinRoom, refetchRoom, RoomServiceError } from '../../src/rooms/service';
import { normalizeRoomCode } from '../../src/rooms/code';
const mockBootstrap = jest.fn();
const mockRpc = jest.fn();
const mockSelect = jest.fn(), mockEq = jest.fn(), mockLimit = jest.fn();
const mockFrom = jest.fn(() => ({ select: mockSelect }));
jest.mock('../../src/auth/anonymous-session', () => ({ bootstrapAnonymousSession: () => mockBootstrap() }));
jest.mock('../../src/lib/supabase', () => ({ getSupabase: () => ({ rpc: mockRpc, from: mockFrom }) }));
const row = { outcome: 'created', room_id: '11111111-1111-4111-8111-111111111111', room_code: 'ABCDEF0123', room_state: 'waiting', participant_role: 'host', participant_count: 1 };
const requestId = '22222222-2222-4222-8222-222222222222';
const projection = { id: row.room_id, code: row.room_code, state: 'ready' };
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

describe('authoritative member refetch', () => {
  beforeEach(() => {
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq }); mockEq.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue({ data: [projection], error: null });
  });
  it('awaits the shared session and reads only the accepted immutable ID and public projection', async () => {
    let resolve!: () => void;
    mockBootstrap.mockReturnValue(new Promise<void>(done => { resolve = done; }));
    const read = refetchRoom(row.room_id);
    await Promise.resolve(); expect(mockFrom).not.toHaveBeenCalled();
    resolve(); expect(await read).toEqual(projection);
    expect(mockFrom).toHaveBeenCalledWith('rooms');
    expect(mockSelect).toHaveBeenCalledWith('id, code, state');
    expect(mockEq).toHaveBeenCalledWith('id', row.room_id);
    // Read two to detect a cardinality violation, never hide it with limit(1).
    expect(mockLimit).toHaveBeenCalledWith(2); expect(mockRpc).not.toHaveBeenCalled();
  });
  it.each([null, [], [projection, projection], [{ ...projection, id: requestId }],
    [{ ...projection, code: 'abcdef0123' }], [{ ...projection, state: 'unknown' }],
    [{ ...projection, code: null }], [{ ...projection, host_user_id: 'private' }]])('rejects absent/invalid/cross-room rows %#', async data => {
    mockLimit.mockResolvedValue({ data, error: null });
    await expect(refetchRoom(row.room_id)).rejects.toEqual(new RoomServiceError());
    expect(mockLimit).toHaveBeenCalledTimes(1); expect(mockRpc).not.toHaveBeenCalled();
  });
  it.each(['auth', 'read', 'thrown'])('keeps %s failure generic without mutations or automatic retries', async mode => {
    if (mode === 'auth') mockBootstrap.mockRejectedValue(new Error('private'));
    if (mode === 'read') mockLimit.mockResolvedValue({ data: [projection], error: { message: 'private' } });
    if (mode === 'thrown') mockLimit.mockRejectedValue(new Error('private'));
    await expect(refetchRoom(row.room_id)).rejects.toEqual(new RoomServiceError());
    expect(mockLimit).toHaveBeenCalledTimes(mode === 'auth' ? 0 : 1); expect(mockRpc).not.toHaveBeenCalled();
  });
});
