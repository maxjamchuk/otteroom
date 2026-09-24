import { exactObject, UUID_PATTERN } from '../_shared/candidate-contracts.ts';
import { initializeSelectionRules } from '../_shared/selection-rules-config.ts';
import type { SelectionRules } from '../_shared/selection-rules.ts';

export const STARTUP_SELECTION_RULES = await initializeSelectionRules();

const headers = Object.freeze({ 'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type' });
const RESPONSE_FIELDS = Object.freeze(['outcome', 'room_id', 'room_code', 'room_state', 'is_creator',
  'is_voter', 'voter_count', 'required_voter_count', 'filter_completed_count',
  'filter_resolution_status', 'candidate_acquisition_status', 'candidate_progression_status',
  'candidate_sequence', 'decision_completed_count'] as const);
type RpcName = 'create_room_with_selection_rules';

type RoomCreateDependencies = Readonly<{
  verifyJwt(authorization: string): Promise<string | null>;
  rpc(name: RpcName, args: Record<string, unknown>): Promise<unknown>;
}>;

export const ROOM_CREATE_RPC_ACCEPT = 'application/vnd.pgrst.object+json';

export function roomCreateRpcHeaders(serviceKey: string): Record<string, string> {
  return {
    authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'content-type': 'application/json',
    accept: ROOM_CREATE_RPC_ACCEPT, 'content-profile': 'public',
  };
}

function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers });
}

function parseBody(value: unknown): { requestId: string; requiredVoterCount: number; creatorIsVoter: boolean } | null {
  if (!exactObject(value, ['creation_request_id', 'required_voter_count', 'creator_is_voter']) ||
      typeof value.creation_request_id !== 'string' || !UUID_PATTERN.test(value.creation_request_id) ||
      typeof value.required_voter_count !== 'number' || !Number.isSafeInteger(value.required_voter_count) ||
      value.required_voter_count < 2 || value.required_voter_count > 2147483647 ||
      typeof value.creator_is_voter !== 'boolean') return null;
  return { requestId: value.creation_request_id, requiredVoterCount: value.required_voter_count,
    creatorIsVoter: value.creator_is_voter };
}

function parseRoomResult(value: unknown): Record<string, unknown> {
  // The Edge transport deliberately returns an object.  A PostgREST row array
  // is a different contract and must not be accepted as a successful create.
  const row = value;
  if (!row || typeof row !== 'object' || Array.isArray(row) ||
      Object.keys(row).length !== RESPONSE_FIELDS.length ||
      !RESPONSE_FIELDS.every(field => Object.hasOwn(row, field))) throw new Error('internal');
  const record = row as Record<string, unknown>;
  const safeInteger = (candidate: unknown, minimum: number, maximum: number) =>
    typeof candidate === 'number' && Number.isSafeInteger(candidate) &&
    candidate >= minimum && candidate <= maximum;
  const required = record.required_voter_count;
  const voters = record.voter_count;
  const filters = record.filter_completed_count;
  const decisions = record.decision_completed_count;
  const sequence = record.candidate_sequence;
  if (!(record.outcome === 'created' || record.outcome === 'already_created') ||
      typeof record.room_id !== 'string' || !UUID_PATTERN.test(record.room_id) ||
      typeof record.room_code !== 'string' || !/^[0-9A-F]{10}$/.test(record.room_code) ||
      !(record.room_state === 'waiting' || record.room_state === 'ready') ||
      typeof record.is_creator !== 'boolean' || record.is_creator !== true ||
      typeof record.is_voter !== 'boolean' ||
      !safeInteger(required, 2, 2147483647) || !safeInteger(voters, 0, required as number) ||
      record.room_state !== (voters === required ? 'ready' : 'waiting') ||
      !safeInteger(filters, 0, required as number) ||
      !(record.filter_resolution_status === 'pending' ||
        record.filter_resolution_status === 'compatible' || record.filter_resolution_status === 'incompatible') ||
      (record.filter_resolution_status !== 'pending' &&
        (record.room_state !== 'ready' || filters !== required)) ||
      !(record.candidate_acquisition_status === 'pending' ||
        record.candidate_acquisition_status === 'assigned' || record.candidate_acquisition_status === 'no_candidates') ||
      (record.candidate_acquisition_status !== 'pending' &&
        (record.room_state !== 'ready' || filters !== required || record.filter_resolution_status !== 'compatible')) ||
      !safeInteger(decisions, 0, required as number) ||
      (decisions !== 0 &&
        (record.room_state !== 'ready' || filters !== required ||
          record.filter_resolution_status !== 'compatible' || record.candidate_acquisition_status !== 'assigned')) ||
      !safeInteger(sequence, 0, Number.MAX_SAFE_INTEGER) ||
      (sequence === 0
        ? !(record.candidate_progression_status === 'inactive' &&
          (record.candidate_acquisition_status === 'pending' || record.candidate_acquisition_status === 'no_candidates'))
        : !(record.room_state === 'ready' && filters === required &&
          record.filter_resolution_status === 'compatible' &&
          ((record.candidate_progression_status === 'collecting' &&
            record.candidate_acquisition_status === 'assigned' && (decisions as number) < (required as number)) ||
           (record.candidate_progression_status === 'agreed' &&
            record.candidate_acquisition_status === 'assigned' && decisions === required) ||
           (record.candidate_progression_status === 'advancing' &&
            record.candidate_acquisition_status === 'pending' && decisions === 0) ||
           (record.candidate_progression_status === 'exhausted' &&
            record.candidate_acquisition_status === 'no_candidates' && decisions === 0)))) ||
      (record.is_voter && voters === 0)) throw new Error('internal');
  return record;
}

