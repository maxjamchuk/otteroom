import { assertEquals, assertFalse } from './assert.ts';
import { clearConfigurationForTests, loadTmdbPresentation, searchTmdbCandidate } from '../_shared/tmdb-client.ts';
import type { FetchLike } from '../_shared/candidate-contracts.ts';

const context = { releaseYearFrom: 2000, releaseYearTo: 2001, clauses: [[28]] as number[][] };
const eligible = { id: 7, adult: false, genre_ids: [28], title: 'Winner',
  release_date: '2000-01-01', poster_path: null };
const response = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers }));
const page = (number: number, pages: number, results: unknown[] = []) =>
  ({ page: number, total_pages: pages, total_results: results.length, results });

Deno.test('search traverses pages ascending and short-circuits on first exact match', async () => {
  const urls: URL[] = [];
  const fetch: FetchLike = (input) => { const url = new URL(String(input)); urls.push(url);
    return response(page(Number(url.searchParams.get('page')), 3,
      url.searchParams.get('page') === '2' ? [eligible] : [{ ...eligible, id: 8, genre_ids: [18] }])); };
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
  assertEquals(transport.kind,'search_incomplete');
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
