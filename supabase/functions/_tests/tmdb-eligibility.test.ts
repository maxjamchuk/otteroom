import { assert, assertEquals, assertFalse, assertThrows } from './assert.ts';
import {
  TMDB_GENRE_IDS,
  buildDiscoverUrl,
  chooseDriverClause,
  eligibleMovie,
  parseDiscoverPage,
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

Deno.test('smallest driver is stable, retains OR, and all-Any omits with_genres', () => {
  assertEquals(chooseDriverClause([[28, 12], [18], [35]]), [18]);
  assertEquals(chooseDriverClause([[28], [18]]), [28]);
  assertEquals(chooseDriverClause([]), null);
  const withDriver = buildDiscoverUrl('https://example.test/3', 2000, 2020, 2, [[28,12],[18]]);
  assertEquals(withDriver.searchParams.get('with_genres'), '18');
  assertFalse(buildDiscoverUrl('https://example.test/3', 2000, 2020, 1, []).searchParams.has('with_genres'));
});

Deno.test('Discover URL contains only exact fixed/date/page/OR-driver parameters', () => {
  const url = buildDiscoverUrl('https://example.test/3', 2000, 2020, 3, [[28,12],[18,35]]);
  assertEquals(url.pathname, '/3/discover/movie');
  assertEquals(Object.fromEntries(url.searchParams), {
    language: 'en-US', include_adult: 'false', include_video: 'false',
    sort_by: 'primary_release_date.asc', 'primary_release_date.gte': '2000-01-01',
    'primary_release_date.lte': '2020-12-31', page: '3', with_genres: '28|12',
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
