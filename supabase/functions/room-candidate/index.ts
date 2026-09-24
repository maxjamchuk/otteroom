import { exactObject, positiveInteger, UUID_PATTERN, type CandidateConstraint,
  type CandidatePresentation, type CommitResult, type EdgeDependencies, type PreflightResult,
  type RpcName } from '../_shared/candidate-contracts.ts';
import { parseConstraint } from '../_shared/tmdb-eligibility.ts';
import { loadTmdbPresentation, searchTmdbCandidate } from '../_shared/tmdb-client.ts';
import { initializeSelectionRules } from '../_shared/selection-rules-config.ts';
import { TMDB_PRIMARY_TRANSLATION_SET } from '../_shared/tmdb-primary-translations.ts';

// Deliberately await before the production handler is constructed. The value is
// only a startup liveness check for this entrypoint; existing rooms always use
// the private retained snapshot returned by preflight.
export const STARTUP_SELECTION_RULES = await initializeSelectionRules();

const headers = Object.freeze({ 'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type' });
export const SERVER_RPC_NAMES = Object.freeze(['prepare_room_tmdb_candidate',
  'commit_room_tmdb_candidate','commit_room_tmdb_no_candidates'] as const);

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

function singleton(value: unknown): unknown {
  return Array.isArray(value) && value.length === 1 ? value[0] : value;
}

function parsePreflight(value: unknown): PreflightResult {
  value = singleton(value);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('internal');
  const row = value as Record<string, unknown>;
  if (!exactObject(row, ['outcome','candidate_sequence','candidate_progression_status',
      'tmdb_movie_id','release_year_from','release_year_to','genre_clauses_tmdb_ids',
      'excluded_tmdb_movie_ids','rule_set_kind','candidate_ordering','minimum_vote_count',
      'minimum_average_rating','metadata_language','genre_mode'])) throw new Error('internal');
  if (row.outcome === 'acquire') {
    if (row.tmdb_movie_id !== null || !Number.isSafeInteger(row.candidate_sequence) ||
        (row.candidate_sequence as number) < 0 ||
        !(row.candidate_progression_status === 'inactive' && row.candidate_sequence === 0 ||
          row.candidate_progression_status === 'advancing' && (row.candidate_sequence as number) > 0) ||
        !Array.isArray(row.excluded_tmdb_movie_ids) ||
        !row.excluded_tmdb_movie_ids.every(positiveInteger) ||
        new Set(row.excluded_tmdb_movie_ids).size !== row.excluded_tmdb_movie_ids.length ||
        (row.rule_set_kind !== 'legacy_005_006_008' && row.rule_set_kind !== 'configured_009_v1') ||
        typeof row.candidate_ordering !== 'string' ||
        (row.minimum_vote_count !== null && !(typeof row.minimum_vote_count === 'number' &&
          Number.isSafeInteger(row.minimum_vote_count) && row.minimum_vote_count >= 0)) ||
        (row.minimum_average_rating !== null && !(typeof row.minimum_average_rating === 'number' &&
          Number.isFinite(row.minimum_average_rating) && row.minimum_average_rating >= 0 && row.minimum_average_rating <= 10)) ||
        typeof row.metadata_language !== 'string' || !TMDB_PRIMARY_TRANSLATION_SET.has(row.metadata_language) ||
        (row.genre_mode !== 'or' && row.genre_mode !== 'and'))
      throw new Error('internal');
    const constraint = parseConstraint({ release_year_from: row.release_year_from,
      release_year_to: row.release_year_to, genre_clauses_tmdb_ids: row.genre_clauses_tmdb_ids,
      rule_set_kind: row.rule_set_kind, candidate_ordering: row.candidate_ordering,
      minimum_vote_count: row.minimum_vote_count, minimum_average_rating: row.minimum_average_rating,
      metadata_language: row.metadata_language, genre_mode: row.genre_mode });
    return { outcome: 'acquire', candidate_sequence: row.candidate_sequence as number,
      candidate_progression_status: row.candidate_progression_status,
      release_year_from: constraint.releaseYearFrom, release_year_to: constraint.releaseYearTo,
      genre_clauses_tmdb_ids: constraint.clauses,
      excluded_tmdb_movie_ids: Object.freeze([...(row.excluded_tmdb_movie_ids as number[])]),
      rule_set_kind: constraint.ruleSetKind!, candidate_ordering: constraint.ordering!,
      minimum_vote_count: constraint.minimumVoteCount!, minimum_average_rating: constraint.minimumAverageRating!,
      metadata_language: constraint.metadataLanguage!, genre_mode: constraint.genreMode! };
  }
  const noRules = row.rule_set_kind === null && row.candidate_ordering === null &&
    row.minimum_vote_count === null && row.minimum_average_rating === null &&
    row.genre_mode === null;
  if (row.outcome === 'assigned' && positiveInteger(row.candidate_sequence) &&
      (row.candidate_progression_status === 'collecting' || row.candidate_progression_status === 'agreed') &&
      positiveInteger(row.tmdb_movie_id) && row.release_year_from === null &&
      row.release_year_to === null && row.genre_clauses_tmdb_ids === null &&
      row.excluded_tmdb_movie_ids === null && noRules && typeof row.metadata_language === 'string' &&
      TMDB_PRIMARY_TRANSLATION_SET.has(row.metadata_language))
    return { outcome: 'assigned', candidate_sequence: row.candidate_sequence,
      candidate_progression_status: row.candidate_progression_status, tmdb_movie_id: row.tmdb_movie_id,
      metadata_language: row.metadata_language };
  if (row.outcome === 'no_candidates' && row.candidate_sequence === 0 &&
      row.candidate_progression_status === 'inactive' && row.tmdb_movie_id === null &&
      row.release_year_from === null && row.release_year_to === null &&
      row.genre_clauses_tmdb_ids === null && row.excluded_tmdb_movie_ids === null &&
      noRules && row.metadata_language === null)
    return { outcome: 'no_candidates', candidate_sequence: 0,
      candidate_progression_status: 'inactive' };
  if (row.outcome === 'exhausted' && positiveInteger(row.candidate_sequence) &&
      row.candidate_progression_status === 'exhausted' && row.tmdb_movie_id === null &&
      row.release_year_from === null && row.release_year_to === null &&
      row.genre_clauses_tmdb_ids === null && row.excluded_tmdb_movie_ids === null &&
      noRules && row.metadata_language === null)
    return { outcome: 'exhausted', candidate_sequence: row.candidate_sequence,
      candidate_progression_status: 'exhausted' };
  if ((row.outcome === 'not_found' || row.outcome === 'not_ready') &&
      row.candidate_sequence === null && row.candidate_progression_status === null &&
      row.tmdb_movie_id === null && row.release_year_from === null &&
      row.release_year_to === null && row.genre_clauses_tmdb_ids === null &&
      row.excluded_tmdb_movie_ids === null && noRules && row.metadata_language === null)
    return { outcome: row.outcome };
  throw new Error('internal');
}

