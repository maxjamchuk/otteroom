import type { CandidateConstraint, CandidatePresentation, FailureClass, SearchDependencies,
  SearchResult, TmdbMovie } from './candidate-contracts.ts';
import { positiveInteger } from './candidate-contracts.ts';
import { buildDiscoverUrl, compileGenrePushdown, eligibleMovie, parseDiscoverPage, validTmdbDate } from './tmdb-eligibility.ts';

const DEFAULT_BASE = 'https://api.themoviedb.org/3';
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

class TmdbFailure extends Error { constructor(readonly failure: FailureClass) { super(failure); } }

type Budget = { start: number; attempts: number; maxRequests: number; deadlineMs: number; now: () => number;
  sleep: (milliseconds: number) => Promise<void>; random: () => number };

function remaining(budget: Budget): number { return budget.deadlineMs - (budget.now() - budget.start); }

function retryAfter(response: Response, now: number): number | null {
  const value = response.headers.get('retry-after');
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now() + now - now) : null;
}

async function tmdbJson(url: URL, dependencies: SearchDependencies, budget: Budget): Promise<unknown> {
  for (let retry = 0; retry < 3; retry++) {
    if (budget.attempts >= budget.maxRequests) throw new TmdbFailure('request_budget');
    const milliseconds = remaining(budget);
    if (milliseconds <= 0) throw new TmdbFailure('deadline');
    budget.attempts++;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), milliseconds);
    let response: Response;
    try {
      response = await dependencies.fetch(url, { method: 'GET', headers: {
        authorization: `Bearer ${dependencies.token}`, accept: 'application/json',
      }, signal: controller.signal });
    } catch {
      clearTimeout(timeout);
      if (retry === 2) throw new TmdbFailure('timeout');
      await backoff(retry, null, budget);
      continue;
    }
    if (!response.ok) {
      clearTimeout(timeout);
      const classification: FailureClass = response.status === 429 ? 'rate_limited' :
        response.status >= 500 ? 'upstream' : 'request_rejected';
      if (!RETRYABLE.has(response.status) || retry === 2) throw new TmdbFailure(classification);
      await backoff(retry, retryAfter(response, budget.now()), budget);
      continue;
    }
    try {
      const body = await response.json();
      if (controller.signal.aborted || remaining(budget) <= 0) throw new TmdbFailure('deadline');
      return body;
    } catch (error) {
      if (error instanceof TmdbFailure) throw error;
      throw new TmdbFailure(controller.signal.aborted || remaining(budget) <= 0 ? 'deadline' : 'malformed_response');
    } finally { clearTimeout(timeout); }
  }
  throw new TmdbFailure('internal');
}

async function backoff(retry: number, advisory: number | null, budget: Budget): Promise<void> {
  const computed = Math.min(1000, 100 * 2 ** retry) + Math.floor(budget.random() * 101);
  const delay = Math.min(2000, Math.max(computed, advisory ?? 0));
  if (delay >= remaining(budget)) throw new TmdbFailure('deadline');
  await budget.sleep(delay);
}

function iso(date: Date): string { return date.toISOString().slice(0, 10); }
function following(date: Date): Date { const next = new Date(date); next.setUTCDate(next.getUTCDate() + 1); return next; }
function splitDates(from: string, to: string): readonly [readonly [string, string], readonly [string, string]] | null {
  const start = new Date(`${from}T00:00:00Z`), end = new Date(`${to}T00:00:00Z`);
  if (start.getTime() === end.getTime()) return null;
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000);
  const leftEnd = new Date(start); leftEnd.setUTCDate(leftEnd.getUTCDate() + Math.floor(days / 2));
  return [[from, iso(leftEnd)], [iso(following(leftEnd)), to]];
}

