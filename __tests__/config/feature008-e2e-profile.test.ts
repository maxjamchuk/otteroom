/** @jest-environment node */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { acceptedDecisionState, acceptedDecisionViewSatisfied,
  type OwnDecisionResult } from '../../e2e/support/decision-harness';
import { applyRoomRefetch, type AcceptedRoomState } from '../../src/rooms/state';
import type { RoomProjection } from '../../src/rooms/service';

jest.mock('../../e2e/support/room-harness', () => ({
  committedRoomSnapshot: jest.fn(),
  realtimeBarrier: jest.fn(),
}));
jest.mock('../../scripts/local-supabase.mjs', () => ({
  localSupabaseContainer: () => 'synthetic-local-database',
}));

const verify = (source: string, transformTypes = false) => {
  const result = spawnSync(process.execPath, [...(transformTypes
    ? ['--disable-warning=ExperimentalWarning', '--experimental-transform-types'] : []),
    '--input-type=module', '-e', source], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 15000, maxBuffer: 65536,
  });
  expect({ status: result.status, signal: result.signal, stderr: result.stderr })
    .toEqual({ status: 0, signal: null, stderr: '' });
};

it('locks Feature 008 to exact L01=2 L02=4 owner receipts', () => {
  verify(`import assert from 'node:assert/strict';
    import {parseInvocation,playwrightArguments,verifyAcceptanceProfile} from './scripts/run-e2e.mjs';
    const receipt=(browserCase,identities)=>({browserCase,signups:identities,identities,
      status:'passed',cleanup:true,authSuccess:true,budgetFailure:false});
    const complete=[receipt('L01',2),receipt('L02',4)];
    assert.deepEqual(parseInvocation(['feature008']),{mode:'acceptance',profile:'feature008',
      staticOnly:false,forwarded:['--grep','@feature008']});
    assert.deepEqual(playwrightArguments(parseInvocation(['feature008'])),['test','--config',
      'playwright.config.ts','--project','acceptance','--max-failures','1','--grep','@feature008']);
    assert.equal(playwrightArguments(parseInvocation(['smoke'])).includes('--max-failures'),false);
    assert.equal(verifyAcceptanceProfile('feature008',complete),true);
    assert.equal(complete.reduce((sum,item)=>sum+item.identities,0),6);
    for(const changed of [{cleanup:false},{authSuccess:false},{budgetFailure:true},{status:'failed'},
      {signups:3},{identities:3}])assert.equal(verifyAcceptanceProfile('feature008',
        complete.map((item,index)=>index?item:{...item,...changed})),false);
    assert.equal(verifyAcceptanceProfile('feature008',complete.slice(1)),false);
    assert.equal(verifyAcceptanceProfile('l01',[receipt('L01',2)]),true);
    assert.equal(verifyAcceptanceProfile('l02',[receipt('L02',4)]),true);`);
  expect(JSON.parse(fs.readFileSync('package.json','utf8')).scripts['test:e2e:feature008'])
    .toBe('node scripts/run-e2e.mjs feature008');
});

it('rejects profile, identity, provider, credential, retry, and worker overrides', () => {
  verify(`import assert from 'node:assert/strict';
    import {parseInvocation,validateInvocationEnvironment} from './scripts/run-e2e.mjs';
    for(const args of [['feature008','--workers','2'],['feature008','--grep','L01'],
      ['feature008','--repeat-each','2'],['acceptance','--grep','@feature008','--workers','2'],
      ['acceptance','--grep','L01','--repeat-each','2']])assert.throws(()=>parseInvocation(args));
    for(const name of ['OTTEROOM_TMDB_STUB_CONTROL_URL','OTTEROOM_E2E_IDENTITY',
      'TMDB_API_BASE_URL','TMDB_API_READ_ACCESS_TOKEN','SUPABASE_SERVICE_ROLE_KEY'])
      assert.throws(()=>validateInvocationEnvironment({[name]:'synthetic'}));`);
});

