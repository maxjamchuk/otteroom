import { assert, assertEquals, assertFalse } from './assert.ts';
import { createRoomCandidateHandler, SERVER_RPC_NAMES } from '../room-candidate/index.ts';
import type { EdgeDependencies, RpcName } from '../_shared/candidate-contracts.ts';
import { eligibleMovie, parseDiscoverPage } from '../_shared/tmdb-eligibility.ts';

const roomId = '11111111-1111-4111-8111-111111111111';
const actorId = '22222222-2222-4222-8222-222222222222';
const movie = { id: 7, adult: false, genreIds: [28], title: 'Winner',
  releaseDate: '2000-01-01', posterPath: null };
const preflightRow = (value: Record<string, unknown>) => {
  const outcome=value.outcome;
  return { candidate_sequence: outcome==='acquire'||outcome==='no_candidates'?0:
      outcome==='assigned'||outcome==='exhausted'?1:null,
    candidate_progression_status: outcome==='acquire'||outcome==='no_candidates'?'inactive':
      outcome==='assigned'?'collecting':outcome==='exhausted'?'exhausted':null,
    tmdb_movie_id: null, release_year_from: null, release_year_to: null,
    genre_clauses_tmdb_ids: null, excluded_tmdb_movie_ids: outcome==='acquire'?[]:null, ...value };
};
const commitRow=(outcome:'assigned'|'no_candidates'|'exhausted',tmdb_movie_id:number|null)=>({
  outcome,candidate_sequence:outcome==='no_candidates'?0:1,
  candidate_progression_status:outcome==='assigned'?'collecting':
    outcome==='no_candidates'?'inactive':'exhausted',tmdb_movie_id});

function harness(preflight: Record<string, unknown>) {
  const calls: Array<{ name: RpcName; args: Record<string, unknown> }> = [];
  let searches = 0, details = 0;
  const deps: EdgeDependencies = {
    verifyJwt: async token => token === 'Bearer current' ? actorId : null,
    rpc: async (name, args) => { calls.push({ name, args });
      if (name === 'prepare_room_tmdb_candidate') return preflightRow(preflight);
      return commitRow('assigned',7);
    },
    search: async () => { searches++; return { kind: 'match', movie }; },
    details: async id => { details++; return { tmdbMovieId: id, title: 'Winner', releaseYear: 2000,
      posterUrl: null }; },
  };
  return { handler: createRoomCandidateHandler(deps), calls, counts: () => ({ searches, details }) };
}
const request = (body: unknown = { room_id: roomId }, authorization = 'Bearer current') => new Request('http://local/room-candidate', {
  method: 'POST', headers: { authorization, 'content-type': 'application/json' }, body: JSON.stringify(body),
});

Deno.test('server operation allowlist is exactly the three approved RPCs',()=>{
  assertEquals(SERVER_RPC_NAMES,['prepare_room_tmdb_candidate','commit_room_tmdb_candidate',
    'commit_room_tmdb_no_candidates']);
});

Deno.test('requires current JWT and exact one-key UUID body before preflight', async () => {
  for (const [body, auth] of [[{ room_id: roomId }, 'Bearer expired'], [{}, 'Bearer current'],
    [{ room_id: 'bad' }, 'Bearer current'], [{ room_id: roomId, actor_user_id: actorId }, 'Bearer current'],
    [{ room_id: roomId, clauses: [[28]] }, 'Bearer current'], [{ room_id: roomId, candidate_id: 7 }, 'Bearer current']] as const) {
    const h = harness({ outcome: 'not_ready' });
    const result = await h.handler(request(body, auth));
    assertEquals(result.status, auth === 'Bearer expired' ? 401 : 400);
    assertEquals(h.calls.length, 0); assertEquals(h.counts(), { searches: 0, details: 0 });
  }
});

Deno.test('preflight closes not-found/not-ready/no-candidates and assigned skips Discover', async () => {
  for (const outcome of ['not_found','not_ready','no_candidates'] as const) {
    const h = harness({ outcome }); const result = await h.handler(request());
    assertEquals(result.status, 200); assertEquals(await result.json(), { outcome });
    assertEquals(h.calls.map(call => call.name), ['prepare_room_tmdb_candidate']);
    assertEquals(h.counts(), { searches: 0, details: 0 });
  }
  const assigned = harness({ outcome: 'assigned', tmdb_movie_id: 7 });
  assertEquals(await (await assigned.handler(request())).json(), { outcome: 'available',
    candidate_sequence:1,candidate_progression_status:'collecting',candidate: {
    tmdb_movie_id: 7, title: 'Winner', release_year: 2000, poster_url: null } });
  assertEquals(assigned.counts(), { searches: 0, details: 1 });
});