function normalizedConstraint(constraint: CandidateConstraint): Required<Pick<CandidateConstraint, 'ruleSetKind' | 'ordering' |
  'minimumVoteCount' | 'minimumAverageRating' | 'metadataLanguage' | 'genreMode'>> & CandidateConstraint {
  const configured = constraint.ruleSetKind === 'configured_009_v1' ||
    (constraint.ruleSetKind === undefined && (constraint.ordering !== undefined && constraint.ordering !== 'legacy_source_order' ||
      constraint.minimumVoteCount !== undefined || constraint.minimumAverageRating !== undefined));
  return { ...constraint, ruleSetKind: configured ? 'configured_009_v1' : 'legacy_005_006_008',
    ordering: constraint.ordering ?? 'legacy_source_order', minimumVoteCount: constraint.minimumVoteCount ?? null,
    minimumAverageRating: constraint.minimumAverageRating ?? null, metadataLanguage: constraint.metadataLanguage ?? 'en-US',
    genreMode: constraint.genreMode ?? 'or' };
}

function compareCodePoints(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }

export function compareTmdbMovies(a: TmdbMovie, b: TmdbMovie, rawConstraint: CandidateConstraint): number {
  const constraint = normalizedConstraint(rawConstraint);
  if (constraint.ordering === 'legacy_source_order') return 0;
  if (constraint.ordering === 'vote_count_desc') {
    if (a.voteCount !== b.voteCount) return (b.voteCount ?? -1) > (a.voteCount ?? -1) ? 1 : -1;
  } else if (constraint.ordering === 'average_rating_desc') {
    if (a.voteAverage !== b.voteAverage) return (b.voteAverage ?? -1) > (a.voteAverage ?? -1) ? 1 : -1;
  } else if (constraint.ordering === 'popularity_desc') {
    if (a.popularity !== b.popularity) return (b.popularity ?? -1) > (a.popularity ?? -1) ? 1 : -1;
  } else {
    const collator = new Intl.Collator(constraint.metadataLanguage, { usage: 'sort', sensitivity: 'variant', numeric: false, ignorePunctuation: false });
    const titleA = a.title.normalize('NFC'), titleB = b.title.normalize('NFC');
    const compared = collator.compare(titleA, titleB);
    if (compared !== 0) return compared;
    const codePoint = compareCodePoints(titleA, titleB);
    if (codePoint !== 0) return codePoint;
  }
  return a.id - b.id;
}

type ShardResult = { kind: 'match'; movie: TmdbMovie } | { kind: 'completed_empty' } | { kind: 'search_incomplete'; reason: FailureClass };

type NumericOrdering = 'vote_count_desc' | 'average_rating_desc' | 'popularity_desc';

function numericOrdering(ordering: CandidateConstraint['ordering']): ordering is NumericOrdering {
  return ordering === 'vote_count_desc' || ordering === 'average_rating_desc' || ordering === 'popularity_desc';
}

function numericPrimary(movie: TmdbMovie, ordering: NumericOrdering): number {
  const value = ordering === 'vote_count_desc' ? movie.voteCount :
    ordering === 'average_rating_desc' ? movie.voteAverage : movie.popularity;
  if (value === undefined) throw new TmdbFailure('required_metric');
  return value;
}

function failureReason(error: unknown): FailureClass {
  return error instanceof TmdbFailure ? error.failure :
    error instanceof Error && error.message === 'required_metric' ? 'required_metric' : 'malformed_response';
}

