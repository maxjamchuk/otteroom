import { assert, assertEquals, assertFalse, assertThrows } from './assert.ts';
import {
  TMDB_GENRE_IDS,
  buildDiscoverUrl,
  compileGenrePushdown,
  eligibleMovie,
  MAX_EXACT_GENRE_BRANCHES,
  parseDiscoverPage,
  requiredMetrics,
} from '../_shared/tmdb-eligibility.ts';

const constraint = { releaseYearFrom: 2000, releaseYearTo: 2020,
  clauses: [[28, 12], [18, 35]] as number[][] };
const movie = { id: 41, adult: false, genreIds: [18, 28], title: 'Exact Film',
  releaseDate: '2000-01-01', posterPath: null };

Deno.test('canonical mapping contains exactly the approved nineteen positive unique IDs', () => {
  assertEquals(Object.keys(TMDB_GENRE_IDS).sort(), ['action','adventure','animation','comedy','crime',
    'documentary','drama','family','fantasy','history','horror','music','mystery','romance',
    'science_fiction','thriller','tv_movie','war','western']);
  assertEquals(Object.values(TMDB_GENRE_IDS), [28,12,16,35,80,99,18,10751,14,36,27,10402,
    9648,10749,878,10770,53,10752,37]);
  assertEquals(new Set(Object.values(TMDB_GENRE_IDS)).size, 19);
});

Deno.test('genre compiler removes redundant clauses and compiles exact singleton conjunctions', () => {
  assertEquals(compileGenrePushdown([[28, 12], [18], [35]]), {
    representation: 'exact', withGenres: '18,35', branches: ['12,18,35', '18,28,35'],
    normalizedClauses: [[18], [35], [12, 28]], localRemainder: [],
  });
  assertEquals(compileGenrePushdown([[80], [35], [878]]), {
    representation: 'exact', withGenres: '35,80,878', branches: ['35,80,878'],
    normalizedClauses: [[35], [80], [878]], localRemainder: [],
  });
  assertEquals(compileGenrePushdown([[18, 53], [18, 27, 53], [18, 53]]), {
    representation: 'exact', withGenres: '18|53', branches: ['18|53'],
    normalizedClauses: [[18, 53]], localRemainder: [],
  });
  const withDriver = buildDiscoverUrl('https://example.test/3', 2000, 2020, 2, [[28,12],[18]]);
  assertEquals(withDriver.searchParams.get('with_genres'), '18');
  assertFalse(buildDiscoverUrl('https://example.test/3', 2000, 2020, 1, []).searchParams.has('with_genres'));
});

Deno.test('genre compiler handles every clause shape without mixed comma/pipe precedence', () => {
  const cases: Array<[number[][], string | null, GenreKind]> = [
    [[], null, 'none'], [[[28]], '28', 'exact'], [[[28,12,28]], '12|28', 'exact'],
    [[[28,12],[12,28]], '12|28', 'exact'],
    [[[18,53],[18,27,53]], '18|53', 'exact'],
    [[[80],[35],[878]], '35,80,878', 'exact'],
    [[[80],[35],[878],[35,80,878,28]], '35,80,878', 'exact'],
    [[[28,12],[35,80]], '12|28', 'exact'],
    [[[28],[35,80]], '28', 'exact'],
  ];
  for (const [clauses, expected, kind] of cases) {
    const compiled = compileGenrePushdown(clauses);
    assertEquals(compiled.withGenres, expected);
    assertEquals(compiled.representation, kind);
    for (const permutation of [clauses, [...clauses].reverse()])
      assertEquals(compileGenrePushdown(permutation), compiled);
  }
});

type GenreKind = 'exact' | 'partial' | 'none';