function parseCommit(value: unknown): CommitResult {
  value = singleton(value);
  if (!exactObject(value, ['outcome','candidate_sequence','candidate_progression_status','tmdb_movie_id']))
    throw new Error('internal');
  if (value.outcome === 'assigned' && positiveInteger(value.candidate_sequence) &&
      (value.candidate_progression_status === 'collecting' || value.candidate_progression_status === 'agreed') &&
      positiveInteger(value.tmdb_movie_id)) return value as CommitResult;
  if (value.outcome === 'no_candidates' && value.candidate_sequence === 0 &&
      value.candidate_progression_status === 'inactive' && value.tmdb_movie_id === null)
    return value as CommitResult;
  if (value.outcome === 'exhausted' && positiveInteger(value.candidate_sequence) &&
      value.candidate_progression_status === 'exhausted' && value.tmdb_movie_id === null)
    return value as CommitResult;
  if ((value.outcome === 'refresh_required' || value.outcome === 'not_found' ||
      value.outcome === 'not_ready') && value.candidate_sequence === null &&
      value.candidate_progression_status === null && value.tmdb_movie_id === null)
    return value as CommitResult;
  throw new Error('internal');
}

function presentationResponse(candidate: CandidatePresentation, sequence: number,
  progression: 'collecting' | 'agreed'): Response {
  return json(200, { outcome: 'available', candidate_sequence: sequence,
    candidate_progression_status: progression,
    candidate: { tmdb_movie_id: candidate.tmdbMovieId,
    title: candidate.title, release_year: candidate.releaseYear, poster_url: candidate.posterUrl } });
}

async function metadata(dependencies: EdgeDependencies, id: number, sequence: number,
  progression: 'collecting' | 'agreed', language = 'en-US'): Promise<Response> {
  try {
    const candidate = await dependencies.details(id, language);
    if (candidate.posterUrl !== null) {
      const poster = new URL(candidate.posterUrl);
      if (poster.protocol !== 'https:' || poster.username || poster.password) throw new Error('internal');
    }
    if (candidate.tmdbMovieId !== id || typeof candidate.title !== 'string' ||
        !candidate.title || candidate.title.trim() !== candidate.title ||
        !Number.isInteger(candidate.releaseYear) || candidate.releaseYear < 1888 ||
        candidate.releaseYear > 9999) throw new Error('internal');
    return presentationResponse(candidate, sequence, progression);
  } catch { return json(200, { outcome: 'metadata_unavailable', candidate_sequence: sequence,
    candidate_progression_status: progression }); }
}

function parseBody(value: unknown): string | null {
  return exactObject(value, ['room_id']) && typeof value.room_id === 'string' &&
    UUID_PATTERN.test(value.room_id) ? value.room_id : null;
}

