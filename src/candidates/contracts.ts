import type { Database } from '../types/database.generated';

type GeneratedRow = Database['public']['Functions']['ensure_room_candidate']['Returns'][number];
export type Candidate = Readonly<Omit<GeneratedRow, 'outcome'>>;
export type CandidateResult =
  | Candidate & { readonly outcome: 'available' }
  | { readonly outcome: 'not_ready' | 'not_found' } & { readonly [K in keyof Candidate]: null };

export const candidateFailureMessage = 'Unable to load this movie. Please try again.';
export class CandidateContractError extends Error {
  constructor() { super(candidateFailureMessage); this.name = 'CandidateContractError'; }
}

const fields = ['outcome', 'candidate_id', 'title', 'release_year', 'poster_key'] as const satisfies readonly (keyof GeneratedRow)[];
const slug = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value);

// Generated RETURNS TABLE types omit logical NULLs; narrow unknown transport data.
export function narrowCandidateResult(data: unknown): CandidateResult {
  if (!Array.isArray(data) || data.length !== 1) throw new CandidateContractError();
  const value: unknown = data[0];
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== fields.length || !fields.every(key => Object.hasOwn(value, key))) {
    throw new CandidateContractError();
  }
  const row = value as Record<keyof GeneratedRow, unknown>;
  if (row.outcome === 'available') {
    if (!slug(row.candidate_id) || !slug(row.poster_key) || typeof row.title !== 'string' ||
        !row.title || row.title.trim() !== row.title || typeof row.release_year !== 'number' ||
        !Number.isInteger(row.release_year) || row.release_year < 1888 || row.release_year > 9999) {
      throw new CandidateContractError();
    }
  } else if (row.outcome === 'not_ready' || row.outcome === 'not_found') {
    if (!fields.filter(key => key !== 'outcome').every(key => row[key] === null)) throw new CandidateContractError();
  } else throw new CandidateContractError();
  return Object.freeze({ ...row }) as CandidateResult;
}
