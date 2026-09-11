import { FilterServiceError, recoverMyParticipantFilter, submitMyParticipantFilter } from '../../src/filters/service';

const roomId = '11111111-1111-4111-8111-111111111111';
const mockBootstrap = jest.fn();
const mockRpc = jest.fn();
jest.mock('../../src/auth/anonymous-session', () => ({ bootstrapAnonymousSession: () => mockBootstrap() }));
jest.mock('../../src/lib/supabase', () => ({ getSupabase: () => ({ rpc: mockRpc }) }));

const absent = { outcome: 'not_submitted', genres: null, release_year_from: null, release_year_to: null,
  filter_completed_count: 0, required_voter_count: 3, allowed_release_year_max: 2026 };
const saved = { outcome: 'saved', genres: ['action', 'drama'], release_year_from: 1900,
  release_year_to: 2026, filter_completed_count: 1, required_voter_count: 3,
  allowed_release_year_max: 2026 };

beforeEach(() => {
  jest.resetAllMocks();
  mockBootstrap.mockResolvedValue({ user: { id: 'retained-participant' } });
  mockRpc.mockResolvedValue({ data: [absent], error: null });
});

it('recovers only caller-owned detail through the one approved room argument after Auth', async () => {
  expect(await recoverMyParticipantFilter(roomId)).toEqual(absent);
  expect(mockRpc).toHaveBeenCalledWith('get_my_participant_filter', { p_room_id: roomId });
  expect(Object.keys(mockRpc.mock.calls[0][1])).toEqual(['p_room_id']);
});

it('submits exactly the four approved arguments without an identity or owner target', async () => {
  mockRpc.mockResolvedValue({ data: [saved], error: null });
  expect(await submitMyParticipantFilter(roomId, ['drama', 'action'], 1900, 2026)).toEqual(saved);
  expect(mockRpc).toHaveBeenCalledWith('submit_my_participant_filter', {
    p_room_id: roomId, p_genres: ['drama', 'action'], p_release_year_from: 1900,
    p_release_year_to: 2026,
  });
});

it.each([
  ['22P02', 'genres', 'Choose only the available genres.'],
  ['22003', 'years', 'Enter a valid release-year range.'],
  ['XX000', 'generic', 'Unable to save participant filters. Please try again.'],
] as const)('maps submit transport %s to a safe %s correction', async (code, kind, message) => {
  mockRpc.mockResolvedValue({ data: null, error: { code, message: 'private SQL UUID payload' } });
  await expect(submitMyParticipantFilter(roomId, [], 1900, 2026))
    .rejects.toEqual(new FilterServiceError(kind));
  await expect(submitMyParticipantFilter(roomId, [], 1900, 2026))
    .rejects.toThrow(message);
});

it.each(['bootstrap', 'transport', 'contract'])('maps %s failures generically without raw detail or retry', async boundary => {
  if (boundary === 'bootstrap') mockBootstrap.mockRejectedValue(new Error('private Auth UUID'));
  if (boundary === 'transport') mockRpc.mockRejectedValue(new Error('private SQL'));
  if (boundary === 'contract') mockRpc.mockResolvedValue({ data: [{ ...absent, room_member_id: 'private' }], error: null });
  await expect(recoverMyParticipantFilter(roomId)).rejects.toEqual(new FilterServiceError());
  expect(mockRpc).toHaveBeenCalledTimes(boundary === 'bootstrap' ? 0 : 1);
});

it('rejects malformed room IDs before Auth or transport', async () => {
  await expect(recoverMyParticipantFilter('private-target')).rejects.toEqual(new FilterServiceError());
  await expect(submitMyParticipantFilter('private-target', [], 1900, 2026)).rejects.toEqual(new FilterServiceError());
  expect(mockBootstrap).not.toHaveBeenCalled();
  expect(mockRpc).not.toHaveBeenCalled();
});
