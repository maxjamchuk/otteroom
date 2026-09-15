import type { CandidateConstraint, CandidatePresentation, FailureClass, SearchDependencies,
  SearchResult, TmdbMovie } from './candidate-contracts.ts';
import { positiveInteger } from './candidate-contracts.ts';
import { buildDiscoverUrl, eligibleMovie, parseDiscoverPage, validTmdbDate } from './tmdb-eligibility.ts';

const DEFAULT_BASE = 'https://api.themoviedb.org/3';
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

class TmdbFailure extends Error {
  constructor(readonly failure: FailureClass) { super(failure); }
}

type Budget = {
  start: number;
  attempts: number;
  maxRequests: number;
  deadlineMs: number;
  now: () => number;
  sleep: (milliseconds: number) => Promise<void>;
  random: () => number;
};

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
      throw new TmdbFailure(controller.signal.aborted || remaining(budget) <= 0
        ? 'deadline' : 'malformed_response');
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

function splitDates(from: string, to: string): readonly [readonly [string,string], readonly [string,string]] | null {
  const start = new Date(`${from}T00:00:00Z`), end = new Date(`${to}T00:00:00Z`);
  if (start.getTime() === end.getTime()) return null;
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000);
  const leftEnd = new Date(start); leftEnd.setUTCDate(leftEnd.getUTCDate() + Math.floor(days / 2));
  return [[from, iso(leftEnd)], [iso(following(leftEnd)), to]];
}

export async function searchTmdbCandidate(constraint: CandidateConstraint,
  dependencies: SearchDependencies): Promise<SearchResult> {
  const budget: Budget = { start: (dependencies.now ?? performance.now.bind(performance))(), attempts: 0,
    maxRequests: dependencies.maxRequests ?? 100, deadlineMs: dependencies.deadlineMs ?? 20_000,
    now: dependencies.now ?? performance.now.bind(performance),
    sleep: dependencies.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))),
    random: dependencies.random ?? Math.random };
  const base = dependencies.baseUrl ?? DEFAULT_BASE;
  const seen = new Set<number>();

  const shard = async (from: string, to: string): Promise<SearchResult> => {
    let first;
    try {
      const raw = await tmdbJson(buildDiscoverUrl(base, constraint.releaseYearFrom,
        constraint.releaseYearTo, 1, constraint.clauses, from, to), dependencies, budget);
      first = parseDiscoverPage(raw, 1);
    } catch (error) {
      return { kind: 'search_incomplete', reason: error instanceof TmdbFailure ? error.failure : 'malformed_response' };
    }
    if (first.results.length > first.totalResults)
      return { kind: 'search_incomplete', reason: 'pagination_inconsistent' };
    if (first.totalPages > 500) {
      const parts = splitDates(from, to);
      if (!parts) return { kind: 'search_incomplete', reason: 'single_day_overflow' };
      for (const part of parts) {
        const result = await shard(part[0], part[1]);
        if (result.kind !== 'completed_empty') return result;
      }
      return { kind: 'completed_empty' };
    }
    const totalPages = Math.max(1, first.totalPages);
    const expectedResults = first.totalResults;
    let rawResultCount = 0;
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      let page = first;
      if (pageNumber !== 1) {
        try {
          const raw = await tmdbJson(buildDiscoverUrl(base, constraint.releaseYearFrom,
            constraint.releaseYearTo, pageNumber, constraint.clauses, from, to), dependencies, budget);
          page = parseDiscoverPage(raw, pageNumber);
        } catch (error) {
          return { kind: 'search_incomplete', reason: error instanceof TmdbFailure ? error.failure : 'malformed_response' };
        }
        if (page.totalPages !== first.totalPages || page.totalResults !== expectedResults)
          return { kind: 'search_incomplete', reason: 'pagination_inconsistent' };
      }
      if (page.results.length > expectedResults)
        return { kind: 'search_incomplete', reason: 'pagination_inconsistent' };
      rawResultCount += page.results.length;
      if (rawResultCount > expectedResults)
        return { kind: 'search_incomplete', reason: 'pagination_inconsistent' };
      for (const movie of page.results) {
        if (seen.has(movie.id)) continue;
        seen.add(movie.id); dependencies.onMovieEvaluated?.(movie);
        if (eligibleMovie(movie, constraint)) return { kind: 'match', movie };
      }
    }
    if (rawResultCount !== expectedResults)
      return { kind: 'search_incomplete', reason: 'pagination_inconsistent' };
    return { kind: 'completed_empty' };
  };

  try { return await shard(`${constraint.releaseYearFrom}-01-01`, `${constraint.releaseYearTo}-12-31`); }
  catch { return { kind: 'search_incomplete', reason: 'internal' }; }
}