export async function searchTmdbCandidate(rawConstraint: CandidateConstraint, dependencies: SearchDependencies): Promise<SearchResult> {
  const constraint = normalizedConstraint(rawConstraint);
  const budget: Budget = { start: (dependencies.now ?? performance.now.bind(performance))(), attempts: 0,
    maxRequests: dependencies.maxRequests ?? 100, deadlineMs: dependencies.deadlineMs ?? 20_000,
    now: dependencies.now ?? performance.now.bind(performance),
    sleep: dependencies.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))), random: dependencies.random ?? Math.random };
  const base = dependencies.baseUrl ?? DEFAULT_BASE;
  const seen = new Set<number>();
  const evaluated = new Set<number>();
  const excluded = new Set(rawConstraint.excludedTmdbMovieIds ?? []);
  if ([...excluded].some(id => !positiveInteger(id))) return { kind: 'search_incomplete', reason: 'internal' };

  const evaluateOnce = (movie: TmdbMovie): void => {
    if (evaluated.has(movie.id)) return;
    evaluated.add(movie.id);
    dependencies.onMovieEvaluated?.(movie);
  };

  const numericShard = async (from: string, to: string, ordering: NumericOrdering,
    branchWithGenres: string | null): Promise<ShardResult> => {
    let first;
    try {
      const raw = await tmdbJson(buildDiscoverUrl(base, constraint.releaseYearFrom, constraint.releaseYearTo, 1,
        constraint.clauses, from, to, constraint, branchWithGenres), dependencies, budget);
      first = parseDiscoverPage(raw, 1, constraint);
    } catch (error) { return { kind: 'search_incomplete', reason: failureReason(error) }; }
    if (first.results.length > first.totalResults) return { kind: 'search_incomplete', reason: 'pagination_inconsistent' };

    const expectedResults = first.totalResults;
    const totalPages = Math.max(1, first.totalPages);
    const rangeSeen = new Set<number>();
    let rawResultCount = 0;
    let lastPrimary: number | null = null;
    let providerOrderRegressed = false;
    let bestPrimary: number | null = null;
    let best: TmdbMovie | null = null;
    let bestRunComplete = false;

    const consume = (page: typeof first): ShardResult | null => {
      if (page.results.length > expectedResults) return { kind: 'search_incomplete', reason: 'pagination_inconsistent' };
      rawResultCount += page.results.length;
      if (rawResultCount > expectedResults) return { kind: 'search_incomplete', reason: 'pagination_inconsistent' };
      try {
        for (const movie of page.results) {
          const primary = numericPrimary(movie, ordering);
          if (lastPrimary !== null && primary > lastPrimary) providerOrderRegressed = true;
          lastPrimary = primary;
          if (bestPrimary !== null && primary < bestPrimary) bestRunComplete = true;
          if (rangeSeen.has(movie.id)) continue;
          rangeSeen.add(movie.id);
          evaluateOnce(movie);
          if (excluded.has(movie.id) || !eligibleMovie(movie, constraint)) continue;
          if (best === null || compareTmdbMovies(movie, best, constraint) < 0) {
            best = movie;
            bestPrimary = primary;
          }
        }
      } catch (error) { return { kind: 'search_incomplete', reason: failureReason(error) }; }
      return null;
    };

    const firstFailure = consume(first);
    if (firstFailure) return firstFailure;
    if (best !== null && bestRunComplete && !providerOrderRegressed) return { kind: 'match', movie: best };

    const split = async (): Promise<ShardResult> => {
      const parts = splitDates(from, to);
      if (!parts) return { kind: 'search_incomplete', reason: 'single_day_overflow' };
      const winners: TmdbMovie[] = [];
      for (const part of parts) {
        const result = await numericShard(part[0], part[1], ordering, branchWithGenres);
        if (result.kind === 'search_incomplete') return result;
        if (result.kind === 'match') winners.push(result.movie);
      }
      if (!winners.length) return { kind: 'completed_empty' };
      return { kind: 'match', movie: winners.reduce((winner, movie) =>
        compareTmdbMovies(movie, winner, constraint) < 0 ? movie : winner) };
    };

    // TMDB exposes at most 500 pages. A page-one winner can still be proven from
    // the broad globally sorted query; a broad overflow with no local match must
    // fall back to non-overlapping date shards to find a candidate or prove empty.
    if (first.totalPages > 500 && best === null) return await split();

    const pageLimit = Math.min(totalPages, 500);
    for (let pageNumber = 2; pageNumber <= pageLimit; pageNumber++) {
      let page;
      try {
        const raw = await tmdbJson(buildDiscoverUrl(base, constraint.releaseYearFrom, constraint.releaseYearTo,
          pageNumber, constraint.clauses, from, to, constraint, branchWithGenres), dependencies, budget);
        page = parseDiscoverPage(raw, pageNumber, constraint);
      } catch (error) { return { kind: 'search_incomplete', reason: failureReason(error) }; }
      if (page.totalPages !== first.totalPages || page.totalResults !== expectedResults)
        return { kind: 'search_incomplete', reason: 'pagination_inconsistent' };
      const failure = consume(page);
      if (failure) return failure;
      if (best !== null && bestRunComplete && !providerOrderRegressed) return { kind: 'match', movie: best };
    }

    if (first.totalPages > 500) return await split();
    if (rawResultCount !== expectedResults) return { kind: 'search_incomplete', reason: 'pagination_inconsistent' };
    // A provider primary regression invalidates the prefix proof, but not the
    // data already traversed. When the bounded exhaustive traversal completes,
    // the local best/empty result is authoritative; if it cannot complete, the
    // concrete transport/budget/deadline failure remains the incomplete reason.
    return best ? { kind: 'match', movie: best } : { kind: 'completed_empty' };
  };

  const shard = async (from: string, to: string, branchWithGenres: string | null): Promise<ShardResult> => {
    let first;
    try {
      const raw = await tmdbJson(buildDiscoverUrl(base, constraint.releaseYearFrom, constraint.releaseYearTo, 1,
        constraint.clauses, from, to, constraint, branchWithGenres), dependencies, budget);
      first = parseDiscoverPage(raw, 1, constraint);
    } catch (error) {
      return { kind: 'search_incomplete', reason: failureReason(error) };
    }
    if (first.results.length > first.totalResults) return { kind: 'search_incomplete', reason: 'pagination_inconsistent' };
    if (first.totalPages > 500) {
      const parts = splitDates(from, to);
      if (!parts) return { kind: 'search_incomplete', reason: 'single_day_overflow' };
      const winners: TmdbMovie[] = [];
      for (const part of parts) {
        const result = await shard(part[0], part[1], branchWithGenres);
        if (result.kind === 'search_incomplete') return result;
        if (result.kind === 'match') winners.push(result.movie);
      }
      if (!winners.length) return { kind: 'completed_empty' };
      return { kind: 'match', movie: winners.reduce((best, movie) => compareTmdbMovies(movie, best, constraint) < 0 ? movie : best) };
    }
    const totalPages = Math.max(1, first.totalPages), expectedResults = first.totalResults;
    let rawResultCount = 0; let best: TmdbMovie | null = null;
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      let page = first;
      if (pageNumber !== 1) {
        try {
          const raw = await tmdbJson(buildDiscoverUrl(base, constraint.releaseYearFrom, constraint.releaseYearTo, pageNumber,
            constraint.clauses, from, to, constraint, branchWithGenres), dependencies, budget);
          page = parseDiscoverPage(raw, pageNumber, constraint);
        } catch (error) {
          return { kind: 'search_incomplete', reason: failureReason(error) };
        }
        if (page.totalPages !== first.totalPages || page.totalResults !== expectedResults) return { kind: 'search_incomplete', reason: 'pagination_inconsistent' };
      }
      if (page.results.length > expectedResults) return { kind: 'search_incomplete', reason: 'pagination_inconsistent' };
      rawResultCount += page.results.length;
      if (rawResultCount > expectedResults) return { kind: 'search_incomplete', reason: 'pagination_inconsistent' };
      for (const movie of page.results) {
        if (seen.has(movie.id)) continue;
        seen.add(movie.id); evaluateOnce(movie);
        if (excluded.has(movie.id) || !eligibleMovie(movie, constraint)) continue;
        if (constraint.ordering === 'legacy_source_order') return { kind: 'match', movie };
        if (best === null || compareTmdbMovies(movie, best, constraint) < 0) best = movie;
      }
    }
    if (rawResultCount !== expectedResults) return { kind: 'search_incomplete', reason: 'pagination_inconsistent' };
    return best ? { kind: 'match', movie: best } : { kind: 'completed_empty' };
  };

  try {
    const from = `${constraint.releaseYearFrom}-01-01`, to = `${constraint.releaseYearTo}-12-31`;
    const compiled = compileGenrePushdown(constraint.clauses);
    // Legacy source order retains its original single-query traversal. Every
    // configured branch must finish its own prefix or exhaustive proof before
    // the local total comparator can select the global winner.
    const branches = constraint.ruleSetKind === 'configured_009_v1' ? compiled.branches : [compiled.withGenres];
    const winners = new Map<number, TmdbMovie>();
    for (const branch of branches) {
      const result = constraint.ruleSetKind === 'configured_009_v1' && numericOrdering(constraint.ordering)
        ? await numericShard(from, to, constraint.ordering, branch)
        : await shard(from, to, branch);
      if (result.kind === 'search_incomplete') return result;
      if (result.kind === 'match') {
        if (constraint.ordering === 'legacy_source_order') return result;
        winners.set(result.movie.id, result.movie);
      }
    }
    if (winners.size === 0) return { kind: 'completed_empty' };
    return { kind: 'match', movie: [...winners.values()].reduce((best, movie) =>
      compareTmdbMovies(movie, best, constraint) < 0 ? movie : best) };
  }
  catch (error) { return { kind: 'search_incomplete', reason: error instanceof TmdbFailure ? error.failure : 'internal' }; }
}