Deno.test('compatible flow searches, commits before Details, and returns only CAS winner metadata', async () => {
  const h = harness({ outcome: 'acquire', release_year_from: 2000, release_year_to: 2020,
    genre_clauses_tmdb_ids: [[28]], tmdb_movie_id: null });
  const response = await h.handler(request());
  assertEquals(response.status, 200);
  assertEquals(h.calls.map(call => call.name), ['prepare_room_tmdb_candidate','commit_room_tmdb_candidate']);
  assertEquals(h.calls[1].args, { p_room_id: roomId, p_actor_user_id: actorId,
    p_expected_candidate_sequence:0,p_tmdb_movie_id: 7,p_release_year: 2000,
    p_tmdb_genre_ids: [28], p_adult: false });
  assertEquals(h.counts(), { searches: 1, details: 1 });
  const text = await response.text();
  assertFalse(/clause|filter|fixture|actor|poster_path|release_date|genre/i.test(text));
  assertEquals(JSON.parse(text), { outcome: 'available',candidate_sequence:1,
    candidate_progression_status:'collecting', candidate: { tmdb_movie_id: 7,
    title: 'Winner', release_year: 2000, poster_url: null } });
});

Deno.test('advancing preflight keeps sequence and ordered exclusions server-owned',async()=>{
  let observed:unknown;
  const calls:Array<{name:RpcName;args:Record<string,unknown>}>=[];
  const handler=createRoomCandidateHandler({verifyJwt:async()=>actorId,
    rpc:async(name,args)=>{calls.push({name,args});return name==='prepare_room_tmdb_candidate'
      ?preflightRow({outcome:'acquire',candidate_sequence:3,candidate_progression_status:'advancing',
        release_year_from:2000,release_year_to:2020,genre_clauses_tmdb_ids:[[28]],
        excluded_tmdb_movie_ids:[7,8,9]})
      :{outcome:'assigned',candidate_sequence:4,candidate_progression_status:'collecting',
        tmdb_movie_id:10};},
    search:async constraint=>{observed=constraint.excludedTmdbMovieIds;return{kind:'match',
      movie:{...movie,id:10}};},details:async id=>({tmdbMovieId:id,title:'Next',releaseYear:2000,
      posterUrl:null})});
  const body=await(await handler(request())).json();
  assertEquals(observed,[7,8,9]);
  assertEquals(calls[1].args.p_expected_candidate_sequence,3);
  assertEquals(body.candidate_sequence,4);
});

Deno.test('unsorted TMDB genres are canonical through exact eligibility and candidate commit', async () => {
  const constraint = { releaseYearFrom: 2000, releaseYearTo: 2020,
    clauses: [[16], [12,14]] as number[][] };
  const parsedMovie = parseDiscoverPage({ page: 1, total_pages: 1, total_results: 1, results: [{
    id: 7, adult: false, genre_ids: [16,10751,12,14,16], title: 'Winner',
    release_date: '2000-01-01', poster_path: null,
  }] }, 1).results[0];
  assertEquals(parsedMovie.genreIds, [12,14,16,10751]);
  assert(eligibleMovie(parsedMovie, constraint));

  const calls: Array<{ name: RpcName; args: Record<string, unknown> }> = [];
  const handler = createRoomCandidateHandler({
    verifyJwt: async () => actorId,
    rpc: async (name, args) => {
      calls.push({ name, args });
      return name === 'prepare_room_tmdb_candidate'
        ? preflightRow({ outcome: 'acquire', release_year_from: constraint.releaseYearFrom,
            release_year_to: constraint.releaseYearTo, genre_clauses_tmdb_ids: constraint.clauses })
        : commitRow('assigned',parsedMovie.id);
    },
    search: async value => {
      assert(eligibleMovie(parsedMovie, value));
      return { kind: 'match', movie: parsedMovie };
    },
    details: async id => ({ tmdbMovieId: id, title: 'Winner', releaseYear: 2000, posterUrl: null }),
  });

  assertEquals((await handler(request())).status, 200);
  assertEquals(calls[1], { name: 'commit_room_tmdb_candidate', args: {
    p_room_id: roomId, p_actor_user_id: actorId,p_expected_candidate_sequence:0,p_tmdb_movie_id: 7,
    p_release_year: 2000, p_tmdb_genre_ids: [12,14,16,10751], p_adult: false,
  } });
});