Deno.test('exhaustive small-universe genre branch union is exactly local CNF or a safe fallback', () => {
  const ids = [12, 28, 35, 80];
  const allClauses = Array.from({ length: 15 }, (_, bits) =>
    ids.filter((_, index) => ((bits + 1) & (1 << index)) !== 0));
  const providerAccepts = (genres: readonly number[], expression: string | null) => expression === null ||
    (expression.includes(',') ? expression.split(',').every(id => genres.includes(Number(id))) :
      expression.split('|').some(id => genres.includes(Number(id))));
  for (const first of [[], ...allClauses]) for (const second of [[], ...allClauses])
    for (const third of [[], ...allClauses]) {
      const clauses = [first, second, third].filter(clause => clause.length > 0);
      const compiled = compileGenrePushdown(clauses);
      for (let bits = 0; bits < 16; bits++) {
        const genres = ids.filter((_, index) => (bits & (1 << index)) !== 0);
        const local = eligibleMovie({ ...movie, genreIds: genres }, { ...constraint, clauses });
        const provider = compiled.branches.some(branch => providerAccepts(genres, branch));
        if (local) assert(provider);
        if (compiled.representation === 'exact') assertEquals(provider, local);
      }
    }
});

Deno.test('four-voter small-universe decomposition never loses a locally eligible genre set', () => {
  const ids = [35, 80, 878];
  const clauses = Array.from({ length: 7 }, (_, bits) =>
    ids.filter((_, index) => ((bits + 1) & (1 << index)) !== 0));
  const providerAccepts = (genres: readonly number[], expression: string | null) => expression === null ||
    (expression.includes(',') ? expression.split(',').every(id => genres.includes(Number(id))) :
      expression.split('|').some(id => genres.includes(Number(id))));
  for (const a of clauses) for (const b of clauses) for (const c of clauses) for (const d of clauses) {
    const current = [a, b, c, d];
    const compiled = compileGenrePushdown(current);
    for (let bits = 0; bits < 8; bits++) {
      const genres = ids.filter((_, index) => (bits & (1 << index)) !== 0);
      const local = current.every(clause => clause.some(id => genres.includes(id)));
      const provider = compiled.branches.some(branch => providerAccepts(genres, branch));
      if (local) assert(provider);
      if (compiled.representation === 'exact') assertEquals(provider, local);
    }
  }
});

Deno.test('owner mixed clauses compile to the three exact pair branches with a bounded fallback', () => {
  const clauses = [[35, 878], [35, 80], [80, 878]];
  const compiled = compileGenrePushdown(clauses);
  assertEquals(compiled, { representation: 'exact', withGenres: '35|80',
    branches: ['35,80', '35,878', '80,878'],
    normalizedClauses: [[35, 80], [35, 878], [80, 878]], localRemainder: [] });
  for (const branch of compiled.branches) {
    const url = buildDiscoverUrl('https://example.test/3', 1900, 2026, 1, clauses,
      '1900-01-01', '2026-12-31', { ruleSetKind: 'configured_009_v1', ordering: 'vote_count_desc',
        minimumVoteCount: 500, minimumAverageRating: null, metadataLanguage: 'en-US', genreMode: 'or' }, branch);
    assertEquals(url.searchParams.get('with_genres'), branch);
  }
  const overflowing = compileGenrePushdown([[12, 16], [18, 27], [28, 35], [80, 878]]);
  assertEquals(MAX_EXACT_GENRE_BRANCHES, 12);
  assertEquals(overflowing.representation, 'partial');
  assertEquals(overflowing.withGenres, '12|16');
  assertEquals(overflowing.branches, ['12|16']);
});

Deno.test('Discover URL contains only exact fixed/date/page/OR-driver parameters', () => {
  const url = buildDiscoverUrl('https://example.test/3', 2000, 2020, 3, [[28,12],[18,35]]);
  assertEquals(url.pathname, '/3/discover/movie');
  assertEquals(Object.fromEntries(url.searchParams), {
    language: 'en-US', include_adult: 'false', include_video: 'false',
    sort_by: 'primary_release_date.asc', 'primary_release_date.gte': '2000-01-01',
    'primary_release_date.lte': '2020-12-31', page: '3', with_genres: '12|28',
  });
  for (const forbidden of ['region','with_watch_providers','vote_count.gte','popularity.gte'])
    assertFalse(url.searchParams.has(forbidden));
  assertFalse(url.searchParams.get('with_genres')!.includes(','));
});