it('discovers exactly two additive Feature 008 cases and projects safe receipts', () => {
  verify(`import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
    import {safeResult} from './e2e/support/safe-reporter.ts';
    const source=fs.readFileSync('e2e/candidate-progression.spec.ts','utf8');
    const ast=ts.createSourceFile('candidate-progression.spec.ts',source,ts.ScriptTarget.Latest,true);
    const titles=[];const walk=node=>{if(ts.isCallExpression(node)&&node.expression.getText(ast)==='test'&&
      ts.isStringLiteral(node.arguments[0]))titles.push(node.arguments[0].text);ts.forEachChild(node,walk)};walk(ast);
    assert.deepEqual(titles,['@feature008 L01 exact-two candidate progression lifecycle',
      '@feature008 L02 creator and larger-group candidate progression convergence']);
    const first=safeResult({title:titles[0],repeatEachIndex:0},{status:'passed',parallelIndex:0,
      annotations:[{type:'safe-signups',description:'2'},{type:'safe-identities',description:'2'}]});
    const second=safeResult({title:titles[1],repeatEachIndex:0},{status:'passed',parallelIndex:0,
      annotations:[{type:'safe-signups',description:'4'},{type:'safe-identities',description:'4'}]});
    assert.deepEqual([first.scenario,first.browserCase,second.scenario,second.browserCase],
      ['progression','L01','progression','L02']);
    assert.equal(/room_id|member_id|tmdb_movie_id|candidate_occurrence/i.test(JSON.stringify([first,second])),false);`);
});

it('locks execution and accounting formulas without executing a browser', () => {
  const config = fs.readFileSync('playwright.config.ts','utf8');
  expect(config).toMatch(/candidate-progression\.spec\.ts/);
  expect(config).toMatch(/workers:\s*1/);
  expect(config).toMatch(/retries:\s*0/);
  expect(config).toMatch(/repeatEach:\s*1/);
  for (const field of ['trace','video','screenshot']) expect(config).toMatch(new RegExp(`${field}:\\s*'off'`));
  const docs = fs.readFileSync('docs/testing-strategy.md','utf8');
  for (const formula of ['1 + 16 + 6 = 23','16 + 6 = 22','23 + 22 = 45','1 + 16 = 17',
    '1 + 106 = 107','1 + 112 = 113']) expect(docs).toContain(formula);
  expect(docs).toMatch(/L01 \(2 identities\).*L02 \(4 identities\)/s);
});

it('keeps L03 and four-voter coverage embedded in their owner cases', () => {
  const source = fs.readFileSync('e2e/candidate-progression.spec.ts','utf8');
  expect(source.match(/@feature008 L0[12]/g)).toHaveLength(2);
  expect(source).not.toMatch(/@feature008 L03/);
  expect(source).toMatch(/requiredVoterCount: 4, creatorIsVoter: true/);
  expect(source).toMatch(/timeout/);
  expect(source).toMatch(/exhausted/);
  expect(source).toMatch(/candidates\.discardNextResponse\(1\)/);
  expect(source).toMatch(/installFinalDecisionHold/);
});

it('keeps initial-empty and exhausted candidate assertions state-specific', () => {
  verify(`import assert from 'node:assert/strict';
    import {candidateTerminalExpectation} from './e2e/support/candidate-harness.ts';
    const initial={candidate_acquisition_status:'no_candidates',candidate_progression_status:'inactive',
      candidate_sequence:0,decision_completed_count:0};
    const exhausted={candidate_acquisition_status:'no_candidates',candidate_progression_status:'exhausted',
      candidate_sequence:3,decision_completed_count:0};
    assert.deepEqual(candidateTerminalExpectation(initial),{kind:'initial-empty',
      copy:'No eligible movie was observed during the completed search.'});
    assert.deepEqual(candidateTerminalExpectation(exhausted),{kind:'exhausted',
      copy:'No further eligible movies were found for this selection.'});
    for(const invalid of [{...initial,candidate_sequence:1},
      {...initial,candidate_progression_status:'exhausted'},
      {...exhausted,candidate_sequence:0},
      {...exhausted,candidate_progression_status:'advancing'},
      {...exhausted,candidate_acquisition_status:'pending'}])
      assert.throws(()=>candidateTerminalExpectation(invalid));`);
  const harness = fs.readFileSync('e2e/support/candidate-harness.ts','utf8');
  expect(harness).toMatch(/async noCandidates.*const expected = 'initial-empty'.*candidateTerminalExpectation/s);
  expect(harness).toMatch(/async exhausted.*const expected = 'exhausted'.*candidateTerminalExpectation/s);
  expect(fs.readFileSync('e2e/tmdb-candidate-source.spec.ts','utf8')).toMatch(/candidates\.noCandidates\(\)/);
  expect(fs.readFileSync('e2e/candidate-progression.spec.ts','utf8')).toMatch(/candidates\.exhausted\(\)/);
});

