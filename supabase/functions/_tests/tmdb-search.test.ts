import { assertEquals, assertFalse } from './assert.ts';
import { clearConfigurationForTests, loadTmdbPresentation, searchTmdbCandidate } from '../_shared/tmdb-client.ts';
import type { FetchLike } from '../_shared/candidate-contracts.ts';

const context = { releaseYearFrom: 2000, releaseYearTo: 2001, clauses: [[28]] as number[][] };
const eligible = { id: 7, adult: false, genre_ids: [28], title: 'Winner',
  release_date: '2000-01-01', poster_path: null };
const configured = { releaseYearFrom: 2000, releaseYearTo: 2001, clauses: [[28]] as number[][],
  ruleSetKind: 'configured_009_v1' as const, ordering: 'vote_count_desc' as const,
  minimumVoteCount: 500, minimumAverageRating: null, metadataLanguage: 'en-US', genreMode: 'or' as const };
const response = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers }));
const page = (number: number, pages: number, results: unknown[] = []) =>
  ({ page: number, total_pages: pages, total_results: results.length, results });

Deno.test('three singleton voters: weak Crime traversal deadlines, exact pushdown completes four-film progression', async () => {
  const scenario = { ...configured, releaseYearFrom: 1900, releaseYearTo: 2026,
    clauses: [[80], [35], [878]] };
  const titles = ['Despicable Me', 'Minions: The Rise of Gru', 'Robot & Frank',
    'Batman vs Teenage Mutant Ninja Turtles'];
  const votes = [16_398, 4_184, 1_199, 571];
  const films = titles.map((title, index) => ({ ...eligible, id: index + 1, title,
    release_date: '2010-01-01', genre_ids: [80, 35, 878], vote_count: votes[index] }));
  const highDecoys = Array.from({ length: 188 }, (_, index) => ({ ...eligible,
    id: 1000 + index, title: `Crime decoy ${index}`, release_date: '2010-01-01',
    genre_ids: [80], vote_count: 16_000 - index * 60 }));
  const lowDecoys = Array.from({ length: 1111 }, (_, index) => ({ ...eligible,
    id: 1188 + index, title: `Crime decoy ${index + 188}`, release_date: '2010-01-01',
    genre_ids: [80], vote_count: 4_100 - index * 3 }));
  const broad = [films[0], ...highDecoys, ...lowDecoys, ...films.slice(1)]
    .sort((a, b) => b.vote_count - a.vote_count);
  // Minions lands on page 10. A small provider primary regression on that page
  // makes the ordered-source proof require the remaining 56 Crime pages.
  [broad[194], broad[195]] = [broad[195], broad[194]];
  assertEquals(broad.length, 1303);
  assertEquals(broad.findIndex(film => film.id === 2) >= 180 &&
    broad.findIndex(film => film.id === 2) < 200, true);
  const provider = (urls: URL[], tick: () => void, historicalWeak = false): FetchLike => input => {
    const url = new URL(String(input));
    if (historicalWeak) url.searchParams.set('with_genres', '80');
    urls.push(url); tick();
    const rows = url.searchParams.get('with_genres') === '80' ? broad : films;
    const current = Number(url.searchParams.get('page'));
    const results = rows.slice((current - 1) * 20, current * 20);
    return response({ page: current, total_pages: Math.ceil(rows.length / 20),
      total_results: rows.length, results });
  };
  // This is the old provider response to with_genres=80: the first film is
  // provable on page 1. The excluded-first search sees film 2 on page 10,
  // but cannot certify it after the page-10 provider regression.
  for (const excluded of [[], [1]]) {
    let elapsed = 0; const urls: URL[] = []; const evaluated: number[] = [];
    const result = await searchTmdbCandidate({ ...scenario, excludedTmdbMovieIds: excluded }, {
      fetch: provider(urls, () => { elapsed += 1_000; }, true), now: () => elapsed,
      token: 'secret', baseUrl: 'https://example.test/3', maxRequests: 100, deadlineMs: 20_000,
      onMovieEvaluated: film => evaluated.push(film.id),
    });
    assertEquals(result.kind === 'match' ? result.movie.id : null, excluded.length ? null : 1);
    if (excluded.length) assertEquals(result, { kind: 'search_incomplete', reason: 'deadline' });
    assertEquals(urls.map(url => Number(url.searchParams.get('page'))), excluded.length ?
      Array.from({ length: 20 }, (_, index) => index + 1) : [1]);
    assertEquals(elapsed, excluded.length ? 20_000 : 1_000);
    if (excluded.length) assertEquals(evaluated.includes(2), true);
    assertEquals(urls.every(url => url.searchParams.get('with_genres') === '80'), true);
  }
  for (let excludedCount = 0; excludedCount <= 4; excludedCount++) {
    let elapsed = 0; const urls: URL[] = [];
    const result = await searchTmdbCandidate({ ...scenario,
      excludedTmdbMovieIds: films.slice(0, excludedCount).map(film => film.id) }, {
      fetch: provider(urls, () => { elapsed += 1_000; }), now: () => elapsed,
      token: 'secret', baseUrl: 'https://example.test/3', maxRequests: 100, deadlineMs: 20_000,
    });
    if (excludedCount === 4) assertEquals(result, { kind: 'completed_empty' });
    else {
      assertEquals(result.kind === 'match' ? result.movie.title : null, titles[excludedCount]);
      assertEquals(result.kind === 'match' ? result.movie.voteCount : null, votes[excludedCount]);
    }
    assertEquals(urls.length, 1);
    assertEquals(elapsed, 1_000);
    assertEquals(urls[0].searchParams.get('with_genres'), '35,80,878');
    assertEquals(urls[0].searchParams.get('sort_by'), 'vote_count.desc');
    assertEquals(urls[0].searchParams.get('vote_count.gte'), '500');
    assertEquals(urls[0].searchParams.get('vote_average.gte'), null);
    assertEquals(urls[0].searchParams.get('primary_release_date.gte'), '1900-01-01');
    assertEquals(urls[0].searchParams.get('primary_release_date.lte'), '2026-12-31');
  }
});

