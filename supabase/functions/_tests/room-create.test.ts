import { assertEquals, assertFalse } from './assert.ts';
import { createRoomCreateHandler, ROOM_CREATE_RPC_ACCEPT, roomCreateRpcHeaders } from '../room-create/index.ts';
import type { SelectionRules } from '../_shared/selection-rules.ts';

const actor = '22222222-2222-4222-8222-222222222222';
const requestId = '11111111-1111-4111-8111-111111111111';
const rules: SelectionRules = Object.freeze({ ruleSetKind: 'configured_009_v1', ordering: 'vote_count_desc',
  minimumVoteCount: 500, minimumAverageRating: null, metadataLanguage: 'en-US', genreMode: 'or',
  agreementNumerator: 2, agreementDenominator: 3 });
const row = { outcome: 'created', room_id: '33333333-3333-4333-8333-333333333333', room_code: 'ABCDEF0123',
  room_state: 'waiting', is_creator: true, is_voter: true, voter_count: 1, required_voter_count: 2,
  filter_completed_count: 0, filter_resolution_status: 'pending', candidate_acquisition_status: 'pending',
  candidate_progression_status: 'inactive', candidate_sequence: 0, decision_completed_count: 0 };
const request = (body: unknown, method = 'POST', authorization = 'Bearer current') => new Request('http://local/room-create', {
  method, headers: { authorization, 'content-type': 'application/json' }, body: method === 'POST' ? JSON.stringify(body) : undefined,
});

function handler(overrides: Partial<Parameters<typeof createRoomCreateHandler>[0]> = {}) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const value = createRoomCreateHandler({ verifyJwt: async () => actor, rpc: async (name, args) => {
    calls.push({ name, args }); return row;
  }, ...overrides }, rules);
  return { value, calls };
}

Deno.test('room-create accepts only the exact legacy create body and sends the frozen generation', async () => {
  const h = handler();
  const response = await h.value(request({ creation_request_id: requestId, required_voter_count: 2, creator_is_voter: true }));
  assertEquals(response.status, 200);
  assertEquals(await response.json(), row);
  assertEquals(h.calls, [{ name: 'create_room_with_selection_rules', args: {
    p_actor_user_id: actor, p_creation_request_id: requestId, p_required_voter_count: 2, p_creator_is_voter: true,
    p_rule_set_kind: 'configured_009_v1', p_candidate_ordering: 'vote_count_desc', p_minimum_vote_count: 500,
    p_minimum_average_rating: null, p_metadata_language: 'en-US', p_genre_mode: 'or', p_agreement_numerator: 2,
    p_agreement_denominator: 3,
  }}]);
});

Deno.test('room-create rejects auth/body/method failures with fixed safe responses', async () => {
  const h = handler({ verifyJwt: async () => null });
  assertEquals((await h.value(request({ creation_request_id: requestId, required_voter_count: 2, creator_is_voter: true }))).status, 401);
  for (const body of [{}, { creation_request_id: requestId, required_voter_count: 2, creator_is_voter: true, rule_set_kind: 'private' },
    { creation_request_id: requestId, required_voter_count: 1, creator_is_voter: true }]) {
    const response = await handler().value(request(body));
    assertEquals(response.status, 400); assertEquals(await response.json(), { error: 'invalid_request' });
  }
  const method = await handler().value(request({}, 'GET'));
  assertEquals(method.status, 405); assertEquals(await method.json(), { error: 'method_not_allowed' });
  const failure = await handler({ rpc: async () => { throw new Error('private snapshot 2/3'); } }).value(
    request({ creation_request_id: requestId, required_voter_count: 2, creator_is_voter: true }));
  assertEquals(failure.status, 503); assertFalse((await failure.text()).includes('snapshot'));
});

Deno.test('room-create rejects private fields in malformed successful responses', async () => {
  const h = handler({ rpc: async () => [{ ...row, minimum_vote_count: 500 }] });
  const response = await h.value(request({ creation_request_id: requestId, required_voter_count: 2, creator_is_voter: true }));
  assertEquals(response.status, 503);
});

Deno.test('room-create negotiates one object from the set-returning creation RPC', () => {
  assertEquals(ROOM_CREATE_RPC_ACCEPT, 'application/vnd.pgrst.object+json');
  assertEquals(roomCreateRpcHeaders('service-role-test'), {
    authorization: 'Bearer service-role-test', apikey: 'service-role-test',
    'content-type': 'application/json', accept: 'application/vnd.pgrst.object+json',
    'content-profile': 'public',
  });
});

Deno.test('the M01 create predicate fails on the un-negotiated row-array failure before join recovery', async () => {
  const h = handler({ rpc: async () => [row] });
  const response = await h.value(request({ creation_request_id: requestId, required_voter_count: 2, creator_is_voter: true }));
  const body = await response.json();
  const createPredicate = response.ok && !Array.isArray(body) && body && body.outcome === 'created' &&
    Object.keys(body).sort().join(',') === 'candidate_acquisition_status,candidate_progression_status,candidate_sequence,decision_completed_count,filter_completed_count,filter_resolution_status,is_creator,is_voter,outcome,required_voter_count,room_code,room_id,room_state,voter_count' &&
    body.room_state === 'waiting' && body.voter_count === 1 && body.required_voter_count === 2 &&
    body.filter_completed_count === 0 && body.filter_resolution_status === 'pending' &&
    body.candidate_acquisition_status === 'pending' && body.candidate_progression_status === 'inactive' &&
    body.candidate_sequence === 0 && body.decision_completed_count === 0;
  assertFalse(createPredicate);
  assertEquals(response.status, 503);
  assertEquals(body, { error: 'room_creation_unavailable' });
});
