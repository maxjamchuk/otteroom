export type Candidate = Readonly<{
  tmdbMovieId: number;
  title: string;
  releaseYear: number;
  posterUrl: string | null;
}>;

export type CandidateResult =
  | Readonly<{ outcome: 'available'; candidateSequence: number;
      candidateProgressionStatus: 'collecting' | 'agreed'; candidate: Candidate }>
  | Readonly<{ outcome: 'metadata_unavailable'; candidateSequence: number;
      candidateProgressionStatus: 'collecting' | 'agreed' }>
  | Readonly<{ outcome: 'exhausted'; candidateSequence: number;
      candidateProgressionStatus: 'exhausted' }>
  | Readonly<{ outcome: 'not_ready' | 'not_found' | 'no_candidates' | 'refresh_required' }>;

export const candidateFailureMessage = 'Unable to find a movie right now. Please try again.';
export const metadataFailureMessage = 'Unable to load movie details. Please try again.';
export const posterFailureMessage = 'Unable to load this poster. Please try again.';

export class CandidateContractError extends Error {
  constructor() { super(candidateFailureMessage); this.name = 'CandidateContractError'; }
}

const exact = (value: unknown, fields: readonly string[]): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field));
const positive = (value: unknown): value is number => typeof value === 'number' &&
  Number.isSafeInteger(value) && value > 0;

function httpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }
  catch { return false; }
}

export function narrowCandidateResult(data: unknown): CandidateResult {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new CandidateContractError();
  const value = data as Record<string, unknown>;
  if (value.outcome === 'available') {
    if (!exact(value, ['outcome','candidate_sequence','candidate_progression_status','candidate']) ||
        !positive(value.candidate_sequence) ||
        !(value.candidate_progression_status === 'collecting' ||
          value.candidate_progression_status === 'agreed') || !exact(value.candidate,
      ['tmdb_movie_id','title','release_year','poster_url'])) throw new CandidateContractError();
    const candidate = value.candidate;
    if (!positive(candidate.tmdb_movie_id) || typeof candidate.title !== 'string' ||
        !candidate.title || candidate.title.trim() !== candidate.title ||
        typeof candidate.release_year !== 'number' || !Number.isInteger(candidate.release_year) ||
        candidate.release_year < 1888 || candidate.release_year > 9999 ||
        !(candidate.poster_url === null || httpsUrl(candidate.poster_url))) throw new CandidateContractError();
    return Object.freeze({ outcome: 'available', candidateSequence: value.candidate_sequence,
      candidateProgressionStatus: value.candidate_progression_status, candidate: Object.freeze({
      tmdbMovieId: candidate.tmdb_movie_id, title: candidate.title,
      releaseYear: candidate.release_year, posterUrl: candidate.poster_url,
    }) });
  }
  if (value.outcome === 'metadata_unavailable' &&
      exact(value, ['outcome','candidate_sequence','candidate_progression_status']) &&
      positive(value.candidate_sequence) &&
      (value.candidate_progression_status === 'collecting' ||
        value.candidate_progression_status === 'agreed')) return Object.freeze({
          outcome: value.outcome, candidateSequence: value.candidate_sequence,
          candidateProgressionStatus: value.candidate_progression_status });
  if (value.outcome === 'exhausted' &&
      exact(value, ['outcome','candidate_sequence','candidate_progression_status']) &&
      positive(value.candidate_sequence) && value.candidate_progression_status === 'exhausted')
    return Object.freeze({ outcome: value.outcome, candidateSequence: value.candidate_sequence,
      candidateProgressionStatus: value.candidate_progression_status });
  if ((value.outcome === 'not_ready' || value.outcome === 'not_found' ||
      value.outcome === 'no_candidates' || value.outcome === 'refresh_required') &&
      exact(value, ['outcome'])) return Object.freeze({ outcome: value.outcome });
  throw new CandidateContractError();
}