Deno.test('mixed three-voter clauses merge exact pair branches through fifth candidate and true exhaustion', async () => {
  const scenario = { ...configured, releaseYearFrom: 1900, releaseYearTo: 2026,
    clauses: [[35, 878], [35, 80], [80, 878]] };
  const film = (id: number, vote_count: number, genre_ids: number[]) => ({ ...eligible, id,
    vote_count, genre_ids, title: `Film ${id}` });
  const first = film(1, 1200, [35, 80, 878]);
  const second = film(2, 1100, [35, 80]);
  const third = film(3, 1000, [35, 878]);
  const fourth = film(4, 900, [80, 878]);
  const fifth = film(5, 800, [35, 80]);
  const sixth = film(6, 800, [35, 878]);
  const branches: Record<string, unknown[][]> = {
    '35,80': [[first, second], [fifth, first]],
    '35,878': [[first, third, sixth]],
    '80,878': [[first, fourth]],
  };
  for (let excludedCount = 0; excludedCount <= 6; excludedCount++) {
    const requests: string[] = [];
    const evaluated: number[] = [];
    let elapsed = 0;
    const result = await searchTmdbCandidate({ ...scenario,
      excludedTmdbMovieIds: [1, 2, 3, 4, 5, 6].slice(0, excludedCount) }, {
      token: 'secret', baseUrl: 'https://example.test/3', maxRequests: 12,
      deadlineMs: 20_000, now: () => elapsed,
      onMovieEvaluated: movie => evaluated.push(movie.id),
      fetch: input => {
        const url = new URL(String(input));
        const branch = url.searchParams.get('with_genres')!;
        const rows = branches[branch];
        assertEquals(Array.isArray(rows), true);
        assertEquals(url.searchParams.get('sort_by'), 'vote_count.desc');
        assertEquals(url.searchParams.get('vote_count.gte'), '500');
        const pageNumber = Number(url.searchParams.get('page'));
        requests.push(`${branch}:${pageNumber}`);
        elapsed += 1_000;
        return response({ page: pageNumber, total_pages: rows.length,
          total_results: rows.flat().length, results: rows[pageNumber - 1] });
      },
    });
    if (excludedCount === 6) assertEquals(result, { kind: 'completed_empty' });
    else assertEquals(result.kind === 'match' ? result.movie.id : null, excludedCount + 1);
    assertEquals(requests.filter(request => request.endsWith(':1')),
      ['35,80:1', '35,878:1', '80,878:1']);
    assertEquals(requests.length <= 4, true);
    assertEquals(elapsed < 20_000, true);
    assertEquals(new Set(evaluated).size, evaluated.length);
    assertEquals(evaluated.filter(id => id === 1).length, 1);
  }
});

Deno.test('mixed branch budget failure cannot commit an earlier branch winner', async () => {
  const clauses = [[35, 878], [35, 80], [80, 878]];
  const requests: string[] = [];
  const result = await searchTmdbCandidate({ ...configured, clauses }, {
    token: 'secret', baseUrl: 'https://example.test/3', maxRequests: 2,
    fetch: input => {
      const branch = new URL(String(input)).searchParams.get('with_genres')!;
      requests.push(branch);
      return response(page(1, 1, [{ ...eligible, id: 77, genre_ids: [35, 80, 878],
        vote_count: 900 }]));
    },
  });
  assertEquals(result, { kind: 'search_incomplete', reason: 'request_budget' });
  assertEquals(requests, ['35,80', '35,878']);
});

Deno.test('title ordering exhausts every exact branch and merges localized ties by TMDB ID', async () => {
  const clauses = [[35, 878], [35, 80], [80, 878]];
  const requests: string[] = [];
  const row = (id: number, title: string, genre_ids: number[]) => ({ ...eligible, id,
    title, genre_ids, vote_count: 500 });
  const branches: Record<string, unknown[][]> = {
    '35,80': [[row(1, 'Zulu', [35, 80])], [row(2, 'Alpha', [35, 80])]],
    '35,878': [[row(3, 'Beta', [35, 878])]],
    '80,878': [[row(4, 'Alpha', [80, 878])]],
  };
  const result = await searchTmdbCandidate({ ...configured, clauses, ordering: 'title_asc' }, {
    token: 'secret', baseUrl: 'https://example.test/3', fetch: input => {
      const url = new URL(String(input));
      const branch = url.searchParams.get('with_genres')!;
      const pageNumber = Number(url.searchParams.get('page'));
      const pages = branches[branch];
      requests.push(`${branch}:${pageNumber}`);
      return response({ page: pageNumber, total_pages: pages.length,
        total_results: pages.flat().length, results: pages[pageNumber - 1] });
    },
  });
  assertEquals(result.kind === 'match' ? result.movie.id : null, 2);
  assertEquals(requests, ['35,80:1', '35,80:2', '35,878:1', '80,878:1']);
});