export function createRoomCreateHandler(dependencies: RoomCreateDependencies, rules: SelectionRules = STARTUP_SELECTION_RULES) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return json(204);
    if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
    const authorization = request.headers.get('authorization') ?? '';
    let actor: string | null = null;
    try { actor = await dependencies.verifyJwt(authorization); } catch { /* fixed response below */ }
    if (!actor || !UUID_PATTERN.test(actor)) return json(401, { error: 'authentication_required' });
    let body: unknown;
    try { body = await request.json(); } catch { return json(400, { error: 'invalid_request' }); }
    const parsed = parseBody(body);
    if (!parsed) return json(400, { error: 'invalid_request' });
    try {
      const result = parseRoomResult(await dependencies.rpc('create_room_with_selection_rules', {
        p_actor_user_id: actor,
        p_creation_request_id: parsed.requestId,
        p_required_voter_count: parsed.requiredVoterCount,
        p_creator_is_voter: parsed.creatorIsVoter,
        p_rule_set_kind: rules.ruleSetKind,
        p_candidate_ordering: rules.ordering,
        p_minimum_vote_count: rules.minimumVoteCount,
        p_minimum_average_rating: rules.minimumAverageRating,
        p_metadata_language: rules.metadataLanguage,
        p_genre_mode: rules.genreMode,
        p_agreement_numerator: rules.agreementNumerator,
        p_agreement_denominator: rules.agreementDenominator,
      }));
      return json(200, result);
    } catch { return json(503, { error: 'room_creation_unavailable' }); }
  };
}

function required(name: string): string {
  const value = Deno.env.get(name); if (!value) throw new Error(`missing_${name}`); return value;
}

function productionDependencies(): RoomCreateDependencies {
  const supabaseUrl = required('SUPABASE_URL');
  const anonKey = required('SUPABASE_ANON_KEY');
  const serviceKey = required('SUPABASE_SERVICE_ROLE_KEY');
  return {
    verifyJwt: async authorization => {
      if (!/^Bearer\s+\S+$/.test(authorization)) return null;
      const response = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: {
        authorization, apikey: anonKey, accept: 'application/json',
      } });
      if (!response.ok) return null;
      const body: unknown = await response.json();
      return body && typeof body === 'object' && !Array.isArray(body) &&
        typeof (body as Record<string, unknown>).id === 'string' ? (body as Record<string, unknown>).id as string : null;
    },
    rpc: async (name, args) => {
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, { method: 'POST', headers: {
        ...roomCreateRpcHeaders(serviceKey),
      }, body: JSON.stringify(args) });
      if (!response.ok) throw new Error('rpc_failed');
      return await response.json();
    },
  };
}

if (import.meta.main) Deno.serve(createRoomCreateHandler(productionDependencies()));
