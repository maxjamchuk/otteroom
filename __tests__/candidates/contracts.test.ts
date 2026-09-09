import { CandidateContractError, narrowCandidateResult } from '../../src/candidates/contracts';

const available = { outcome: 'available', candidate_id: 'fixture-cardboard-comet', title: 'The Cardboard Comet', release_year: 2020, poster_key: 'cardboard-comet' };
const empty = { candidate_id: null, title: null, release_year: null, poster_key: null };
const fields = ['candidate_id', 'title', 'release_year', 'poster_key'] as const;

it.each([available, { outcome: 'not_ready', ...empty }, { outcome: 'not_found', ...empty }])('accepts the exact logical outcome %# without coercion', row => {
  expect(narrowCandidateResult([row])).toEqual(row);
});
it.each([1888, 9999])('accepts the inclusive catalog year boundary %i', release_year => {
  expect(narrowCandidateResult([{ ...available, release_year }])).toEqual({ ...available, release_year });
});
it.each([null, undefined, {}, available, [], [available, available], [null], [[]], [true], [42], ['private']])('rejects malformed cardinality/row shape %#', data => {
  expect(() => narrowCandidateResult(data)).toThrow(CandidateContractError);
});
it.each(['outcome', ...fields])('requires the own field %s', field => {
  const row: Record<string, unknown> = { ...available };
  delete row[field];
  expect(() => narrowCandidateResult([row])).toThrow(CandidateContractError);
  Object.setPrototypeOf(row, { [field]: available[field as keyof typeof available] });
  expect(() => narrowCandidateResult([row])).toThrow(CandidateContractError);
});
it('rejects extra fields and unknown outcomes without echoing input', () => {
  for (const row of [{ ...available, private: 'private backend detail' }, { ...available, outcome: 'private backend detail' }]) {
    expect(() => narrowCandidateResult([row])).toThrow(new CandidateContractError());
  }
  expect(new CandidateContractError().message).toBe('Unable to load this movie. Please try again.');
});
it.each(fields)('rejects NULL/undefined in available.%s', field => {
  for (const value of [null, undefined]) expect(() => narrowCandidateResult([{ ...available, [field]: value }])).toThrow(CandidateContractError);
});
it.each(['not_ready', 'not_found'])('requires four actual NULLs for %s', outcome => {
  for (const field of fields) {
    for (const value of [available[field], undefined, false, '']) {
      expect(() => narrowCandidateResult([{ outcome, ...empty, [field]: value }])).toThrow(CandidateContractError);
    }
  }
});
it.each(['candidate_id', 'poster_key'])('requires a lowercase slug for %s', field => {
  for (const value of ['', ' ', '-slug', 'slug-', 'two--parts', 'Upper', 'two_parts', 'a/b', 'slug\n', 'slug\r', 1, true, {}, []]) {
    expect(() => narrowCandidateResult([{ ...available, [field]: value }])).toThrow(CandidateContractError);
  }
});
it('requires a trimmed nonempty title', () => {
  for (const title of ['', ' ', ' leading', 'trailing ', '\nTitle', 42, true, {}, []]) {
    expect(() => narrowCandidateResult([{ ...available, title }])).toThrow(CandidateContractError);
  }
});
it('requires an integral in-range numeric year', () => {
  for (const release_year of [1887, 10000, 2020.5, NaN, Infinity, -Infinity, '2020', true, {}, []]) {
    expect(() => narrowCandidateResult([{ ...available, release_year }])).toThrow(CandidateContractError);
  }
});