Deno.test('branch explosion uses one conservative query and keeps local clauses authoritative', async () => {
  const clauses = [[12, 16], [18, 27], [28, 35], [80, 878]];
  const requests: string[] = [];
  const result = await searchTmdbCandidate({ ...configured, clauses }, {
    token: 'secret', baseUrl: 'https://example.test/3', fetch: input => {
      requests.push(new URL(String(input)).searchParams.get('with_genres')!);
      return response(page(1, 1, [
        { ...eligible, id: 88, genre_ids: [12], vote_count: 900 },
        { ...eligible, id: 89, genre_ids: [12, 18, 28, 80], vote_count: 800 },
      ]));
    },
  });
  assertEquals(requests, ['12|16']);
  assertEquals(result.kind === 'match' ? result.movie.id : null, 89);
});

Deno.test('search traverses pages ascending and short-circuits on first exact match', async () => {
  const urls: URL[] = [];
  const fetch: FetchLike = (input) => { const url = new URL(String(input)); urls.push(url);
    return response({ ...page(Number(url.searchParams.get('page')), 3,
      url.searchParams.get('page') === '2' ? [eligible] : [{ ...eligible, id: 8, genre_ids: [18] }]),
      total_results: 2 }); };
  const result = await searchTmdbCandidate(context, { fetch, token: 'secret', baseUrl: 'https://example.test/3' });
  assertEquals(result, { kind: 'match', movie: { id: 7, adult: false, genreIds: [28], title: 'Winner',
    releaseDate: '2000-01-01', posterPath: null } });
  assertEquals(urls.map(url => url.searchParams.get('page')), ['1','2']);
  assertEquals(urls[0].searchParams.get('language'), 'en-US');
  assertEquals(urls[0].searchParams.get('include_adult'), 'false');
  assertFalse(urls[0].searchParams.has('region'));
});

Deno.test('search deduplicates movie evaluation without changing traversal', async () => {
  let validations = 0;
  const fetch: FetchLike = (input) => response({
    ...page(Number(new URL(String(input)).searchParams.get('page')), 2, [eligible]), total_results: 2,
  });
  const result = await searchTmdbCandidate({ ...context, clauses: [[18]] }, { fetch, token: 'secret',
    baseUrl: 'https://example.test/3', onMovieEvaluated: () => validations++ });
  assertEquals(result.kind, 'completed_empty');
  assertEquals(validations, 1);
});

Deno.test('server exclusions skip repeated identities and preserve first eligible traversal',async()=>{
  const second={...eligible,id:8,title:'Next'};
  const fetch:FetchLike=()=>response(page(1,1,[eligible,second]));
  const winner=await searchTmdbCandidate({...context,excludedTmdbMovieIds:[7]},
    {fetch,token:'secret',baseUrl:'https://example.test/3'});
  assertEquals(winner.kind==='match'?winner.movie.id:null,8);
  const empty=await searchTmdbCandidate({...context,excludedTmdbMovieIds:[7,8]},
    {fetch,token:'secret',baseUrl:'https://example.test/3'});
  assertEquals(empty.kind,'completed_empty');
  const invalid=await searchTmdbCandidate({...context,excludedTmdbMovieIds:[0]},
    {fetch,token:'secret',baseUrl:'https://example.test/3'});
  assertEquals(invalid,{kind:'search_incomplete',reason:'internal'});
});

Deno.test('overflow bisects whole dates without gap/overlap and visits oldest shard first', async () => {
  const dates: string[] = [];
  const fetch: FetchLike = (input) => { const url = new URL(String(input));
    const from = url.searchParams.get('primary_release_date.gte')!;
    const to = url.searchParams.get('primary_release_date.lte')!;
    dates.push(`${from}/${to}`);
    const broad = from === '2000-01-01' && to === '2001-12-31';
    return response(page(1, broad ? 501 : 1)); };
  const result = await searchTmdbCandidate(context, { fetch, token: 'secret', baseUrl: 'https://example.test/3' });
  assertEquals(result.kind, 'completed_empty');
  assertEquals(dates, ['2000-01-01/2001-12-31','2000-01-01/2000-12-31','2001-01-01/2001-12-31']);
});

Deno.test('single-day overflow and pagination inconsistency are incomplete, never empty', async () => {
  const single = await searchTmdbCandidate({ releaseYearFrom: 2000, releaseYearTo: 2000, clauses: [] }, {
    fetch: () => response(page(1, 501)), token: 'secret', baseUrl: 'https://example.test/3' });
  assertEquals(single.kind, 'search_incomplete');
  let call = 0;
  const inconsistent = await searchTmdbCandidate(context, { fetch: () => {
    call++; return response(page(call, call === 1 ? 2 : 3)); }, token: 'secret', baseUrl: 'https://example.test/3' });
  assertEquals(inconsistent.kind, 'search_incomplete');
});

Deno.test('429 honors advisory Retry-After with bounded jitter and every retry counts', async () => {
  for (const retryAfter of [undefined, '1']) {
    let calls = 0; const sleeps: number[] = [];
    const result = await searchTmdbCandidate(context, {
      fetch: () => ++calls < 3 ? response({ status_message: 'private' }, 429,
        retryAfter ? { 'retry-after': retryAfter } : {}) : response(page(1, 1)),
      token: 'secret', baseUrl: 'https://example.test/3', random: () => 0,
      sleep: async milliseconds => { sleeps.push(milliseconds); },
    });
    assertEquals(result.kind, 'completed_empty'); assertEquals(calls, 3);
    assertEquals(sleeps, retryAfter ? [1000,1000] : [100,200]);
  }
});