Deno.test('responsive controlled provider completes at least 95 of 100 minimum presentations under ten seconds', async () => {
  let within = 0;
  for (let index = 0; index < 100; index++) {
    const h = harness({ outcome: 'acquire', release_year_from: 2000, release_year_to: 2020,
      genre_clauses_tmdb_ids: [[28]], tmdb_movie_id: null });
    const start = performance.now();
    const response = await h.handler(request());
    if (response.status === 200 && performance.now() - start < 10_000 &&
        (await response.json()).outcome === 'available') within++;
  }
  assertEquals(within >= 95, true);
});

Deno.test('different concurrent proposals both adopt the one CAS winner', async () => {
  let proposal = 0, winner: number | null = null;
  const entered: Array<() => void> = [];
  let release!: () => void; const barrier = new Promise<void>(resolve => { release = resolve; });
  const deps: EdgeDependencies = {
    verifyJwt: async () => actorId,
    rpc: async (name, args) => {
      if (name === 'prepare_room_tmdb_candidate') return preflightRow({ outcome: 'acquire', release_year_from: 2000,
        release_year_to: 2020, genre_clauses_tmdb_ids: [[28]] });
      entered.push(release); if (entered.length === 2) release(); await barrier;
      winner ??= args.p_tmdb_movie_id as number;
      return commitRow('assigned',winner);
    },
    search: async () => { const id = ++proposal; return { kind: 'match', movie: { ...movie, id } }; },
    details: async id => ({ tmdbMovieId: id, title: `Winner ${id}`, releaseYear: 2000, posterUrl: null }),
  };
  const handler = createRoomCandidateHandler(deps);
  const responses = await Promise.all([handler(request()),handler(request())]);
  const bodies = await Promise.all(responses.map(response => response.json()));
  assertEquals(bodies[0].candidate.tmdb_movie_id, winner);
  assertEquals(bodies[1].candidate.tmdb_movie_id, winner);
});

Deno.test('completed-empty loser adopts assigned winner and never exposes empty', async () => {
  const h = harness({ outcome: 'acquire', release_year_from: 2000, release_year_to: 2020,
    genre_clauses_tmdb_ids: [[28]], tmdb_movie_id: null });
  const custom: EdgeDependencies = { ...({} as EdgeDependencies),
    verifyJwt: async () => actorId,
    rpc: async name => name === 'prepare_room_tmdb_candidate'
      ? preflightRow({ outcome: 'acquire', release_year_from: 2000, release_year_to: 2020,
          genre_clauses_tmdb_ids: [[28]] })
      : commitRow('assigned',19),
    search: async () => ({ kind: 'completed_empty' }),
    details: async id => ({ tmdbMovieId: id, title: 'Stored Winner', releaseYear: 2004, posterUrl: null }),
  };
  const body = await (await createRoomCandidateHandler(custom)(request())).json();
  assertEquals(body, { outcome: 'available',candidate_sequence:1,
    candidate_progression_status:'collecting', candidate: { tmdb_movie_id: 19,
    title: 'Stored Winner', release_year: 2004, poster_url: null } });
  assertEquals(h.counts(), { searches: 0, details: 0 });
});

Deno.test('lost assignment response recovers the committed ID by preflight and Details only', async () => {
  let committed = false, searches = 0, details = 0;
  const deps: EdgeDependencies = {
    verifyJwt: async () => actorId,
    rpc: async name => {
      if (name === 'prepare_room_tmdb_candidate') return committed
        ? preflightRow({ outcome: 'assigned', tmdb_movie_id: 7 })
        : preflightRow({ outcome: 'acquire', release_year_from: 2000, release_year_to: 2020,
            genre_clauses_tmdb_ids: [[28]] });
      committed = true; throw new Error('response lost');
    },
    search: async () => { searches++; return { kind: 'match', movie }; },
    details: async id => { details++; return { tmdbMovieId: id, title: 'Winner', releaseYear: 2000, posterUrl: null }; },
  };
  const handler = createRoomCandidateHandler(deps);
  assertEquals((await handler(request())).status, 503);
  assertEquals(await (await handler(request())).json(), { outcome: 'available',candidate_sequence:1,
    candidate_progression_status:'collecting', candidate: {
    tmdb_movie_id: 7, title: 'Winner', release_year: 2000, poster_url: null } });
  assertEquals({ searches, details }, { searches: 1, details: 1 });
});

