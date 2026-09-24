import { exactObject, positiveInteger, type CandidateConstraint, type TmdbMovie } from './candidate-contracts.ts';
import { GENRE_MODES, ORDERINGS } from './selection-rules.ts';
import { TMDB_PRIMARY_TRANSLATION_SET } from './tmdb-primary-translations.ts';

export const TMDB_GENRE_IDS = Object.freeze({
  action: 28, adventure: 12, animation: 16, comedy: 35, crime: 80, documentary: 99,
  drama: 18, family: 10751, fantasy: 14, history: 36, horror: 27, music: 10402,
  mystery: 9648, romance: 10749, science_fiction: 878, tv_movie: 10770, thriller: 53,
  war: 10752, western: 37,
});

const canonicalIds = new Set<number>(Object.values(TMDB_GENRE_IDS));
const legacyRules = Object.freeze({
  ruleSetKind: 'legacy_005_006_008' as const, ordering: 'legacy_source_order' as const,
  minimumVoteCount: null, minimumAverageRating: null, metadataLanguage: 'en-US', genreMode: 'or' as const,
});

export type RequiredMetric = 'vote_count' | 'vote_average' | 'popularity';

export function requiredMetrics(constraint: CandidateConstraint): ReadonlySet<RequiredMetric> {
  const required = new Set<RequiredMetric>();
  const ordering = constraint.ordering ?? 'legacy_source_order';
  if ((constraint.minimumVoteCount ?? null) !== null || ordering === 'vote_count_desc') required.add('vote_count');
  if ((constraint.minimumAverageRating ?? null) !== null || ordering === 'average_rating_desc') required.add('vote_average');
  if (ordering === 'popularity_desc') required.add('popularity');
  const configured = constraint.ruleSetKind === 'configured_009_v1' ||
    (constraint.ruleSetKind === undefined && (ordering !== 'legacy_source_order' ||
      constraint.minimumVoteCount !== undefined || constraint.minimumAverageRating !== undefined));
  if (!configured) return new Set();
  return required;
}

export type GenrePushdown = Readonly<{
  representation: 'exact' | 'partial' | 'none';
  // withGenres is the single-query safe fallback. branches is the query union
  // used by configured traversal when an exact bounded decomposition exists.
  withGenres: string | null;
  branches: readonly (string | null)[];
  normalizedClauses: readonly (readonly number[])[];
  localRemainder: readonly (readonly number[])[];
}>;

export const MAX_EXACT_GENRE_BRANCHES = 12;

function compareClauses(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) return a.length - b.length;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

function minimalHittingSets(clauses: readonly (readonly number[])[]): readonly (readonly number[])[] | null {
  let sets: number[][] = [[]];
  for (const clause of clauses) {
    const expanded = sets.flatMap(set => clause.some(id => set.includes(id)) ? [set] :
      clause.map(id => [...set, id].sort((a, b) => a - b)));
    // Prune after each clause. Stopping early is safe: the caller retains its
    // conservative single-query fallback when the intermediate union is large.
    if (expanded.length > MAX_EXACT_GENRE_BRANCHES * 19) return null;
    expanded.sort(compareClauses);
    sets = expanded.filter((set, index) => !expanded.some((other, otherIndex) =>
      otherIndex !== index && other.length <= set.length &&
      other.every(id => set.includes(id)) &&
      (other.length < set.length || otherIndex < index)));
    if (sets.length > MAX_EXACT_GENRE_BRANCHES) return null;
  }
  return sets.sort(compareClauses);
}

// Each clause is an OR; the collection is an AND. A smaller set subsumes a
// larger one: (A|B) AND (A|B|C) is just (A|B).
export function compileGenrePushdown(clauses: readonly (readonly number[])[]): GenrePushdown {
  const canonical = clauses.map(clause => [...new Set(clause)].sort((a, b) => a - b))
    .filter(clause => clause.length > 0).sort(compareClauses);
  const normalized = canonical.filter((clause, index) => !canonical.some((other, otherIndex) =>
    otherIndex !== index && other.length <= clause.length &&
    other.every(id => clause.includes(id)) &&
    (other.length < clause.length || otherIndex < index)));
  if (!normalized.length) return { representation: 'none', withGenres: null, branches: [null],
    normalizedClauses: normalized, localRemainder: [] };
  if (normalized.length === 1) return { representation: 'exact', withGenres: normalized[0].join('|'),
    branches: [normalized[0].join('|')],
    normalizedClauses: normalized, localRemainder: [] };
  const singletons = normalized.filter(clause => clause.length === 1);
  const fallback = singletons.length ? singletons.map(clause => clause[0]).sort((a, b) => a - b).join(',') :
    normalized[0].join('|');
  if (singletons.length === normalized.length) return { representation: 'exact', withGenres: fallback,
    branches: [fallback], normalizedClauses: normalized, localRemainder: [] };
  const minimal = minimalHittingSets(normalized);
  if (minimal !== null) return { representation: 'exact', withGenres: fallback,
    branches: minimal.map(set => set.join(',')), normalizedClauses: normalized, localRemainder: [] };
  // TMDB documents comma-AND and pipe-OR, but no grouping rule for a mixed
  // expression. Retain a necessary predicate when exact branch count exceeds
  // the bound; local validation still checks every normalized clause.
  return { representation: 'partial', withGenres: fallback, branches: [fallback],
    normalizedClauses: normalized, localRemainder: singletons.length ?
      normalized.filter(clause => clause.length > 1) : normalized.slice(1) };
}

