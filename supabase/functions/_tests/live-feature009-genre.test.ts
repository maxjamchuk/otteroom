import { assert, assertEquals } from './assert.ts';
import { searchTmdbCandidate } from '../_shared/tmdb-client.ts';

const token = Deno.env.get('TMDB_API_READ_ACCESS_TOKEN');

Deno.test({ name: 'bounded live three-singleton genre progression', ignore: !token, fn: async () => {
  if (!token) throw new Error('TMDB_CREDENTIAL_UNAVAILABLE');
  const excluded: number[] = [];
  const expected = [
    /^Despicable Me$/,
    /^Minions: The Rise of Gru$/,
    /^Robot & Frank$/,
    /^Batman vs\.? Teenage Mutant Ninja Turtles$/,
  ];
  for (let step = 0; step <= 4; step++) {
    let count = 0;
    const started = performance.now();
    const result = await searchTmdbCandidate({
      releaseYearFrom: 1900, releaseYearTo: 2026, clauses: [[80], [35], [878]],
      ruleSetKind: 'configured_009_v1', ordering: 'vote_count_desc',
      minimumVoteCount: 500, minimumAverageRating: null,
      metadataLanguage: 'en-US', genreMode: 'or', excludedTmdbMovieIds: excluded,
    }, { token, maxRequests: 8, deadlineMs: 20_000, fetch: async (input, init) => {
      const url = new URL(String(input));
      assertEquals(url.searchParams.get('language'), 'en-US');
      assertEquals(url.searchParams.get('include_adult'), 'false');
      assertEquals(url.searchParams.get('include_video'), 'false');
      assertEquals(url.searchParams.get('with_genres'), '35,80,878');
      assertEquals(url.searchParams.get('primary_release_date.gte'), '1900-01-01');
      assertEquals(url.searchParams.get('primary_release_date.lte'), '2026-12-31');
      assertEquals(url.searchParams.get('sort_by'), 'vote_count.desc');
      assertEquals(url.searchParams.get('vote_count.gte'), '500');
      assertEquals(url.searchParams.get('vote_average.gte'), null);
      assertEquals(url.searchParams.get('page'), '1');
      count++;
      const response = await fetch(input, init);
      if (response.ok) {
        const body = await response.clone().json() as Record<string, unknown>;
        assertEquals(body.total_results, 4);
        assertEquals(body.total_pages, 1);
      }
      return response;
    } });
    const durationMs = Math.round(performance.now() - started);
    if (step === 4) assertEquals(result.kind, 'completed_empty');
    else {
      assertEquals(result.kind, 'match');
      if (result.kind === 'match') {
        assert(expected[step].test(result.movie.title));
        excluded.push(result.movie.id);
      }
    }
    assertEquals(count, 1);
    console.log(JSON.stringify({ step: step + 1, outcome: result.kind,
      title: result.kind === 'match' ? result.movie.title : null, requests: count, duration_ms: durationMs }));
  }
} });