Deno.test('search incomplete is a fixed non-success and performs no terminal commit',async()=>{
  const names:RpcName[]=[];
  const handler=createRoomCandidateHandler({verifyJwt:async()=>actorId,
    rpc:async(name)=>{names.push(name);return preflightRow({outcome:'acquire',candidate_sequence:1,
      candidate_progression_status:'advancing',release_year_from:2000,
      release_year_to:2020,genre_clauses_tmdb_ids:[[28]],excluded_tmdb_movie_ids:[7]});},
    search:async()=>({kind:'search_incomplete',reason:'timeout'}),
    details:async()=>{throw new Error('must not run');}});
  const result=await handler(request());assertEquals(result.status,503);
  assertEquals(await result.json(),{error:'candidate_acquisition_unavailable'});
  assertEquals(names,['prepare_room_tmdb_candidate']);
});

Deno.test('fully completed empty alone invokes empty CAS and adopts either terminal',async()=>{
  for(const winner of [commitRow('no_candidates',null),commitRow('assigned',7)]){
    const names:RpcName[]=[];let details=0;
    const handler=createRoomCandidateHandler({verifyJwt:async()=>actorId,
      rpc:async(name)=>{names.push(name);return name==='prepare_room_tmdb_candidate'
        ? preflightRow({outcome:'acquire',release_year_from:2000,release_year_to:2020,
            genre_clauses_tmdb_ids:[[28]]}):winner;},
      search:async()=>({kind:'completed_empty'}),details:async id=>{details++;return{
        tmdbMovieId:id,title:'Stored Winner',releaseYear:2000,posterUrl:null};}});
    const response=await handler(request());assertEquals(response.status,200);
    assertEquals(names,['prepare_room_tmdb_candidate','commit_room_tmdb_no_candidates']);
    assertEquals(details,winner.outcome==='assigned'?1:0);
    assertEquals((await response.json()).outcome,winner.outcome==='assigned'?'available':'no_candidates');
  }
});

Deno.test('metadata failure after assignment preserves terminal and next request never Discovers',async()=>{
  let searches=0,details=0;
  const handler=createRoomCandidateHandler({verifyJwt:async()=>actorId,
    rpc:async()=>preflightRow({outcome:'assigned',tmdb_movie_id:7}),
    search:async()=>{searches++;return{kind:'completed_empty'};},
    details:async()=>{details++;throw new Error('upstream');}});
  for(let index=0;index<2;index++)assertEquals(await(await handler(request())).json(),
    {outcome:'metadata_unavailable',candidate_sequence:1,
      candidate_progression_status:'collecting'});
  assertEquals({searches,details},{searches:0,details:2});
});

Deno.test('foreign-room masking returns field-free not-found with zero TMDB traffic',async()=>{
  const h=harness({outcome:'not_found',tmdb_movie_id:null,release_year_from:null,
    release_year_to:null,genre_clauses_tmdb_ids:null});
  const result=await h.handler(request());assertEquals(await result.json(),{outcome:'not_found'});
  assertEquals(h.counts(),{searches:0,details:0});
});

Deno.test('safe errors and logs cannot echo injected credentials, identities, constraints or upstream data',async()=>{
  const sentinel='synthetic-secret-value';const logs:unknown[]=[];
  const handler=createRoomCandidateHandler({verifyJwt:async()=>actorId,
    rpc:async()=>{throw new Error(`${sentinel}:${roomId}:genre_clauses`);},
    search:async()=>{throw new Error(sentinel);},details:async()=>{throw new Error(sentinel);},
    log:(...values)=>logs.push(values)});
  const response=await handler(request());const text=await response.text();
  assertEquals(response.status,503);assertFalse(text.includes(sentinel));assertFalse(text.includes(roomId));
  assertFalse(JSON.stringify(logs).includes(sentinel));assertFalse(JSON.stringify(logs).includes(roomId));
});

Deno.test('invalid injected Details data cannot escape the response boundary',async()=>{
  const sentinel='synthetic-private-upstream-payload';
  const handler=createRoomCandidateHandler({verifyJwt:async()=>actorId,
    rpc:async()=>preflightRow({outcome:'assigned',tmdb_movie_id:7}),search:async()=>({kind:'completed_empty'}),
    details:async()=>({tmdbMovieId:7,title:sentinel,releaseYear:1,posterUrl:`http://${sentinel}.invalid/a`})});
  const response=await handler(request());const text=await response.text();
  assertEquals(JSON.parse(text),{outcome:'metadata_unavailable',candidate_sequence:1,
    candidate_progression_status:'collecting'});assertFalse(text.includes(sentinel));
});
