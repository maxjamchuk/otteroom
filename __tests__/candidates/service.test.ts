import { CandidateServiceError, ensureRoomCandidate } from '../../src/candidates/service';

const mockBootstrap = jest.fn(), mockRpc = jest.fn(), mockFrom = jest.fn(), mockChannel = jest.fn();
const mockGetClient = jest.fn(() => ({ rpc: mockRpc, from: mockFrom, channel: mockChannel }));
jest.mock('../../src/auth/anonymous-session', () => ({ bootstrapAnonymousSession: () => mockBootstrap() }));
jest.mock('../../src/lib/supabase', () => ({ getSupabase: () => mockGetClient() }));
const id = '11111111-1111-4111-8111-111111111111';
const available = { outcome: 'available', candidate_id: 'fixture-cardboard-comet', title: 'The Cardboard Comet', release_year: 2020, poster_key: 'cardboard-comet' };
const empty = { candidate_id: null, title: null, release_year: null, poster_key: null };
beforeEach(() => {
  jest.clearAllMocks();
  mockBootstrap.mockReset().mockResolvedValue({ user: { id: 'retained-participant' } });
  mockRpc.mockReset().mockResolvedValue({ data: [available], error: null });
  mockGetClient.mockImplementation(() => ({ rpc: mockRpc, from: mockFrom, channel: mockChannel }));
});
afterEach(() => { expect(mockFrom).not.toHaveBeenCalled(); expect(mockChannel).not.toHaveBeenCalled(); });

it.each([available, { outcome: 'not_ready', ...empty }, { outcome: 'not_found', ...empty }])('preserves business outcome %# through the exact RPC', async row => {
  mockRpc.mockResolvedValue({ data: [row], error: null });
  expect(await ensureRoomCandidate(id)).toEqual(row);
  expect(mockBootstrap).toHaveBeenCalledTimes(1);
  expect(mockRpc.mock.calls).toEqual([['ensure_room_candidate', { p_room_id: id }]]);
});
it('awaits the shared session before accessing the client or RPC', async () => {
  let resolve!: () => void;
  mockBootstrap.mockReturnValue(new Promise<void>(done => { resolve = done; }));
  const pending = ensureRoomCandidate(id);
  await Promise.resolve();
  expect(mockGetClient).not.toHaveBeenCalled(); expect(mockRpc).not.toHaveBeenCalled();
  resolve(); await expect(pending).resolves.toEqual(available);
});
it.each(['auth', 'client', 'transport', 'database', 'parser'])('maps %s failure to fixed safe error without automatic retry', async boundary => {
  const secret = new Error('private backend details');
  if (boundary === 'auth') mockBootstrap.mockRejectedValue(secret);
  if (boundary === 'client') mockGetClient.mockImplementation(() => { throw secret; });
  if (boundary === 'transport') mockRpc.mockRejectedValue(secret);
  if (boundary === 'database') mockRpc.mockResolvedValue({ data: [available], error: secret });
  if (boundary === 'parser') mockRpc.mockResolvedValue({ data: [{ ...available, title: null }], error: null });
  await expect(ensureRoomCandidate(id)).rejects.toEqual(new CandidateServiceError());
  expect(new CandidateServiceError().message).toBe('Unable to load this movie. Please try again.');
  expect(mockBootstrap).toHaveBeenCalledTimes(1);
  expect(mockRpc).toHaveBeenCalledTimes(['auth', 'client'].includes(boundary) ? 0 : 1);
});
it.each([null, [], [available, available], [{ ...available, private: 'extra' }], [{ ...empty, outcome: 'not_found', title: 'private' }]])('rejects malformed runtime response %#', async data => {
  mockRpc.mockResolvedValue({ data, error: null });
  await expect(ensureRoomCandidate(id)).rejects.toThrow(CandidateServiceError);
});
it('recovery uses the same room RPC and returns the server assignment', async () => {
  mockRpc.mockRejectedValueOnce(new Error('delivery lost'));
  await expect(ensureRoomCandidate(id)).rejects.toThrow(CandidateServiceError);
  expect(await ensureRoomCandidate(id)).toEqual(available);
  expect(mockRpc.mock.calls).toEqual(Array(2).fill(['ensure_room_candidate', { p_room_id: id }]));
});