Deno.test('4xx and exhausted 5xx classes are incomplete after exact bounded attempts', async () => {
  for (const [status, attempts] of [[401,1],[400,1],[422,1],[500,3],[502,3],[503,3],[504,3]] as const) {
    let calls=0;
    const result=await searchTmdbCandidate(context,{fetch:()=>{calls++;return response({},status);},
      token:'secret',baseUrl:'https://example.test/3',sleep:async()=>{},random:()=>0});
    assertEquals(result.kind,'search_incomplete'); assertEquals(calls,attempts);
  }
});

Deno.test('transport abort and malformed JSON/schema never become completed-empty', async () => {
  const transport=await searchTmdbCandidate(context,{fetch:()=>Promise.reject(new Error('private')),
    token:'secret',baseUrl:'https://example.test/3',sleep:async()=>{},random:()=>0});
  assertEquals(transport,{kind:'search_incomplete',reason:'timeout'});
  const malformedJson=await searchTmdbCandidate(context,{fetch:()=>Promise.resolve(new Response('{')),
    token:'secret',baseUrl:'https://example.test/3'});
  assertEquals(malformedJson.kind,'search_incomplete');
  for(const body of [{page:1,total_pages:1,total_results:1,results:null},
    {page:1,total_pages:1,total_results:1,results:[{...eligible,adult:'false'}]},
    {page:1,total_pages:1,total_results:1,results:[{...eligible,release_date:''}]}]){
    const result=await searchTmdbCandidate(context,{fetch:()=>response(body),token:'secret',
      baseUrl:'https://example.test/3'}); assertEquals(result.kind,'search_incomplete');
  }
});

Deno.test('real abort deadline and request-budget exhaustion stop incomplete', async () => {
  const timeout=await searchTmdbCandidate(context,{fetch:(_input,init)=>new Promise((_resolve,reject)=>{
    init?.signal?.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});
  }),token:'secret',baseUrl:'https://example.test/3',deadlineMs:5,sleep:async()=>{}});
  assertEquals(timeout.kind,'search_incomplete');
  let calls=0;
  const exhausted=await searchTmdbCandidate(context,{fetch:(input)=>{
    calls++;const current=Number(new URL(String(input)).searchParams.get('page'));
    return response(page(current,3));},token:'secret',baseUrl:'https://example.test/3',maxRequests:2});
  assertEquals(exhausted.kind,'search_incomplete');assertEquals(calls,2);
});

Deno.test('deadline remains active while a successful response body is being read', async () => {
  let signal: AbortSignal | null | undefined;
  const stalled = searchTmdbCandidate(context, { fetch: (_input, init) => {
    signal = init?.signal;
    return Promise.resolve({ ok: true, status: 200, headers: new Headers(), json: () =>
      new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(new Error('aborted')),
        { once: true })) } as Response);
  }, token: 'secret', baseUrl: 'https://example.test/3', deadlineMs: 5, sleep: async () => {} });
  let timer = 0;
  const result = await Promise.race([stalled, new Promise<'hung'>(resolve => {
    timer = setTimeout(() => resolve('hung'), 50);
  })]);
  clearTimeout(timer);
  assertFalse(result === 'hung');
  if (result !== 'hung') assertEquals(result.kind, 'search_incomplete');
});

Deno.test('positive total with empty declared pages is pagination-inconsistent',async()=>{
  const result=await searchTmdbCandidate(context,{fetch:(input)=>{
    const current=Number(new URL(String(input)).searchParams.get('page'));
    return response({page:current,total_pages:2,total_results:4,results:[]});},
    token:'secret',baseUrl:'https://example.test/3'});
  assertEquals(result,{kind:'search_incomplete',reason:'pagination_inconsistent'});
});

Deno.test('aggregate raw rows fewer or greater than reported total are incomplete',async()=>{
  for(const totalResults of [3,1]){
    const result=await searchTmdbCandidate(context,{fetch:(input)=>{
      const current=Number(new URL(String(input)).searchParams.get('page'));
      return response({page:current,total_pages:2,total_results:totalResults,
        results:[{...eligible,id:current,genre_ids:[18]}]});},
      token:'secret',baseUrl:'https://example.test/3'});
    assertEquals(result,{kind:'search_incomplete',reason:'pagination_inconsistent'});
  }
});

Deno.test('cumulative raw row overflow rejects a later eligible movie',async()=>{
  const result=await searchTmdbCandidate(context,{fetch:(input)=>{
    const current=Number(new URL(String(input)).searchParams.get('page'));
    return response({page:current,total_pages:2,total_results:1,
      results:[current===1?{...eligible,id:8,genre_ids:[18]}:eligible]});},
    token:'secret',baseUrl:'https://example.test/3'});
  assertEquals(result,{kind:'search_incomplete',reason:'pagination_inconsistent'});
});

Deno.test('valid multi-page no-match uses raw row count before ID deduplication',async()=>{
  let validations=0;
  const result=await searchTmdbCandidate(context,{fetch:(input)=>{
    const current=Number(new URL(String(input)).searchParams.get('page'));
    return response({page:current,total_pages:2,total_results:2,
      results:[{...eligible,id:99,genre_ids:[18]}]});},
    token:'secret',baseUrl:'https://example.test/3',onMovieEvaluated:()=>validations++});
  assertEquals(result,{kind:'completed_empty'});assertEquals(validations,1);
});

