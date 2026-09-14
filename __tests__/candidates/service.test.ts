import fs from 'node:fs';
import { CandidateServiceError, ensureRoomCandidate } from '../../src/candidates/service';

const mockBootstrap = jest.fn(), mockInvoke = jest.fn(), mockRpc = jest.fn(), mockFrom = jest.fn(), mockChannel = jest.fn();
const mockClient = { functions: { invoke: mockInvoke }, rpc: mockRpc, from: mockFrom, channel: mockChannel };
jest.mock('../../src/auth/anonymous-session', () => ({ bootstrapAnonymousSession: () => mockBootstrap() }));
jest.mock('../../src/lib/supabase', () => ({ getSupabase: () => mockClient }));
const id = '11111111-1111-4111-8111-111111111111';
const transport = { outcome: 'available', candidate: { tmdb_movie_id: 7, title: 'TMDB Film',
  release_year: 2020, poster_url: null } };

beforeEach(() => { jest.clearAllMocks(); mockBootstrap.mockResolvedValue({ user: { id: 'private' } });
  mockInvoke.mockResolvedValue({ data: transport, error: null }); });
afterEach(() => { expect(mockRpc).not.toHaveBeenCalled(); expect(mockFrom).not.toHaveBeenCalled();
  expect(mockChannel).not.toHaveBeenCalled(); });

it('invokes only the authenticated Edge boundary with the room UUID body', async () => {
  await expect(ensureRoomCandidate(id)).resolves.toEqual({ outcome: 'available', candidate: {
    tmdbMovieId: 7, title: 'TMDB Film', releaseYear: 2020, posterUrl: null } });
  expect(mockInvoke).toHaveBeenCalledWith('room-candidate', { body: { room_id: id } });
  expect(mockBootstrap).toHaveBeenCalledTimes(1);
});

it('awaits bootstrap before creating Edge traffic', async () => {
  let release!: () => void; mockBootstrap.mockReturnValue(new Promise<void>(resolve => { release = resolve; }));
  const result = ensureRoomCandidate(id); await Promise.resolve(); expect(mockInvoke).not.toHaveBeenCalled();
  release(); await result; expect(mockInvoke).toHaveBeenCalledTimes(1);
});

it.each(['not_found','not_ready','no_candidates','metadata_unavailable'] as const)(
  'preserves exact safe %s response', async outcome => {
    mockInvoke.mockResolvedValue({ data: { outcome }, error: null });
    await expect(ensureRoomCandidate(id)).resolves.toEqual({ outcome });
  });

it.each(['auth','transport','edge','contract'])(
  'maps %s failure to one fixed error with no retry', async boundary => {
    if (boundary === 'auth') mockBootstrap.mockRejectedValue(new Error('secret'));
    if (boundary === 'transport') mockInvoke.mockRejectedValue(new Error('secret'));
    if (boundary === 'edge') mockInvoke.mockResolvedValue({ data: null, error: new Error('secret') });
    if (boundary === 'contract') mockInvoke.mockResolvedValue({ data: { outcome: 'available', token: 'secret' }, error: null });
    await expect(ensureRoomCandidate(id)).rejects.toEqual(new CandidateServiceError());
    expect(mockInvoke).toHaveBeenCalledTimes(boundary === 'auth' ? 0 : 1);
  });

it('rejects invalid room ID before Auth or network', async () => {
  await expect(ensureRoomCandidate('not-a-room')).rejects.toEqual(new CandidateServiceError());
  expect(mockBootstrap).not.toHaveBeenCalled(); expect(mockInvoke).not.toHaveBeenCalled();
});

it('has no direct catalog/RPC/fixture boundary', () => {
  const source = fs.readFileSync('src/candidates/service.ts','utf8');
  expect(source).not.toMatch(/api\.themoviedb\.org|ensure_room_candidate|\.rpc\(|fixture-|genre|release_year_from/i);
});