export function createRoomCandidateHandler(dependencies: EdgeDependencies) {
  return async (request: Request): Promise<Response> => {
    const start = dependencies.now?.() ?? performance.now();
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
    const authorization = request.headers.get('authorization') ?? '';
    let actor: string | null = null;
    try { actor = await dependencies.verifyJwt(authorization); } catch { /* fixed auth response below */ }
    if (!actor || !UUID_PATTERN.test(actor)) return json(401, { error: 'authentication_required' });
    let value: unknown;
    try { value = await request.json(); } catch { return json(400, { error: 'invalid_request' }); }
    const roomId = parseBody(value);
    if (!roomId) return json(400, { error: 'invalid_request' });

    try {
      const preflight = parsePreflight(await dependencies.rpc('prepare_room_tmdb_candidate', {
        p_room_id: roomId, p_actor_user_id: actor,
      }));
      if (preflight.outcome === 'not_found' || preflight.outcome === 'not_ready')
        return json(200, { outcome: preflight.outcome });
      if (preflight.outcome === 'no_candidates') return json(200, { outcome: 'no_candidates' });
      if (preflight.outcome === 'exhausted') return json(200, { outcome: 'exhausted',
        candidate_sequence: preflight.candidate_sequence, candidate_progression_status: 'exhausted' });
      if (preflight.outcome === 'assigned') return await metadata(dependencies,
      preflight.tmdb_movie_id, preflight.candidate_sequence, preflight.candidate_progression_status,
      preflight.metadata_language);

      const constraint: CandidateConstraint = { releaseYearFrom: preflight.release_year_from,
        releaseYearTo: preflight.release_year_to, clauses: preflight.genre_clauses_tmdb_ids,
        ruleSetKind: preflight.rule_set_kind, ordering: preflight.candidate_ordering,
        minimumVoteCount: preflight.minimum_vote_count, minimumAverageRating: preflight.minimum_average_rating,
        metadataLanguage: preflight.metadata_language, genreMode: preflight.genre_mode,
        excludedTmdbMovieIds: preflight.excluded_tmdb_movie_ids };
      const search = await dependencies.search(constraint);
      if (search.kind === 'search_incomplete') {
        dependencies.log?.('discover', search.reason,
          (dependencies.now?.() ?? performance.now()) - start);
        return json(503, { error: 'candidate_acquisition_unavailable' });
      }
      let committed: CommitResult;
      if (search.kind === 'completed_empty') {
        committed = parseCommit(await dependencies.rpc('commit_room_tmdb_no_candidates', {
          p_room_id: roomId, p_actor_user_id: actor,
          p_expected_candidate_sequence: preflight.candidate_sequence,
        }));
      } else {
        committed = parseCommit(await dependencies.rpc('commit_room_tmdb_candidate', {
          p_room_id: roomId, p_actor_user_id: actor,
          p_expected_candidate_sequence: preflight.candidate_sequence,
          p_tmdb_movie_id: search.movie.id,
          p_release_year: Number(search.movie.releaseDate.slice(0, 4)),
          p_tmdb_genre_ids: [...search.movie.genreIds], p_adult: search.movie.adult,
          p_vote_count: search.movie.voteCount ?? null, p_vote_average: search.movie.voteAverage ?? null,
        }));
      }
      if (committed.outcome === 'not_found' || committed.outcome === 'not_ready' ||
          committed.outcome === 'refresh_required') return json(200, { outcome: committed.outcome });
      if (committed.outcome === 'no_candidates') return json(200, { outcome: 'no_candidates' });
      if (committed.outcome === 'exhausted') return json(200, { outcome: 'exhausted',
        candidate_sequence: committed.candidate_sequence, candidate_progression_status: 'exhausted' });
      return await metadata(dependencies, committed.tmdb_movie_id!, committed.candidate_sequence!,
        committed.candidate_progression_status as 'collecting' | 'agreed', preflight.metadata_language);
    } catch {
      dependencies.log?.('operation', 'internal', (dependencies.now?.() ?? performance.now()) - start);
      return json(503, { error: 'candidate_acquisition_unavailable' });
    }
  };
}

function required(name: string): string {
  const value = Deno.env.get(name); if (!value) throw new Error(`missing_${name}`); return value;
}

function productionDependencies(): EdgeDependencies {
  const supabaseUrl = required('SUPABASE_URL');
  const anonKey = required('SUPABASE_ANON_KEY');
  const serviceKey = required('SUPABASE_SERVICE_ROLE_KEY');
  const token = required('TMDB_API_READ_ACCESS_TOKEN');
  const tmdbBaseUrl = Deno.env.get('TMDB_API_BASE_URL') ?? 'https://api.themoviedb.org/3';
  const common = { fetch, token, baseUrl: tmdbBaseUrl };
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
    rpc: async (name: RpcName, args) => {
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, { method: 'POST', headers: {
        authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'content-type': 'application/json',
        accept: 'application/json', 'content-profile': 'public',
      }, body: JSON.stringify(args) });
      if (!response.ok) throw new Error('rpc_failed');
      return await response.json();
    },
    search: constraint => searchTmdbCandidate(constraint, common),
    details: (id, language) => loadTmdbPresentation(id, common, language ?? 'en-US'),
    log: (stage, failure, durationMs, count = 0) => console.log(JSON.stringify({
      event: 'room_candidate', stage, failure, duration_ms: Math.round(durationMs), count,
    })),
  };
}

if (import.meta.main) Deno.serve(createRoomCandidateHandler(productionDependencies()));