type DiscoverOptions = Pick<CandidateConstraint, 'ruleSetKind' | 'ordering' | 'minimumVoteCount' |
  'minimumAverageRating' | 'metadataLanguage' | 'genreMode'>;

function normalizedOptions(options?: DiscoverOptions): Required<DiscoverOptions> {
  const configured = options?.ruleSetKind === 'configured_009_v1' ||
    (options?.ruleSetKind === undefined && (options?.ordering !== undefined && options.ordering !== 'legacy_source_order' ||
      options?.minimumVoteCount !== undefined || options?.minimumAverageRating !== undefined));
  return {
    ruleSetKind: configured ? 'configured_009_v1' : legacyRules.ruleSetKind,
    ordering: options?.ordering ?? legacyRules.ordering,
    minimumVoteCount: options?.minimumVoteCount ?? null,
    minimumAverageRating: options?.minimumAverageRating ?? null,
    metadataLanguage: options?.metadataLanguage ?? legacyRules.metadataLanguage,
    genreMode: options?.genreMode ?? legacyRules.genreMode,
  };
}

function sortBy(ordering: Required<DiscoverOptions>['ordering']): string {
  return ordering === 'vote_count_desc' ? 'vote_count.desc' : ordering === 'average_rating_desc' ? 'vote_average.desc' :
    ordering === 'popularity_desc' ? 'popularity.desc' : ordering === 'title_asc' ? 'title.asc' : 'primary_release_date.asc';
}

export function buildDiscoverUrl(baseUrl: string, fromYear: number, toYear: number, page: number,
  clauses: readonly (readonly number[])[], fromDate = `${fromYear}-01-01`, toDate = `${toYear}-12-31`,
  options?: DiscoverOptions, branchWithGenres?: string | null): URL {
  const selected = normalizedOptions(options);
  const url = new URL(`${baseUrl.replace(/\/$/, '')}/discover/movie`);
  const parameters: Array<[string, string]> = [
    ['language', selected.metadataLanguage], ['include_adult', 'false'], ['include_video', 'false'],
    ['sort_by', sortBy(selected.ordering)], ['primary_release_date.gte', fromDate],
    ['primary_release_date.lte', toDate], ['page', String(page)],
  ];
  if (selected.ruleSetKind === 'configured_009_v1') {
    if (selected.minimumVoteCount !== null) parameters.push(['vote_count.gte', String(selected.minimumVoteCount)]);
    if (selected.minimumAverageRating !== null) parameters.push(['vote_average.gte', String(selected.minimumAverageRating)]);
  }
  const genrePushdown = compileGenrePushdown(clauses);
  const withGenres = branchWithGenres === undefined ? genrePushdown.withGenres : branchWithGenres;
  if (withGenres !== null) parameters.push(['with_genres', withGenres]);
  url.search = new URLSearchParams(parameters).toString();
  return url;
}

export function validTmdbDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validVoteCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
function validVoteAverage(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10;
}
function validPopularity(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function parseMovie(value: unknown, constraint: CandidateConstraint): TmdbMovie {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('malformed_response');
  const row = value as Record<string, unknown>;
  if (!positiveInteger(row.id) || typeof row.adult !== 'boolean' || typeof row.title !== 'string' ||
      !row.title.trim() || typeof row.release_date !== 'string' || !validTmdbDate(row.release_date) ||
      !Array.isArray(row.genre_ids) || !row.genre_ids.every(positiveInteger) ||
      !(row.poster_path === null || typeof row.poster_path === 'string' &&
        /^\/[A-Za-z0-9_-]+\.(?:jpe?g|png|webp)$/i.test(row.poster_path))) throw new Error('malformed_response');
  const genres = [...new Set(row.genre_ids as number[])].sort((a, b) => a - b);
  if (!genres.every(id => canonicalIds.has(id))) throw new Error('malformed_response');
  const required = requiredMetrics(constraint);
  const voteCount = validVoteCount(row.vote_count) ? row.vote_count : undefined;
  const voteAverage = validVoteAverage(row.vote_average) ? row.vote_average : undefined;
  const popularity = validPopularity(row.popularity) ? row.popularity : undefined;
  if (required.has('vote_count') && voteCount === undefined) throw new Error('required_metric');
  if (required.has('vote_average') && voteAverage === undefined) throw new Error('required_metric');
  if (required.has('popularity') && popularity === undefined) throw new Error('required_metric');
  return Object.freeze({ id: row.id, adult: row.adult, genreIds: Object.freeze(genres),
    title: row.title.trim(), releaseDate: row.release_date, posterPath: row.poster_path,
    ...(voteCount === undefined ? {} : { voteCount }),
    ...(voteAverage === undefined ? {} : { voteAverage }),
    ...(popularity === undefined ? {} : { popularity }),
  });
}

export type DiscoverPage = Readonly<{ page: number; totalPages: number; totalResults: number;
  results: readonly TmdbMovie[] }>;

export function parseDiscoverPage(value: unknown, expectedPage: number, constraint?: CandidateConstraint): DiscoverPage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('malformed_response');
  const row = value as Record<string, unknown>;
  if (!Number.isInteger(row.page) || row.page !== expectedPage || !Number.isInteger(row.total_pages) ||
      (row.total_pages as number) < 0 || !Number.isInteger(row.total_results) ||
      (row.total_results as number) < 0 || !Array.isArray(row.results)) throw new Error('malformed_response');
  if (row.total_pages === 0 && (row.total_results !== 0 || row.results.length !== 0)) throw new Error('malformed_response');
  return Object.freeze({ page: row.page as number, totalPages: row.total_pages as number,
    totalResults: row.total_results as number, results: Object.freeze(row.results.map(item => parseMovie(item, constraint ?? {
      releaseYearFrom: 0, releaseYearTo: 9999, clauses: [], ...legacyRules,
    }))) });
}