function parseDetails(value: unknown, expectedId: number): { title: string; releaseYear: number; posterPath: string | null } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TmdbFailure('malformed_response');
  const row = value as Record<string, unknown>;
  if (row.id !== expectedId || typeof row.title !== 'string' || !row.title.trim() || typeof row.release_date !== 'string' || !validTmdbDate(row.release_date) ||
      !(row.poster_path === null || typeof row.poster_path === 'string' && /^\/[A-Za-z0-9_-]+\.(?:jpe?g|png|webp)$/i.test(row.poster_path))) throw new TmdbFailure('malformed_response');
  const releaseYear = Number(row.release_date.slice(0, 4));
  if (!Number.isInteger(releaseYear) || releaseYear < 1888 || releaseYear > 9999) throw new TmdbFailure('malformed_response');
  return { title: row.title.trim(), releaseYear, posterPath: row.poster_path };
}

function parseConfiguration(value: unknown): { base: string; size: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TmdbFailure('malformed_response');
  const images = (value as Record<string, unknown>).images;
  if (!images || typeof images !== 'object' || Array.isArray(images)) throw new TmdbFailure('malformed_response');
  const row = images as Record<string, unknown>;
  if (typeof row.secure_base_url !== 'string' || !row.secure_base_url.startsWith('https://') || !Array.isArray(row.poster_sizes) || !row.poster_sizes.every(size => typeof size === 'string')) throw new TmdbFailure('malformed_response');
  const candidates = (row.poster_sizes as string[]).flatMap(size => { const match = /^w(\d+)$/.exec(size); return match && Number(match[1]) <= 780 ? [[Number(match[1]), size] as const] : []; }).sort((a,b) => b[0] - a[0]);
  if (!candidates.length) throw new TmdbFailure('malformed_response');
  return { base: row.secure_base_url, size: candidates[0][1] };
}

