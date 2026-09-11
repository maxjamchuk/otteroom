import { ResolutionServiceError, resolveCommonFilters } from '../../src/resolution/service';

const roomId = '11111111-1111-4111-8111-111111111111';
const mockBootstrap = jest.fn();
const mockRpc = jest.fn();
jest.mock('../../src/auth/anonymous-session', () => ({ bootstrapAnonymousSession: () => mockBootstrap() }));
jest.mock('../../src/lib/supabase', () => ({ getSupabase: () => ({ rpc: mockRpc }) }));

beforeEach(() => {
  jest.resetAllMocks();
  mockBootstrap.mockResolvedValue({ user: { id: 'private-participant' } });
  mockRpc.mockResolvedValue({ data: [{ outcome: 'compatible', filter_resolution_status: 'compatible' }], error: null });
});

it('awaits Auth then invokes only the UUID-only resolver boundary', async () => {
  let release!: () => void;
  mockBootstrap.mockReturnValue(new Promise<void>(resolve => { release = resolve; }));
  const result = resolveCommonFilters(roomId);
  await Promise.resolve();
  expect(mockRpc).not.toHaveBeenCalled();
  release();
  await expect(result).resolves.toEqual({ outcome: 'compatible', filter_resolution_status: 'compatible' });
  expect(mockRpc).toHaveBeenCalledWith('resolve_common_filters', { p_room_id: roomId });
  expect(Object.keys(mockRpc.mock.calls[0][1])).toEqual(['p_room_id']);
});

it('rejects a malformed room identifier before Auth or transport', async () => {
  await expect(resolveCommonFilters('private-target')).rejects.toEqual(new ResolutionServiceError());
  expect(mockBootstrap).not.toHaveBeenCalled();
  expect(mockRpc).not.toHaveBeenCalled();
});

it('does not forward a request when anonymous-session bootstrap fails',async()=>{
  mockBootstrap.mockRejectedValue(new Error('private pre-forward failure'));
  await expect(resolveCommonFilters(roomId)).rejects.toEqual(new ResolutionServiceError());
  expect(mockRpc).not.toHaveBeenCalled();
});

it.each(['auth', 'thrown', 'rpc', 'contract'])('maps %s failure to one safe error without retry or hidden detail', async boundary => {
  if (boundary === 'auth') mockBootstrap.mockRejectedValue(new Error('private Auth UUID'));
  if (boundary === 'thrown') mockRpc.mockRejectedValue(new Error('private SQL text'));
  if (boundary === 'rpc') mockRpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'private row detail' } });
  if (boundary === 'contract') mockRpc.mockResolvedValue({ data: [{ outcome: 'compatible',
    filter_resolution_status: 'compatible', genres: ['private'] }], error: null });
  await expect(resolveCommonFilters(roomId)).rejects.toEqual(new ResolutionServiceError());
  await expect(resolveCommonFilters(roomId)).rejects.toThrow('Unable to resolve common filters. Please try again.');
  expect(mockRpc).toHaveBeenCalledTimes(boundary === 'auth' ? 0 : 2);
});

it.each([
  { outcome: 'not_found', filter_resolution_status: null },
  { outcome: 'pending', filter_resolution_status: 'pending' },
  { outcome: 'incompatible', filter_resolution_status: 'incompatible' },
] as const)('returns only the accepted status row %#', async row => {
  mockRpc.mockResolvedValue({ data: [row], error: null });
  expect(await resolveCommonFilters(roomId)).toEqual(row);
  expect(JSON.stringify(await resolveCommonFilters(roomId))).not.toMatch(
    /release_year|genre|clause|member|user|candidate|room_id/i,
  );
});
