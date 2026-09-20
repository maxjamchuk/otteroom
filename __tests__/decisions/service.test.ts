import { getCandidateDecision, submitCandidateDecision, DecisionServiceError } from '../../src/decisions/service';

const mockBootstrap = jest.fn(), mockRpc = jest.fn();
jest.mock('../../src/auth/anonymous-session', () => ({ bootstrapAnonymousSession: () => mockBootstrap() }));
jest.mock('../../src/lib/supabase', () => ({ getSupabase: () => ({ rpc: mockRpc }) }));

const roomId = '11111111-1111-4111-8111-111111111111';
const undecided = [{ outcome: 'not_decided', my_decision: null,
  candidate_sequence:1,decision_completed_count: 0, required_voter_count: 2,
  decision_set_complete: false,agreement_threshold:2,candidate_outcome:'collecting',
  candidate_progression_status:'collecting' }];

beforeEach(() => {
  jest.resetAllMocks(); mockBootstrap.mockResolvedValue({ user: { id: 'private' } });
  mockRpc.mockResolvedValue({ data: undecided, error: null });
});

it('recovers with only room and expected candidate after bootstrap', async () => {
  await expect(getCandidateDecision(roomId,1,42)).resolves.toMatchObject({ outcome: 'not_decided' });
  expect(mockBootstrap.mock.invocationCallOrder[0]).toBeLessThan(mockRpc.mock.invocationCallOrder[0]);
  expect(mockRpc).toHaveBeenCalledWith('get_room_candidate_decision', {
    p_room_id: roomId,p_expected_candidate_sequence:1,p_expected_tmdb_movie_id: 42,
  });
});

it.each(['yes','no'] as const)('submits typed %s without caller/member authority', async decision => {
  mockRpc.mockResolvedValue({ data: [{ ...undecided[0], outcome: 'accepted', my_decision: decision,
    decision_completed_count: 1 }], error: null });
  await expect(submitCandidateDecision(roomId,1,42,decision)).resolves.toMatchObject({
    outcome: 'accepted', myDecision: decision,
  });
  expect(mockRpc).toHaveBeenCalledWith('submit_room_candidate_decision', {
    p_room_id: roomId,p_expected_candidate_sequence:1,p_expected_tmdb_movie_id: 42, p_decision: decision,
  });
});

it.each(['bootstrap','transport','database','contract'])('maps %s failure to one safe error', async boundary => {
  if (boundary === 'bootstrap') mockBootstrap.mockRejectedValue(new Error('private identity'));
  if (boundary === 'transport') mockRpc.mockRejectedValue(new Error('private payload'));
  if (boundary === 'database') mockRpc.mockResolvedValue({ data: undecided, error: { message: 'private sql' } });
  if (boundary === 'contract') mockRpc.mockResolvedValue({ data: [{ ...undecided[0], peer_id: 'private' }], error: null });
  await expect(getCandidateDecision(roomId,1,42)).rejects.toEqual(new DecisionServiceError());
});

it.each([
  ['not-a-room-id', 42], [roomId, 0], [roomId, -1], [roomId, 1.5],
] as const)('rejects invalid room/candidate input without opening authority', async (id, movie) => {
  await expect(getCandidateDecision(id,1,movie)).rejects.toEqual(new DecisionServiceError());
  expect(mockBootstrap).not.toHaveBeenCalled();
  expect(mockRpc).not.toHaveBeenCalled();
});

it.each([
  ['accepted', 'no'], ['unchanged', 'no'], ['conflict', 'yes'],
] as const)('rejects contradictory %s winner mapping', async (outcome, returned) => {
  mockRpc.mockResolvedValue({ data: [{ ...undecided[0], outcome, my_decision: returned,
    decision_completed_count: 1 }], error: null });
  await expect(submitCandidateDecision(roomId,1,42,'yes')).rejects.toEqual(new DecisionServiceError());
});