Deno.test('exact validator preserves AND between clauses, OR within each, duplicates, and all-Any truth', () => {
  assert(eligibleMovie(movie, constraint));
  assert(eligibleMovie(movie, { ...constraint, clauses: [[28,12],[28,12]] }));
  assert(eligibleMovie(movie, { ...constraint, clauses: [] }));
  assertFalse(eligibleMovie({ ...movie, genreIds: [28] }, constraint));
  assertFalse(eligibleMovie({ ...movie, genreIds: [18] }, constraint));
});

Deno.test('validator enforces inclusive years, adult false, positive ID and exact date', () => {
  assert(eligibleMovie(movie, constraint));
  assert(eligibleMovie({ ...movie, releaseDate: '2020-12-31' }, constraint));
  for (const patch of [{ releaseDate: '1999-12-31' }, { releaseDate: '2021-01-01' },
    { releaseDate: '' }, { releaseDate: '2020' }, { releaseDate: '2020-02-30' },
    { adult: true }, { id: 0 }, { id: -1 }]) assertFalse(eligibleMovie({ ...movie, ...patch }, constraint));
});

Deno.test('strict page parser validates relevant fields and canonicalizes duplicate genre IDs', () => {
  const parsed = parseDiscoverPage({ page: 1, total_pages: 1, total_results: 1, results: [{
    id: 41, adult: false, genre_ids: [28,18,28], title: ' Exact Film ',
    release_date: '2000-01-01', poster_path: null,
  }] }, 1);
  assertEquals(parsed.results[0], movie);
  for (const bad of [null, {}, { page: 2, total_pages: 1, total_results: 0, results: [] },
    { page: 1, total_pages: -1, total_results: 0, results: [] },
    { page: 1, total_pages: 1, total_results: 1, results: [{ ...movie }] }])
    assertThrows(() => parseDiscoverPage(bad, 1));
});

Deno.test('configured Discover mapping retains language, order, cutoffs and AND pushdown', () => {
  const options = { ruleSetKind: 'configured_009_v1' as const, ordering: 'average_rating_desc' as const,
    minimumVoteCount: 500, minimumAverageRating: 7.25, metadataLanguage: 'fr-FR', genreMode: 'and' as const };
  const url = buildDiscoverUrl('https://example.test/3', 2000, 2020, 2, [[28], [18]], undefined, undefined, options);
  assertEquals(Object.fromEntries(url.searchParams), {
    language: 'fr-FR', include_adult: 'false', include_video: 'false', sort_by: 'vote_average.desc',
    'primary_release_date.gte': '2000-01-01', 'primary_release_date.lte': '2020-12-31', page: '2',
    'vote_count.gte': '500', 'vote_average.gte': '7.25', with_genres: '18,28',
  });
});

Deno.test('required metric union distinguishes configured and explicit legacy rooms', () => {
  assertEquals([...requiredMetrics({ ...constraint, ruleSetKind: 'configured_009_v1', ordering: 'vote_count_desc', minimumVoteCount: 500, minimumAverageRating: null, metadataLanguage: 'en-US', genreMode: 'or' })], ['vote_count']);
  assertEquals([...requiredMetrics({ ...constraint, ruleSetKind: 'configured_009_v1', ordering: 'popularity_desc', minimumVoteCount: 500, minimumAverageRating: 7, metadataLanguage: 'en-US', genreMode: 'or' })], ['vote_count', 'vote_average', 'popularity']);
  assertEquals([...requiredMetrics({ ...constraint, ruleSetKind: 'legacy_005_006_008', ordering: 'legacy_source_order', minimumVoteCount: null, minimumAverageRating: null, metadataLanguage: 'en-US', genreMode: 'or' })], []);
});
