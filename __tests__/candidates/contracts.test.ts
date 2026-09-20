import fs from 'node:fs';
import { CandidateContractError, narrowCandidateResult } from '../../src/candidates/contracts';

const transport = { outcome: 'available', candidate_sequence:1,
  candidate_progression_status:'collecting',candidate: { tmdb_movie_id: 7, title: 'TMDB Film',
  release_year: 2020, poster_url: 'https://image.tmdb.org/t/p/w500/a.jpg' } };
const parsed = { outcome: 'available',candidateSequence:1,
  candidateProgressionStatus:'collecting', candidate: { tmdbMovieId: 7, title: 'TMDB Film',
  releaseYear: 2020, posterUrl: 'https://image.tmdb.org/t/p/w500/a.jpg' } };

it('accepts the exact available response and maps transport names once', () => {
  expect(narrowCandidateResult(transport)).toEqual(parsed);
  expect(Object.isFrozen(narrowCandidateResult(transport))).toBe(true);
  expect(Object.isFrozen((narrowCandidateResult(transport) as typeof parsed).candidate)).toBe(true);
});

it.each(['not_found','not_ready','no_candidates','refresh_required'] as const)(
  'accepts exact field-free %s business outcome', outcome => {
    expect(narrowCandidateResult({ outcome })).toEqual({ outcome });
  });

it.each([null, undefined, [], [transport], {}, { ...transport, private: true },
  { outcome: 'no_candidates', candidate: null },
  { ...transport, candidate: { ...transport.candidate, constraint: [[28]] } }])(
  'rejects malformed or extra/private transport %#', value => {
    expect(() => narrowCandidateResult(value)).toThrow(CandidateContractError);
  });

it.each([
  { tmdb_movie_id: 0 }, { tmdb_movie_id: -1 }, { tmdb_movie_id: 1.5 },
  { title: '' }, { title: ' padded ' }, { title: 4 },
  { release_year: 1887 }, { release_year: 10000 }, { release_year: 2020.5 },
  { poster_url: 'http://image.tmdb.org/a.jpg' }, { poster_url: 'https://u:p@example.test/a' },
  { poster_url: 4 },
])('rejects invalid candidate field %#', patch => {
  expect(() => narrowCandidateResult({ ...transport, candidate: { ...transport.candidate, ...patch } }))
    .toThrow(CandidateContractError);
});

it('accepts sequence-aware metadata and exhaustion outcomes',()=>{
  expect(narrowCandidateResult({outcome:'metadata_unavailable',candidate_sequence:2,
    candidate_progression_status:'agreed'})).toEqual({outcome:'metadata_unavailable',
      candidateSequence:2,candidateProgressionStatus:'agreed'});
  expect(narrowCandidateResult({outcome:'exhausted',candidate_sequence:2,
    candidate_progression_status:'exhausted'})).toEqual({outcome:'exhausted',
      candidateSequence:2,candidateProgressionStatus:'exhausted'});
});

it('accepts confirmed no-poster and exposes only a fixed safe error', () => {
  expect(narrowCandidateResult({ ...transport, candidate: { ...transport.candidate, poster_url: null } }))
    .toEqual({ ...parsed, candidate: { ...parsed.candidate, posterUrl: null } });
  expect(new CandidateContractError().message).toBe('Unable to find a movie right now. Please try again.');
});

it('contains no fixture catalog or direct TMDB API transport', () => {
  const source = fs.readFileSync('src/candidates/contracts.ts','utf8');
  expect(source).not.toMatch(/fixture-|poster_key|candidate_id|api\.themoviedb\.org|genre_clauses|release_year_from/i);
});