Deno.test('a page with more raw rows than its reported total is incomplete before a match',async()=>{
  const result=await searchTmdbCandidate(context,{fetch:()=>response({page:1,total_pages:1,total_results:0,
    results:[eligible]}),token:'secret',baseUrl:'https://example.test/3'});
  assertEquals(result,{kind:'search_incomplete',reason:'pagination_inconsistent'});
});

Deno.test('the historical 500-page empty contradiction cannot complete',async()=>{
  const result=await searchTmdbCandidate({releaseYearFrom:2000,releaseYearTo:2000,clauses:[]},{
    fetch:(input)=>{const current=Number(new URL(String(input)).searchParams.get('page'));
      return response({page:current,total_pages:500,total_results:10_000,results:[]});},
    token:'secret',baseUrl:'https://example.test/3',maxRequests:500,deadlineMs:20_000});
  assertEquals(result,{kind:'search_incomplete',reason:'pagination_inconsistent'});
});

Deno.test('page 500 can complete only when raw counts and metadata fit the explicit budget',async()=>{
  const visited:number[]=[];
  const result=await searchTmdbCandidate({releaseYearFrom:2000,releaseYearTo:2000,clauses:[]},{
    fetch:(input)=>{const current=Number(new URL(String(input)).searchParams.get('page'));visited.push(current);
      return response({page:current,total_pages:500,total_results:10_000,
        results:Array.from({length:20},(_,offset)=>({...eligible,id:offset+1,adult:true}))});},
    token:'secret',baseUrl:'https://example.test/3',maxRequests:500,deadlineMs:20_000});
  assertEquals(result.kind,'completed_empty');assertEquals(visited.length,500);
  assertEquals(visited[0],1);assertEquals(visited[499],500);
});

Deno.test('complete recursive multi-shard zero means only no eligible movie observed in that attempt',async()=>{
  const traversed:string[]=[];
  const result=await searchTmdbCandidate(context,{fetch:(input)=>{const url=new URL(String(input));
    const span=`${url.searchParams.get('primary_release_date.gte')}/${url.searchParams.get('primary_release_date.lte')}`;
    traversed.push(span); return response(page(1,traversed.length===1?501:1,[{...eligible,id:99,genre_ids:[18]}]));},
    token:'secret',baseUrl:'https://example.test/3'});
  assertEquals(result.kind,'completed_empty');assertEquals(traversed.length,3);
  assertFalse(JSON.stringify(result).toLowerCase().includes('global'));
  assertFalse(JSON.stringify(result).toLowerCase().includes('snapshot'));
});

Deno.test('Details and Configuration use Bearer headers, en-US and bounded HTTPS poster size',async()=>{
  clearConfigurationForTests();const requests:Array<{url:URL;authorization:string|null}>=[];
  const fetch:FetchLike=(input,init)=>{const url=new URL(String(input));
    requests.push({url,authorization:new Headers(init?.headers).get('authorization')});
    if(url.pathname.endsWith('/configuration'))return response({images:{secure_base_url:'https://cdn.example.test/t/p/',
      poster_sizes:['w92','w500','w780','original']}});
    return response({id:7,title:'Current Title',release_date:'2001-02-03',poster_path:'/poster.jpg'});
  };
  const result=await loadTmdbPresentation(7,{fetch,token:'server-secret',baseUrl:'https://example.test/3'});
  assertEquals(result,{tmdbMovieId:7,title:'Current Title',releaseYear:2001,
    posterUrl:'https://cdn.example.test/t/p/w780/poster.jpg'});
  assertEquals(requests.map(item=>item.url.pathname),['/3/movie/7','/3/configuration']);
  assertEquals(requests[0].url.searchParams.get('language'),'en-US');
  assertEquals(requests.every(item=>item.authorization==='Bearer server-secret'),true);
  assertEquals(requests.every(item=>!item.url.toString().includes('server-secret')),true);
});

Deno.test('confirmed null poster skips Configuration and malformed Details cannot present',async()=>{
  clearConfigurationForTests();let calls=0;
  const none=await loadTmdbPresentation(7,{fetch:()=>{calls++;return response({id:7,title:'No Poster',
    release_date:'2001-02-03',poster_path:null});},token:'secret',baseUrl:'https://example.test/3'});
  assertEquals(none,{tmdbMovieId:7,title:'No Poster',releaseYear:2001,posterUrl:null});assertEquals(calls,1);
  for(const patch of [{id:8},{title:' '},{release_date:'2001-02-30'},{poster_path:'/../escape.jpg'}]){
    let rejected=false;try{await loadTmdbPresentation(7,{fetch:()=>response({id:7,title:'Title',
      release_date:'2001-02-03',poster_path:null,...patch}),token:'secret',baseUrl:'https://example.test/3'});}catch{rejected=true;}
    assertEquals(rejected,true);
  }
});