function parseDetails(value: unknown, expectedId: number): { title: string; releaseYear: number; posterPath: string | null } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TmdbFailure('malformed_response');
  const row = value as Record<string, unknown>;
  if (row.id !== expectedId || typeof row.title !== 'string' || !row.title.trim() ||
      typeof row.release_date !== 'string' || !validTmdbDate(row.release_date) ||
      !(row.poster_path === null || typeof row.poster_path === 'string' &&
        /^\/[A-Za-z0-9_-]+\.(?:jpe?g|png|webp)$/i.test(row.poster_path)))
    throw new TmdbFailure('malformed_response');
  const releaseYear = Number(row.release_date.slice(0, 4));
  if (!Number.isInteger(releaseYear) || releaseYear < 1888 || releaseYear > 9999)
    throw new TmdbFailure('malformed_response');
  return { title: row.title.trim(), releaseYear, posterPath: row.poster_path };
}

function parseConfiguration(value: unknown): { base: string; size: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TmdbFailure('malformed_response');
  const images = (value as Record<string, unknown>).images;
  if (!images || typeof images !== 'object' || Array.isArray(images)) throw new TmdbFailure('malformed_response');
  const row = images as Record<string, unknown>;
  if (typeof row.secure_base_url !== 'string' || !row.secure_base_url.startsWith('https://') ||
      !Array.isArray(row.poster_sizes) || !row.poster_sizes.every(size => typeof size === 'string'))
    throw new TmdbFailure('malformed_response');
  const candidates = (row.poster_sizes as string[]).flatMap(size => {
    const match = /^w(\d+)$/.exec(size); return match && Number(match[1]) <= 780 ? [[Number(match[1]), size] as const] : [];
  }).sort((a,b) => b[0] - a[0]);
  if (!candidates.length) throw new TmdbFailure('malformed_response');
  return { base: row.secure_base_url, size: candidates[0][1] };
}

export async function loadTmdbPresentation(tmdbMovieId: number, dependencies: SearchDependencies,
  _refreshConfiguration = false): Promise<CandidatePresentation> {
  if (!positiveInteger(tmdbMovieId)) throw new TmdbFailure('internal');
  const now = dependencies.now ?? performance.now.bind(performance);
  const budget: Budget = { start: now(), attempts: 0, maxRequests: dependencies.maxRequests ?? 6,
    deadlineMs: dependencies.deadlineMs ?? 10_000, now,
    sleep: dependencies.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))),
    random: dependencies.random ?? Math.random };
  const base = dependencies.baseUrl ?? DEFAULT_BASE;
  const details = parseDetails(await tmdbJson(new URL(`${base.replace(/\/$/, '')}/movie/${tmdbMovieId}?language=en-US`),
    dependencies, budget), tmdbMovieId);
  let posterUrl: string | null = null;
  if (details.posterPath !== null) {
    const configuration = parseConfiguration(await tmdbJson(
      new URL(`${base.replace(/\/$/, '')}/configuration`), dependencies, budget));
    const url = new URL(`${configuration.base.replace(/\/$/, '')}/${configuration.size}${details.posterPath}`);
    if (url.protocol !== 'https:') throw new TmdbFailure('malformed_response');
    posterUrl = url.toString();
  }
  return Object.freeze({ tmdbMovieId, title: details.title, releaseYear: details.releaseYear, posterUrl });
}

export function clearConfigurationForTests(): void { /* no persistent configuration cache */ }
