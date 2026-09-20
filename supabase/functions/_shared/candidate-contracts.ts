export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type CandidateConstraint = Readonly<{
  releaseYearFrom: number;
  releaseYearTo: number;
  clauses: readonly (readonly number[])[];
  excludedTmdbMovieIds?: readonly number[];
}>;

export type TmdbMovie = Readonly<{
  id: number;
  adult: boolean;
  genreIds: readonly number[];
  title: string;
  releaseDate: string;
  posterPath: string | null;
}>;

export type SearchResult =
  | Readonly<{ kind: 'match'; movie: TmdbMovie }>
  | Readonly<{ kind: 'completed_empty' }>
  | Readonly<{ kind: 'search_incomplete'; reason: FailureClass }>;

export type FailureClass = 'timeout' | 'rate_limited' | 'upstream' | 'request_rejected' |
  'malformed_response' | 'pagination_inconsistent' | 'request_budget' | 'deadline' |
  'single_day_overflow' | 'internal';

export type PreflightResult =
  | Readonly<{ outcome: 'not_found' }>
  | Readonly<{ outcome: 'not_ready' }>
  | Readonly<{ outcome: 'no_candidates'; candidate_sequence: 0; candidate_progression_status: 'inactive' }>
  | Readonly<{ outcome: 'exhausted'; candidate_sequence: number; candidate_progression_status: 'exhausted' }>
  | Readonly<{ outcome: 'assigned'; candidate_sequence: number;
      candidate_progression_status: 'collecting' | 'agreed'; tmdb_movie_id: number }>
  | Readonly<{ outcome: 'acquire'; release_year_from: number; release_year_to: number;
      candidate_sequence: number; candidate_progression_status: 'inactive' | 'advancing';
      genre_clauses_tmdb_ids: readonly (readonly number[])[];
      excluded_tmdb_movie_ids: readonly number[] }>;

export type CommitResult = Readonly<{
  outcome: 'assigned' | 'no_candidates' | 'exhausted' | 'refresh_required' | 'not_found' | 'not_ready';
  candidate_sequence: number | null;
  candidate_progression_status: 'inactive' | 'collecting' | 'agreed' | 'exhausted' | null;
  tmdb_movie_id: number | null;
}>;

export type CandidatePresentation = Readonly<{
  tmdbMovieId: number;
  title: string;
  releaseYear: number;
  posterUrl: string | null;
}>;

export type RpcName = 'prepare_room_tmdb_candidate' | 'commit_room_tmdb_candidate' |
  'commit_room_tmdb_no_candidates';

export type EdgeDependencies = Readonly<{
  verifyJwt(authorization: string): Promise<string | null>;
  rpc(name: RpcName, args: Record<string, unknown>): Promise<unknown>;
  search(constraint: CandidateConstraint): Promise<SearchResult>;
  details(tmdbMovieId: number): Promise<CandidatePresentation>;
  log?(stage: string, failure: FailureClass | 'none', durationMs: number, count?: number): void;
  now?(): number;
}>;

export type SearchDependencies = Readonly<{
  fetch: FetchLike;
  token: string;
  baseUrl?: string;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
  maxRequests?: number;
  deadlineMs?: number;
  onMovieEvaluated?: (movie: TmdbMovie) => void;
}>;

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function exactObject(value: unknown, fields: readonly string[]): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field));
}