export async function loadTmdbPresentation(tmdbMovieId: number, dependencies: SearchDependencies, metadataLanguage = 'en-US', _refreshConfiguration = false): Promise<CandidatePresentation> {
  if (!positiveInteger(tmdbMovieId)) throw new TmdbFailure('internal');
  const now = dependencies.now ?? performance.now.bind(performance);
  const budget: Budget = { start: now(), attempts: 0, maxRequests: dependencies.maxRequests ?? 6, deadlineMs: dependencies.deadlineMs ?? 10_000, now,
    sleep: dependencies.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))), random: dependencies.random ?? Math.random };
  const base = dependencies.baseUrl ?? DEFAULT_BASE;
  const details = parseDetails(await tmdbJson(new URL(`${base.replace(/\/$/, '')}/movie/${tmdbMovieId}?language=${encodeURIComponent(metadataLanguage)}`), dependencies, budget), tmdbMovieId);
  let posterUrl: string | null = null;
  if (details.posterPath !== null) {
    const configuration = await tmdbJson(new URL(`${base.replace(/\/$/, '')}/configuration`), dependencies, budget).then(parseConfiguration);
    const url = new URL(`${configuration.base.replace(/\/$/, '')}/${configuration.size}${details.posterPath}`);
    if (url.protocol !== 'https:') throw new TmdbFailure('malformed_response');
    posterUrl = url.toString();
  }
  return Object.freeze({ tmdbMovieId, title: details.title, releaseYear: details.releaseYear, posterUrl });
}

export function clearConfigurationForTests(): void { /* no persistent configuration cache */ }