Deno.test('configured metric defects fail only when the retained rule consumes that metric', async () => {
  const base = { ...eligible, vote_count: 500, vote_average: 7.25, popularity: 12.5 };
  const complete = await searchTmdbCandidate(configured, { fetch: () => response(page(1, 1, [base])), token: 'secret', baseUrl: 'https://example.test/3' });
  assertEquals(complete.kind, 'match');
  const requiredMissing = await searchTmdbCandidate(configured, { fetch: () => response(page(1, 1, [{ ...base, vote_count: undefined }])), token: 'secret', baseUrl: 'https://example.test/3' });
  assertEquals(requiredMissing, { kind: 'search_incomplete', reason: 'required_metric' });
  const irrelevantMalformed = await searchTmdbCandidate(configured, { fetch: () => response(page(1, 1, [{ ...base, vote_average: 'not-a-number' }])), token: 'secret', baseUrl: 'https://example.test/3' });
  assertEquals(irrelevantMalformed.kind, 'match');
  const rating = { ...configured, ordering: 'average_rating_desc' as const };
  const ratingMissing = await searchTmdbCandidate(rating, { fetch: () => response(page(1, 1, [{ ...base, vote_average: null }])), token: 'secret', baseUrl: 'https://example.test/3' });
  assertEquals(ratingMissing, { kind: 'search_incomplete', reason: 'required_metric' });
  const popularity = { ...configured, ordering: 'popularity_desc' as const };
  const popularityMissing = await searchTmdbCandidate(popularity, { fetch: () => response(page(1, 1, [{ ...base, popularity: undefined }])), token: 'secret', baseUrl: 'https://example.test/3' });
  assertEquals(popularityMissing, { kind: 'search_incomplete', reason: 'required_metric' });
});

Deno.test('configured traversal compares every page and resolves deterministic primary ties by TMDB ID', async () => {
  const urls: number[] = [];
  const result = await searchTmdbCandidate(configured, { fetch: input => {
    const pageNumber = Number(new URL(String(input)).searchParams.get('page')); urls.push(pageNumber);
    return response({ page: pageNumber, total_pages: 2, total_results: 2,
      results: pageNumber === 1 ? [{ ...eligible, id: 22, vote_count: 900 }, { ...eligible, id: 18, vote_count: 900 }] : [] });
  }, token: 'secret', baseUrl: 'https://example.test/3' });
  assertEquals(result.kind, 'match');
  // Raw-result accounting still requires the declared page traversal.
  assertEquals(urls, [1, 2]);
  const winner = await searchTmdbCandidate(configured, { fetch: input => {
    const pageNumber = Number(new URL(String(input)).searchParams.get('page'));
    return response({ page: pageNumber, total_pages: 2, total_results: 2,
      results: pageNumber === 1 ? [{ ...eligible, id: 22, vote_count: 900 }] : [{ ...eligible, id: 18, vote_count: 900 }] });
  }, token: 'secret', baseUrl: 'https://example.test/3' });
  assertEquals(winner.kind === 'match' ? winner.movie.id : null, 18);
});

Deno.test('configured numeric broad search returns the old global winner before the 100-request budget', async () => {
  const totalPages = 120;
  const oldExhaustiveRequestCount = totalPages;
  let calls = 0;
  let elapsed = 0;
  const result = await searchTmdbCandidate({ ...configured, releaseYearFrom: 1955, releaseYearTo: 2020,
    clauses: [[18, 53], [18, 27, 53]] }, { fetch: input => {
    calls++;
    elapsed += 152.6;
    const current = Number(new URL(String(input)).searchParams.get('page'));
    return response({ page: current, total_pages: totalPages, total_results: totalPages,
      results: [{ ...eligible, id: 1_000 + current, genre_ids: [18, 53], release_date: '2000-01-01',
        vote_count: 10_001 - current }] });
  }, token: 'secret', baseUrl: 'https://example.test/3', maxRequests: 100,
    deadlineMs: 20_000, now: () => elapsed });
  assertEquals(oldExhaustiveRequestCount > 100, true);
  assertEquals(result.kind === 'match' ? result.movie.id : null, 1_001);
  assertEquals(calls, 2);
  assertEquals(Math.round(elapsed), 305);
});

Deno.test('configured numeric broad search continues past locally ineligible and excluded leaders', async () => {
  for (const first of [
    { ...eligible, id: 41, genre_ids: [18], vote_count: 1_000 },
    { ...eligible, id: 42, genre_ids: [28], vote_count: 1_000 },
  ]) {
    let calls = 0;
    const result = await searchTmdbCandidate({ ...configured, excludedTmdbMovieIds: first.id === 42 ? [42] : [] }, {
      fetch: input => {
        const current = Number(new URL(String(input)).searchParams.get('page'));
        calls++;
        return response({ page: current, total_pages: 2, total_results: 3,
          results: current === 1 ? [first] : [
            { ...eligible, id: 43, vote_count: 900 },
            { ...eligible, id: 44, genre_ids: [18], vote_count: 800 },
          ] });
      }, token: 'secret', baseUrl: 'https://example.test/3',
    });
    assertEquals(result.kind === 'match' ? result.movie.id : null, 43);
    assertEquals(calls, 2);
  }
});

Deno.test('configured numeric ties cross page boundaries before the TMDB-ID secondary winner is returned', async () => {
  let calls = 0;
  const result = await searchTmdbCandidate(configured, { fetch: input => {
    const current = Number(new URL(String(input)).searchParams.get('page'));
    calls++;
    return response({ page: current, total_pages: 3, total_results: 4,
      results: current === 1 ? [{ ...eligible, id: 22, vote_count: 900 }] : current === 2 ? [
        { ...eligible, id: 18, vote_count: 900 },
        { ...eligible, id: 17, genre_ids: [18], vote_count: 899 },
      ] : [{ ...eligible, id: 16, vote_count: 898 }] });
  }, token: 'secret', baseUrl: 'https://example.test/3' });
  assertEquals(result.kind === 'match' ? result.movie.id : null, 18);
  assertEquals(calls, 2);
});