it('keeps convergence, foreign-JWT preflight, and case fail-fast deterministic', () => {
  const harness = fs.readFileSync('e2e/support/progression-harness.ts','utf8');
  const cases = fs.readFileSync('e2e/candidate-progression.spec.ts','utf8');
  const runner = fs.readFileSync('scripts/run-e2e.mjs','utf8');
  expect(harness).toMatch(/getByTestId\('candidate-progression-status'\)\)\.toHaveText\(text/);
  expect(harness).not.toMatch(/getByText\(\/\\d\+ of \\d\+ decisions collected/);
  expect(cases).toMatch(/p_expected_tmdb_movie_id: tmdbMovieId/);
  expect(cases).toMatch(/roomId: room\.id, tmdbMovieId: controlledCandidate\.tmdbMovieId/);
  expect(runner).toMatch(/\['feature008', 'feature009'\].*'--max-failures', '1'/s);
});

it('places response validation at each L01 navigation boundary that can retire a candidate document', () => {
  const cases = fs.readFileSync('e2e/candidate-progression.spec.ts','utf8');
  const candidates = fs.readFileSync('e2e/support/candidate-harness.ts','utf8');
  const rooms = fs.readFileSync('e2e/support/room-harness.ts','utf8');
  const progression = fs.readFileSync('e2e/support/progression-harness.ts','utf8');
  const roomRoute = fs.readFileSync('app/room/[code].tsx','utf8');
  const homeRoute = fs.readFileSync('app/index.tsx','utf8');
  const diagnostics = fs.readFileSync('e2e/support/safe-diagnostics.ts','utf8');
  expect(cases).toMatch(/createWaitingWithSession\(host\.page, host, api!, previous, configuration, candidates\)/);
  expect(cases).not.toMatch(/if \(previous\) await candidates\.drainResponses\(\)/);
  expect(rooms).toMatch(/const participant = await ownParticipant\(page\);\s*const home = \(\) => page\.goto\('\/'\);\s*expect\(\(await \(responses \? navigateAfterResponseValidation\(responses, \[page\], home\) : home\(\)\)\)/s);
  expect(progression).toMatch(/navigateAfterResponseValidation\(candidateResponses, \[page as Page\], \(\) => page\.goto\(invitation\)\)/);
  expect(progression).toMatch(/reloadPagesAfterCandidateResponses[\s\S]*navigateAfterResponseValidation\(candidateResponses, pages as Page\[\], \(\) =>[\s\S]*page\.reload\(\{ waitUntil: 'domcontentloaded' \}\)/);
  expect(cases.match(/reloadPagesAfterCandidateResponses\(candidates, pages\)/g))
    .toHaveLength(3);
  expect(cases).not.toMatch(/\.goto\(|\.reload\(/);
  expect(candidates).toMatch(/Promise\.allSettled\(\[\.\.\.requestSettlements\.values\(\), \.\.\.pending\]\)/);
  expect(candidates).toMatch(/requestSettlements\.size > 0 \|\| pending\.size > 0/);
  expect(rooms).toMatch(/responses\.replaceDocuments\(pages, navigate\)/);
  expect(candidates).toMatch(/async replaceDocuments<T>\(pages[\s\S]*phase: 'draining'[\s\S]*phase = 'navigating'/);
  expect(candidates).toMatch(/requestEpoch\+\+[\s\S]*requestEpoch !== observedEpoch/);
  expect(candidates).toMatch(/replacement\?\.phase === 'navigating'[\s\S]*intentionallyConsumed\.add\(request\)[\s\S]*route\.abort\('aborted'\)/);
  expect(rooms).toMatch(/export async function startHost[\s\S]*page\.goto\('\/'\)/);
  expect(cases).toMatch(/const candidates = await candidateHarness[\s\S]*await startHost\(voter\.page, voter\)[\s\S]*await assemble/);
  expect(cases).toMatch(/const created = previous[\s\S]*createWaitingWithSession[\s\S]*for \(let index = 0; index < participants\.length; index\+\+\)[\s\S]*await admit/);
  expect(homeRoute).toMatch(/const result = await createRoom[\s\S]*router\.replace\(`\/room\/\$\{result\.room_code\}`\)/);
  expect(homeRoute).not.toMatch(/useRoomCandidate|room-candidate/);
  expect(roomRoute).toMatch(/if \(!replace \|\| !path\) return[\s\S]*router\.replace\(path\)/);
  expect(roomRoute).toMatch(/replace \? <Text[\s\S]*: <RoomEntry/);
  expect(cases).not.toMatch(/Create a new room.*click|Back to home.*click/s);
  expect(cases).toMatch(/finally \{ await candidates\.close\(\); \}/);
  expect(diagnostics).toMatch(/await page\.goto\('about:blank'\)/);
});

it('keeps G04 aggregate recovery on the real controlled provider path', () => {
  verify(`import assert from 'node:assert/strict';
    import {createRoomCandidateHandler} from './supabase/functions/room-candidate/index.ts';
    import {loadTmdbPresentation,searchTmdbCandidate} from './supabase/functions/_shared/tmdb-client.ts';
    import {startTmdbStub} from './e2e/support/tmdb-stub.ts';
    const token='controlled-provider-token';const stub=await startTmdbStub(token);
    try{
      const baseUrl=stub.edgeBaseUrl.replace('host.docker.internal','127.0.0.1');
      const common={fetch,token,baseUrl};
      const handler=createRoomCandidateHandler({verifyJwt:async()=>
        '22222222-2222-4222-8222-222222222222',rpc:async name=>name==='prepare_room_tmdb_candidate'
          ?{outcome:'acquire',candidate_sequence:0,candidate_progression_status:'inactive',
            tmdb_movie_id:null,release_year_from:2000,release_year_to:2010,
            genre_clauses_tmdb_ids:[[18]],excluded_tmdb_movie_ids:[],rule_set_kind:'configured_009_v1',
            candidate_ordering:'vote_count_desc',minimum_vote_count:500,minimum_average_rating:null,
            metadata_language:'en-US',genre_mode:'or'}
          :{outcome:'assigned',candidate_sequence:1,candidate_progression_status:'collecting',
            tmdb_movie_id:6006},search:value=>searchTmdbCandidate(value,common),
        details:id=>loadTmdbPresentation(id,common)});
      const response=await handler(new Request('http://local/room-candidate',{method:'POST',
        headers:{authorization:'Bearer current','content-type':'application/json'},
        body:JSON.stringify({room_id:'11111111-1111-4111-8111-111111111111'})}));
      assert.equal(response.status,200);assert.equal((await response.json()).outcome,'available');
      const provider=await(await fetch(stub.controlUrl)).json();
      assert.deepEqual(provider.calls,{discover:1,details:1,configuration:1,poster:0});
      assert.equal(provider.invalid,0);assert.deepEqual(provider.provider,
        {requests:3,completed:3,active:0});
      assert.equal(Object.values(provider.calls).every(count=>count===0),false);
    }finally{await stub.close();}`, true);
  const source = fs.readFileSync('e2e/generalized-room-membership-qr.spec.ts', 'utf8');
  const g04 = source.slice(source.indexOf("test('@membership G04"),
    source.indexOf("test('@membership G05"));
  expect(g04).not.toMatch(/Object\.values\(provider\.calls\)\.every\(count=>count===0\)/);
  expect(g04).toMatch(/candidate_progression_status==='agreed'/);
  expect(g04).toMatch(/candidate_sequence===1/);
  expect(g04).toMatch(/provider\.calls\.details>=1/);
  expect(g04).toMatch(/provider\.calls\.configuration===provider\.calls\.details/);
  expect(g04).toMatch(/provider\.provider\.completed===provider\.provider\.requests/);
});

it('accepts one keyboard decision through acknowledgement or legal progression supersession', () => {
  const result = (overrides: Partial<OwnDecisionResult> = {}): OwnDecisionResult => ({
    outcome: 'accepted', my_decision: 'yes', candidate_sequence: 1,
    decision_completed_count: 1, required_voter_count: 2, decision_set_complete: false,
    agreement_threshold: 2, candidate_outcome: 'collecting',
    candidate_progression_status: 'collecting', ...overrides,
  });
  const ordinary = acceptedDecisionState(result(), 'yes');
  expect(ordinary).toBe('acknowledgement');
  expect(acceptedDecisionViewSatisfied(ordinary, true, '0 of 2 decisions collected.',
    '1 of 2 decisions collected.', 2)).toBe(true);
  expect(acceptedDecisionViewSatisfied(ordinary, false, '0 of 2 decisions collected.',
    '1 of 2 decisions collected.', 2)).toBe(false);

  const room: AcceptedRoomState = { kind: 'accepted', id: 'room', code: 'ROOM',
    isCreator: false, isVoter: true, state: 'ready', title: 'Ready', voterCount: 3,
    requiredVoterCount: 3, filterCompletedCount: 3, filtersComplete: true,
    filterResolutionStatus: 'compatible', resolutionIntegrityError: false,
    candidateAcquisitionStatus: 'assigned', candidateProgressionStatus: 'collecting',
    candidateSequence: 1, candidateIntegrityError: false, decisionCompletedCount: 1 };
  const row = (candidate_progression_status: RoomProjection['candidate_progression_status'],
    candidate_sequence: number, decision_completed_count: number,
    candidate_acquisition_status: RoomProjection['candidate_acquisition_status']): RoomProjection => ({
      id: 'room', code: 'ROOM', state: 'ready', voter_count: 3, required_voter_count: 3,
      filter_completed_count: 3, filter_resolution_status: 'compatible',
      candidate_acquisition_status, candidate_progression_status, candidate_sequence,
      decision_completed_count,
    });
  const two = applyRoomRefetch(room, row('collecting', 1, 2, 'assigned'));
  const advancingRoom = applyRoomRefetch(two, row('advancing', 1, 0, 'pending'));
  const successor = applyRoomRefetch(advancingRoom, row('collecting', 2, 0, 'assigned'));
  const concurrentNonFinal = acceptedDecisionState(result({ my_decision: 'no',
    decision_completed_count: 2, required_voter_count: 3, agreement_threshold: 2 }), 'no');
  const successorView = `${successor.decisionCompletedCount} of ${successor.requiredVoterCount} decisions collected.`;
  expect(successor).toMatchObject({ candidateSequence: 2, decisionCompletedCount: 0 });
  expect(acceptedDecisionViewSatisfied(concurrentNonFinal, false,
    '1 of 3 decisions collected.', successorView, 3)).toBe(true);

  const agreed = acceptedDecisionState(result({ decision_completed_count: 2,
    decision_set_complete: true, candidate_outcome: 'agreed',
    candidate_progression_status: 'agreed' }), 'yes');
  expect(acceptedDecisionViewSatisfied(agreed, false, '1 of 2 decisions collected.',
    'Group agreement reached. Candidate selection has stopped.', 2)).toBe(true);
  const advancing = acceptedDecisionState(result({ decision_completed_count: 2,
    decision_set_complete: true, candidate_outcome: 'rejected',
    candidate_progression_status: 'advancing' }), 'yes');
  for (const view of ['The group did not agree. Finding another movie.',
    'No further eligible movies were found for this selection.', '0 of 2 decisions collected.'])
    expect(acceptedDecisionViewSatisfied(advancing, false,
      '1 of 2 decisions collected.', view, 2)).toBe(true);
  expect(acceptedDecisionViewSatisfied(advancing, false, '1 of 2 decisions collected.',
    '1 of 2 decisions collected.', 2)).toBe(false);
  expect(() => acceptedDecisionState(result({ outcome: 'unchanged' }), 'yes')).toThrow();
  expect(() => acceptedDecisionState(result(), 'no')).toThrow();
  const harness = fs.readFileSync('e2e/support/decision-harness.ts','utf8');
  const helper = harness.slice(harness.indexOf('export async function keyboardDecision'),
    harness.indexOf('export async function touchSwipeDecision'));
  expect(helper).toMatch(/waitForResponse/);
  expect(helper).toMatch(/button\.press\('Enter'\)/);
  expect(helper).toMatch(/expect\(submissions\)\.toBe\(1\)/);
  expect(helper).toMatch(/timeout: 5000/);
  expect(helper).not.toContain('button.focus()');
  expect(helper).not.toContain("page.keyboard.press('Enter')");
});

it('rejects progression-private finalized artifacts', () => {
  const scanner = fs.readFileSync('scripts/check-e2e-artifacts.mjs','utf8');
  for (const token of ['room_candidate_occurrences','candidate_occurrence_id','excluded_tmdb_movie_ids',
    'raw_(?:progression|decision|rpc)_payload','internal_tmdb_id']) expect(scanner).toContain(token);
});
