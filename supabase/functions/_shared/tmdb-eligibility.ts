import { exactObject, positiveInteger, type CandidateConstraint, type TmdbMovie } from './candidate-contracts.ts';

export const TMDB_GENRE_IDS = Object.freeze({
  action: 28, adventure: 12, animation: 16, comedy: 35, crime: 80, documentary: 99,
  drama: 18, family: 10751, fantasy: 14, history: 36, horror: 27, music: 10402,
  mystery: 9648, romance: 10749, science_fiction: 878, tv_movie: 10770, thriller: 53,
  war: 10752, western: 37,
});

const canonicalIds = new Set<number>(Object.values(TMDB_GENRE_IDS));

export function chooseDriverClause(clauses: readonly (readonly number[])[]): readonly number[] | null {
  let selected: readonly number[] | null = null;
  for (const clause of clauses) if (selected === null || clause.length < selected.length) selected = clause;
  return selected;
}

export function buildDiscoverUrl(baseUrl: string, fromYear: number, toYear: number, page: number,
  clauses: readonly (readonly number[])[], fromDate = `${fromYear}-01-01`, toDate = `${toYear}-12-31`): URL {
  const url = new URL(`${baseUrl.replace(/\/$/, '')}/discover/movie`);
  const parameters: Array<[string, string]> = [
    ['language','en-US'], ['include_adult','false'], ['include_video','false'],
    ['sort_by','primary_release_date.asc'], ['primary_release_date.gte',fromDate],
    ['primary_release_date.lte',toDate], ['page',String(page)],
  ];
  const driver = chooseDriverClause(clauses);
  if (driver) parameters.push(['with_genres', driver.join('|')]);
  url.search = new URLSearchParams(parameters).toString();
  return url;
}

export function validTmdbDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function parseMovie(value: unknown): TmdbMovie {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('malformed_response');
  const row = value as Record<string, unknown>;
  if (!positiveInteger(row.id) || typeof row.adult !== 'boolean' || typeof row.title !== 'string' ||
      !row.title.trim() || typeof row.release_date !== 'string' || !validTmdbDate(row.release_date) ||
      !Array.isArray(row.genre_ids) || !row.genre_ids.every(positiveInteger) ||
      !(row.poster_path === null || typeof row.poster_path === 'string' &&
        /^\/[A-Za-z0-9_-]+\.(?:jpe?g|png|webp)$/i.test(row.poster_path)))
    throw new Error('malformed_response');
  const genres = [...new Set(row.genre_ids as number[])].sort((a, b) => a - b);
  if (!genres.every(id => canonicalIds.has(id))) throw new Error('malformed_response');
  return Object.freeze({ id: row.id, adult: row.adult, genreIds: Object.freeze(genres),
    title: row.title.trim(), releaseDate: row.release_date, posterPath: row.poster_path });
}

export type DiscoverPage = Readonly<{ page: number; totalPages: number; totalResults: number;
  results: readonly TmdbMovie[] }>;

export function parseDiscoverPage(value: unknown, expectedPage: number): DiscoverPage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('malformed_response');
  const row = value as Record<string, unknown>;
  if (!Number.isInteger(row.page) || row.page !== expectedPage || !Number.isInteger(row.total_pages) ||
      (row.total_pages as number) < 0 || !Number.isInteger(row.total_results) ||
      (row.total_results as number) < 0 || !Array.isArray(row.results)) throw new Error('malformed_response');
  if (row.total_pages === 0 && (row.total_results !== 0 || row.results.length !== 0)) throw new Error('malformed_response');
  return Object.freeze({ page: row.page as number, totalPages: row.total_pages as number,
    totalResults: row.total_results as number, results: Object.freeze(row.results.map(parseMovie)) });
}

export function eligibleMovie(movie: TmdbMovie, constraint: CandidateConstraint): boolean {
  if (!positiveInteger(movie.id) || movie.adult || !validTmdbDate(movie.releaseDate)) return false;
  const year = Number(movie.releaseDate.slice(0, 4));
  if (year < constraint.releaseYearFrom || year > constraint.releaseYearTo) return false;
  return constraint.clauses.every(clause => clause.some(id => movie.genreIds.includes(id)));
}

export function parseConstraint(value: unknown): CandidateConstraint {
  if (!exactObject(value, ['release_year_from','release_year_to','genre_clauses_tmdb_ids']) ||
      !Number.isInteger(value.release_year_from) || !Number.isInteger(value.release_year_to) ||
      (value.release_year_from as number) > (value.release_year_to as number) ||
      !Array.isArray(value.genre_clauses_tmdb_ids)) throw new Error('internal');
  const clauses = value.genre_clauses_tmdb_ids;
  if (!clauses.every(clause => Array.isArray(clause) && clause.length > 0 &&
      clause.every(id => positiveInteger(id) && canonicalIds.has(id)))) throw new Error('internal');
  return Object.freeze({ releaseYearFrom: value.release_year_from as number,
    releaseYearTo: value.release_year_to as number,
    clauses: Object.freeze(clauses.map(clause => Object.freeze([...(clause as number[])]))) });
}