Deno.test('configured numeric traversal survives a provider regression and reaches the third, fourth, then completed-empty step', async () => {
  const first = { ...eligible, id: 101, title: 'First', vote_count: 1_000 };
  const second = { ...eligible, id: 102, title: 'Second', vote_count: 900 };
  const third = { ...eligible, id: 103, title: 'Third', vote_count: 700 };
  const fourth = { ...eligible, id: 104, title: 'Fourth', vote_count: 600 };
  const provider = (excluded: readonly number[]) => searchTmdbCandidate(
    { ...configured, excludedTmdbMovieIds: excluded }, { fetch: input => {
      const pageNumber = Number(new URL(String(input)).searchParams.get('page'));
      return response({ page: pageNumber, total_pages: 2, total_results: 7, results: pageNumber === 1 ? [
        first, second, { ...eligible, id: 105, genre_ids: [18], vote_count: 850 },
      ] : [
        { ...eligible, id: 106, genre_ids: [18], vote_count: 800 },
        { ...eligible, id: 107, genre_ids: [18], vote_count: 801 },
        third, fourth,
      ] });
    }, token: 'secret', baseUrl: 'https://example.test/3' });

  const firstResult = await provider([]);
  assertEquals(firstResult.kind === 'match' ? firstResult.movie.id : null, first.id);
  const secondResult = await provider([first.id]);
  assertEquals(secondResult.kind === 'match' ? secondResult.movie.id : null, second.id);
  const thirdResult = await provider([first.id, second.id]);
  assertEquals(thirdResult.kind === 'match' ? thirdResult.movie.id : null, third.id);
  const fourthResult = await provider([first.id, second.id, third.id]);
  assertEquals(fourthResult.kind === 'match' ? fourthResult.movie.id : null, fourth.id);
  const emptyResult = await provider([first.id, second.id, third.id, fourth.id]);
  assertEquals(emptyResult, { kind: 'completed_empty' });
});

Deno.test('configured numeric equal-primary runs ignore provider ID order, exclusions, and duplicate rows', async () => {
  let evaluations = 0;
  const result = await searchTmdbCandidate({ ...configured, excludedTmdbMovieIds: [901] }, { fetch: input => {
    const pageNumber = Number(new URL(String(input)).searchParams.get('page'));
    return response({ page: pageNumber, total_pages: 2, total_results: 5, results: pageNumber === 1 ? [
      { ...eligible, id: 901, vote_count: 900 },
      { ...eligible, id: 902, vote_count: 900 },
      { ...eligible, id: 902, vote_count: 900 },
    ] : [
      { ...eligible, id: 899, vote_count: 900 },
      { ...eligible, id: 898, genre_ids: [18], vote_count: 899 },
    ] });
  }, token: 'secret', baseUrl: 'https://example.test/3', onMovieEvaluated: () => evaluations++ });
  assertEquals(result.kind === 'match' ? result.movie.id : null, 899);
  assertEquals(evaluations, 4);
});

Deno.test('provider-regression fallback covers every configured numeric ordering', async () => {
  for (const [ordering, high, low, regressed, winner] of [
    ['vote_count_desc', 1_000, 900, 801, 700],
    ['average_rating_desc', 9, 8, 7.1, 7],
    ['popularity_desc', 100, 90, 80.1, 80],
  ] as const) {
    const result = await searchTmdbCandidate({ ...configured, ordering, excludedTmdbMovieIds: [951, 952] }, { fetch: input => {
      const pageNumber = Number(new URL(String(input)).searchParams.get('page'));
      const row = (id: number, primary: number, genres = [28]) => ({ ...eligible, id, genre_ids: genres,
        vote_count: ordering === 'vote_count_desc' ? primary : 500,
        vote_average: ordering === 'average_rating_desc' ? primary : 7,
        popularity: ordering === 'popularity_desc' ? primary : 10,
      });
      return response({ page: pageNumber, total_pages: 2, total_results: 6, results: pageNumber === 1 ? [
      row(951, high), row(952, low), row(953, ordering === 'average_rating_desc' ? 7.5 : 850, [18]),
      ] : [row(954, ordering === 'vote_count_desc' ? 800 : ordering === 'average_rating_desc' ? 7.0 : 80, [18]),
        row(955, regressed, [18]), row(956, winner),
      ] });
    }, token: 'secret', baseUrl: 'https://example.test/3',
    });
    assertEquals(result.kind === 'match' ? result.movie.id : null, 956);
  }
});

Deno.test('a genuine numeric regression stays incomplete when the bounded traversal cannot prove a result', async () => {
  let calls = 0;
  const result = await searchTmdbCandidate(configured, { fetch: input => {
    calls++;
    const pageNumber = Number(new URL(String(input)).searchParams.get('page'));
    return response({ page: pageNumber, total_pages: 3, total_results: 3, results: pageNumber === 1 ? [
      { ...eligible, id: 801, genre_ids: [18], vote_count: 900 },
    ] : pageNumber === 2 ? [
      { ...eligible, id: 802, genre_ids: [18], vote_count: 800 },
      { ...eligible, id: 803, genre_ids: [18], vote_count: 801 },
    ] : [{ ...eligible, id: 804, vote_count: 700 }]
    });
  }, token: 'secret', baseUrl: 'https://example.test/3', maxRequests: 2 });
  assertEquals(result, { kind: 'search_incomplete', reason: 'request_budget' });
  assertEquals(calls, 2);
});