export function eligibleMovie(movie: TmdbMovie, constraint: CandidateConstraint): boolean {
  if (!positiveInteger(movie.id) || movie.adult || !validTmdbDate(movie.releaseDate)) return false;
  const year = Number(movie.releaseDate.slice(0, 4));
  if (year < constraint.releaseYearFrom || year > constraint.releaseYearTo) return false;
  if (constraint.minimumVoteCount !== undefined && constraint.minimumVoteCount !== null &&
      (movie.voteCount === undefined || movie.voteCount < constraint.minimumVoteCount)) return false;
  if (constraint.minimumAverageRating !== undefined && constraint.minimumAverageRating !== null &&
      (movie.voteAverage === undefined || movie.voteAverage < constraint.minimumAverageRating)) return false;
  return constraint.clauses.every(clause => clause.some(id => movie.genreIds.includes(id)));
}

export function parseConstraint(value: unknown): CandidateConstraint {
  const legacyFields = ['release_year_from', 'release_year_to', 'genre_clauses_tmdb_ids'];
  const fields = exactObject(value, legacyFields) ? legacyFields : [
    'release_year_from', 'release_year_to', 'genre_clauses_tmdb_ids', 'rule_set_kind', 'candidate_ordering',
    'minimum_vote_count', 'minimum_average_rating', 'metadata_language', 'genre_mode',
  ];
  if (!exactObject(value, fields) || !Number.isSafeInteger(value.release_year_from) ||
      !Number.isSafeInteger(value.release_year_to) || (value.release_year_from as number) < 1900 ||
      (value.release_year_to as number) > 9999 ||
      (value.release_year_from as number) > (value.release_year_to as number) ||
      !Array.isArray(value.genre_clauses_tmdb_ids)) throw new Error('internal');
  const clauses = value.genre_clauses_tmdb_ids;
  if (!clauses.every(clause => Array.isArray(clause) && clause.length > 0 && clause.every(id => positiveInteger(id) && canonicalIds.has(id)))) throw new Error('internal');
  if (fields === legacyFields) return Object.freeze({ releaseYearFrom: value.release_year_from as number,
    releaseYearTo: value.release_year_to as number, clauses: Object.freeze(clauses.map(clause => Object.freeze([...(clause as number[])]))), ...legacyRules });
  if ((value.rule_set_kind !== 'legacy_005_006_008' && value.rule_set_kind !== 'configured_009_v1') ||
      typeof value.candidate_ordering !== 'string' || !ORDERINGS.includes(value.candidate_ordering as never) &&
      value.candidate_ordering !== 'legacy_source_order' ||
      typeof value.metadata_language !== 'string' || !TMDB_PRIMARY_TRANSLATION_SET.has(value.metadata_language) ||
      !GENRE_MODES.includes(value.genre_mode as never) ||
      (value.minimum_vote_count !== null && !validVoteCount(value.minimum_vote_count)) ||
      (value.minimum_average_rating !== null && !validVoteAverage(value.minimum_average_rating)) ||
      value.rule_set_kind === 'legacy_005_006_008' &&
        (value.candidate_ordering !== 'legacy_source_order' || value.minimum_vote_count !== null ||
          value.minimum_average_rating !== null || value.metadata_language !== 'en-US' || value.genre_mode !== 'or') ||
      value.rule_set_kind === 'configured_009_v1' &&
        (value.candidate_ordering === 'legacy_source_order' || value.minimum_vote_count === null)) throw new Error('internal');
  return Object.freeze({ releaseYearFrom: value.release_year_from as number, releaseYearTo: value.release_year_to as number,
    clauses: Object.freeze(clauses.map(clause => Object.freeze([...(clause as number[])]))),
    ruleSetKind: value.rule_set_kind, ordering: value.candidate_ordering,
    minimumVoteCount: value.minimum_vote_count, minimumAverageRating: value.minimum_average_rating,
    metadataLanguage: value.metadata_language, genreMode: value.genre_mode,
  } as CandidateConstraint);
}
