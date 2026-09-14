import { exactObject, positiveInteger, UUID_PATTERN, type CandidateConstraint,
  type CandidatePresentation, type CommitResult, type EdgeDependencies, type PreflightResult,
  type RpcName } from '../_shared/candidate-contracts.ts';
import { parseConstraint } from '../_shared/tmdb-eligibility.ts';
import { loadTmdbPresentation, searchTmdbCandidate } from '../_shared/tmdb-client.ts';

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
  if (!exactObject(row, ['outcome','tmdb_movie_id','release_year_from','release_year_to',
      'genre_clauses_tmdb_ids'])) throw new Error('internal');
  if (row.outcome === 'acquire') {
    if (row.tmdb_movie_id !== null) throw new Error('internal');
    const constraint = parseConstraint({ release_year_from: row.release_year_from,
      release_year_to: row.release_year_to, genre_clauses_tmdb_ids: row.genre_clauses_tmdb_ids });
    return { outcome: 'acquire', release_year_from: constraint.releaseYearFrom,
      release_year_to: constraint.releaseYearTo, genre_clauses_tmdb_ids: constraint.clauses };
  }
  if (row.outcome === 'assigned' && positiveInteger(row.tmdb_movie_id) &&
      row.release_year_from === null && row.release_year_to === null && row.genre_clauses_tmdb_ids === null)
    return { outcome: 'assigned', tmdb_movie_id: row.tmdb_movie_id };
  if ((row.outcome === 'not_found' || row.outcome === 'not_ready' || row.outcome === 'no_candidates') &&
      row.tmdb_movie_id === null && row.release_year_from === null &&
      row.release_year_to === null && row.genre_clauses_tmdb_ids === null)
    return { outcome: row.outcome };
  throw new Error('internal');
}

function parseCommit(value: unknown): CommitResult {
  value = singleton(value);
  if (!exactObject(value, ['outcome','tmdb_movie_id'])) throw new Error('internal');
  if (value.outcome === 'assigned' && positiveInteger(value.tmdb_movie_id))
    return { outcome: 'assigned', tmdb_movie_id: value.tmdb_movie_id };
  if (value.outcome === 'no_candidates' && value.tmdb_movie_id === null)
    return { outcome: 'no_candidates', tmdb_movie_id: null };
  throw new Error('internal');
}

function presentationResponse(candidate: CandidatePresentation): Response {
  return json(200, { outcome: 'available', candidate: { tmdb_movie_id: candidate.tmdbMovieId,
    title: candidate.title, release_year: candidate.releaseYear, poster_url: candidate.posterUrl } });
}

async function metadata(dependencies: EdgeDependencies, id: number): Promise<Response> {
  try {
    const candidate = await dependencies.details(id);
    if (candidate.posterUrl !== null) {
      const poster = new URL(candidate.posterUrl);
      if (poster.protocol !== 'https:' || poster.username || poster.password) throw new Error('internal');
    }
    if (candidate.tmdbMovieId !== id || typeof candidate.title !== 'string' ||
        !candidate.title || candidate.title.trim() !== candidate.title ||
        !Number.isInteger(candidate.releaseYear) || candidate.releaseYear < 1888 ||
        candidate.releaseYear > 9999) throw new Error('internal');
    return presentationResponse(candidate);
  } catch { return json(200, { outcome: 'metadata_unavailable' }); }
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
      if (preflight.outcome === 'not_found' || preflight.outcome === 'not_ready' ||
          preflight.outcome === 'no_candidates') return json(200, { outcome: preflight.outcome });
      if (preflight.outcome === 'assigned') return await metadata(dependencies, preflight.tmdb_movie_id);

      const constraint: CandidateConstraint = { releaseYearFrom: preflight.release_year_from,
        releaseYearTo: preflight.release_year_to, clauses: preflight.genre_clauses_tmdb_ids };
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
        }));
      } else {
        committed = parseCommit(await dependencies.rpc('commit_room_tmdb_candidate', {
          p_room_id: roomId, p_actor_user_id: actor, p_tmdb_movie_id: search.movie.id,
          p_release_year: Number(search.movie.releaseDate.slice(0, 4)),
          p_tmdb_genre_ids: [...search.movie.genreIds], p_adult: search.movie.adult,
        }));
      }
      if (committed.outcome === 'no_candidates') return json(200, { outcome: 'no_candidates' });
      return await metadata(dependencies, committed.tmdb_movie_id!);
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
    details: id => loadTmdbPresentation(id, common),
    log: (stage, failure, durationMs, count = 0) => console.log(JSON.stringify({
      event: 'room_candidate', stage, failure, duration_ms: Math.round(durationMs), count,
    })),
  };
}

if (import.meta.main) Deno.serve(createRoomCandidateHandler(productionDependencies()));