Deno.test('configured numeric proof defects remain incomplete while a complete empty range is exhaustive', async () => {
  const orderingDefect = await searchTmdbCandidate(configured, { fetch: () => response({
    page: 1, total_pages: 1, total_results: 2, results: [
      { ...eligible, id: 22, vote_count: 900 },
      { ...eligible, id: 18, vote_count: 901 },
    ],
  }), token: 'secret', baseUrl: 'https://example.test/3' });
  assertEquals(orderingDefect.kind, 'match');
  assertEquals(orderingDefect.kind === 'match' ? orderingDefect.movie.id : null, 18);

  const requiredDefect = await searchTmdbCandidate(configured, { fetch: input => {
    const current = Number(new URL(String(input)).searchParams.get('page'));
    return response({ page: current, total_pages: 2, total_results: 2,
      results: current === 1 ? [{ ...eligible, id: 22, vote_count: 900 }] :
        [{ ...eligible, id: 18, vote_count: null }] });
  }, token: 'secret', baseUrl: 'https://example.test/3' });
  assertEquals(requiredDefect, { kind: 'search_incomplete', reason: 'required_metric' });

  let failures = 0;
  const providerFailure = await searchTmdbCandidate(configured, { fetch: input => {
    const current = Number(new URL(String(input)).searchParams.get('page'));
    if (current === 2) { failures++; return response({}, 503); }
    return response({ page: 1, total_pages: 2, total_results: 2,
      results: [{ ...eligible, id: 22, vote_count: 900 }] });
  }, token: 'secret', baseUrl: 'https://example.test/3', sleep: async () => {}, random: () => 0 });
  assertEquals(providerFailure, { kind: 'search_incomplete', reason: 'upstream' });
  assertEquals(failures, 3);

  let emptyCalls = 0;
  const empty = await searchTmdbCandidate(configured, { fetch: input => {
    const current = Number(new URL(String(input)).searchParams.get('page'));
    emptyCalls++;
    return response({ page: current, total_pages: 3, total_results: 3,
      results: [{ ...eligible, id: 100 + current, genre_ids: [18], vote_count: 1_000 - current }] });
  }, token: 'secret', baseUrl: 'https://example.test/3' });
  assertEquals(empty, { kind: 'completed_empty' });
  assertEquals(emptyCalls, 3);
});

Deno.test('configured overflow uses the broad numeric winner fast path and shards only to prove empty', async () => {
  const winnerRanges: string[] = [];
  const winner = await searchTmdbCandidate(configured, { fetch: input => {
    const url = new URL(String(input));
    winnerRanges.push(`${url.searchParams.get('primary_release_date.gte')}/${url.searchParams.get('primary_release_date.lte')}`);
    return response({ page: 1, total_pages: 501, total_results: 10_001, results: [
      { ...eligible, id: 7, vote_count: 1_000 },
      { ...eligible, id: 8, genre_ids: [18], vote_count: 999 },
    ] });
  }, token: 'secret', baseUrl: 'https://example.test/3' });
  assertEquals(winner.kind === 'match' ? winner.movie.id : null, 7);
  assertEquals(winnerRanges, ['2000-01-01/2001-12-31']);

  const emptyRanges: string[] = [];
  const empty = await searchTmdbCandidate(configured, { fetch: input => {
    const url = new URL(String(input));
    const range = `${url.searchParams.get('primary_release_date.gte')}/${url.searchParams.get('primary_release_date.lte')}`;
    emptyRanges.push(range);
    const root = range === '2000-01-01/2001-12-31';
    return response({ page: 1, total_pages: root ? 501 : 1, total_results: root ? 10_001 : 1,
      results: root ? [{ ...eligible, id: 99, genre_ids: [18], vote_count: 1_000 }] :
        [{ ...eligible, id: emptyRanges.length + 100, genre_ids: [18], vote_count: 900 }] });
  }, token: 'secret', baseUrl: 'https://example.test/3' });
  assertEquals(empty, { kind: 'completed_empty' });
  assertEquals(emptyRanges, [
    '2000-01-01/2001-12-31',
    '2000-01-01/2000-12-31',
    '2001-01-01/2001-12-31',
  ]);
});

Deno.test('all configured ordering modes retain their exact winner and traversal proof', async () => {
  for (const [ordering, metric, high, low] of [
    ['vote_count_desc', 'vote_count', 900, 800],
    ['average_rating_desc', 'vote_average', 8.5, 8],
    ['popularity_desc', 'popularity', 20, 10],
  ] as const) {
    let calls = 0;
    const result = await searchTmdbCandidate({ ...configured, ordering }, { fetch: input => {
      const current = Number(new URL(String(input)).searchParams.get('page'));
      calls++;
      return response({ page: current, total_pages: 20, total_results: 21, results: current === 1 ? [
        { ...eligible, id: 52, vote_count: 900, vote_average: 8.5, popularity: 20, [metric]: high },
        { ...eligible, id: 53, vote_count: 800, vote_average: 8, popularity: 10, [metric]: low },
      ] : [{ ...eligible, id: 100 + current, vote_count: 700, vote_average: 7, popularity: 5 }] });
    }, token: 'secret', baseUrl: 'https://example.test/3' });
    assertEquals(result.kind === 'match' ? result.movie.id : null, 52);
    assertEquals(calls, 1);
  }

  let titleCalls = 0;
  const title = await searchTmdbCandidate({ ...configured, ordering: 'title_asc' }, { fetch: input => {
    const current = Number(new URL(String(input)).searchParams.get('page'));
    titleCalls++;
    return response({ page: current, total_pages: 2, total_results: 2, results: [
      { ...eligible, id: current, title: current === 1 ? 'Zulu' : 'Alpha', vote_count: 500 },
    ] });
  }, token: 'secret', baseUrl: 'https://example.test/3' });
  assertEquals(title.kind === 'match' ? title.movie.id : null, 2);
  assertEquals(titleCalls, 2);
});
