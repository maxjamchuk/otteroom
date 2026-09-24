/** @jest-environment node */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const verify = (source: string) => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 15000, maxBuffer: 65536,
  });
  expect({ status: result.status, signal: result.signal, stderr: result.stderr })
    .toEqual({ status: 0, signal: null, stderr: '' });
};

it('locks Feature 009 to exactly M01=2 and M02=4 owner receipts', () => {
  verify(`import assert from 'node:assert/strict';
    import {parseInvocation,playwrightArguments,verifyAcceptanceProfile} from './scripts/run-e2e.mjs';
    const receipt=(browserCase,identities)=>({browserCase,signups:identities,identities,
      status:'passed',cleanup:true,authSuccess:true,budgetFailure:false});
    const complete=[receipt('M01',2),receipt('M02',4)];
    assert.deepEqual(parseInvocation(['feature009']),{mode:'acceptance',profile:'feature009',
      staticOnly:false,forwarded:['--grep','@feature009']});
    assert.deepEqual(playwrightArguments(parseInvocation(['feature009'])),['test','--config',
      'playwright.config.ts','--project','acceptance','--max-failures','1','--grep','@feature009']);
    assert.equal(verifyAcceptanceProfile('feature009',complete),true);
    assert.equal(complete.reduce((sum,item)=>sum+item.identities,0),6);
    for(const changed of [{cleanup:false},{authSuccess:false},{budgetFailure:true},{status:'failed'},
      {signups:3},{identities:3}]) assert.equal(verifyAcceptanceProfile('feature009',
        complete.map((item,index)=>index?item:{...item,...changed})),false);
    assert.equal(verifyAcceptanceProfile('feature009',complete.slice(1)),false);
    assert.equal(verifyAcceptanceProfile('feature009',[receipt('M01',2),receipt('M02',3)]),false);`);
  expect(JSON.parse(fs.readFileSync('package.json','utf8')).scripts['test:e2e:feature009'])
    .toBe('node scripts/run-e2e.mjs feature009');
});

it('rejects Feature 009 profile, identity, provider, retry, and worker overrides', () => {
  verify(`import assert from 'node:assert/strict';
    import {parseInvocation,validateInvocationEnvironment} from './scripts/run-e2e.mjs';
    for(const args of [['feature009','--workers','2'],['feature009','--grep','M01'],
      ['feature009','--repeat-each','2'],['acceptance','--grep','@feature009','--workers','2'],
      ['acceptance','--grep','M01','--repeat-each','2']]) assert.throws(()=>parseInvocation(args));
    for(const name of ['OTTEROOM_TMDB_STUB_CONTROL_URL','OTTEROOM_E2E_IDENTITY',
      'TMDB_API_BASE_URL','TMDB_API_READ_ACCESS_TOKEN','SUPABASE_SERVICE_ROLE_KEY'])
      assert.throws(()=>validateInvocationEnvironment({[name]:'synthetic'}));`);
});

it('discovers only the two additive Feature 009 cases and emits safe labels', () => {
  verify(`import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
    import {safeResult} from './e2e/support/safe-reporter.ts';
    const source=fs.readFileSync('e2e/selection-rules-candidate-ordering.spec.ts','utf8');
    const ast=ts.createSourceFile('selection-rules-candidate-ordering.spec.ts',source,ts.ScriptTarget.Latest,true);
    const titles=[];const walk=node=>{if(ts.isCallExpression(node)&&node.expression.getText(ast)==='test'&&
      ts.isStringLiteral(node.arguments[0]))titles.push(node.arguments[0].text);ts.forEachChild(node,walk)};walk(ast);
    assert.deepEqual(titles,['@feature009 M01 configured order cutoff and exact-two progression',
      '@feature009 M02 localized order AND decoy and exact-fraction boundary']);
    const first=safeResult({title:titles[0],repeatEachIndex:0},{status:'passed',parallelIndex:0,
      annotations:[{type:'safe-signups',description:'2'},{type:'safe-identities',description:'2'}]});
    const second=safeResult({title:titles[1],repeatEachIndex:0},{status:'passed',parallelIndex:0,
      annotations:[{type:'safe-signups',description:'4'},{type:'safe-identities',description:'4'}]});
    assert.deepEqual([first.scenario,first.browserCase,second.scenario,second.browserCase],
      ['selection-rules','M01','selection-rules','M02']);
    assert.equal(/room_id|member_id|tmdb_movie_id|minimum_vote_count|metadata_language|agreement_numerator/i
      .test(JSON.stringify([first,second])),false);`);
});

it('keeps the fixed runner safeguards, targeted historical zero, and no Feature 010 surface', () => {
  const config = fs.readFileSync('playwright.config.ts','utf8');
  expect(config).toMatch(/selection-rules-candidate-ordering\.spec\.ts/);
  expect(config).toMatch(/workers:\s*1/); expect(config).toMatch(/retries:\s*0/);
  expect(config).toMatch(/repeatEach:\s*1/);
  for (const field of ['trace','video','screenshot']) expect(config).toMatch(new RegExp(`${field}:\\s*'off'`));
  const runner = fs.readFileSync('scripts/run-e2e.mjs','utf8');
  expect(runner).toMatch(/feature009Cases = new Map\(\[\['M01', 2\], \['M02', 4\]\]\)/);
  expect(runner).toMatch(/feature009 N=6/);
  expect(runner).not.toMatch(/feature010|match-behavior/);
  const spec = fs.readFileSync('e2e/selection-rules-candidate-ordering.spec.ts','utf8');
  expect(spec.match(/@feature009 M0[12]/g)).toHaveLength(2);
  expect(spec).toMatch(/candidateHarness/); expect(spec).toMatch(/createRetainedRulesFixture/);
  const m02 = spec.slice(spec.indexOf("test('@feature009 M02"));
  expect(m02).toMatch(/committedRoomSnapshot\(first\.room\)\.row\.tmdb_movie_id === controlledSuccessor\.tmdbMovieId/);
  expect(m02.match(/controlledSuccessor/g)).toHaveLength(4);
  const preparation = spec.slice(spec.indexOf('async function prepareRoom'), spec.indexOf("test('@feature009 M01"));
  expect(preparation).toMatch(/candidates\.available\(undefined, expectedCandidate\)/);
});

it('waits for the authoritative sequence-two exhaustion transition without extending convergence', () => {
  verify(`import assert from 'node:assert/strict';
    import {waitForCandidateTerminal} from './e2e/support/candidate-harness.ts';
    const advancing={candidate_acquisition_status:'pending',candidate_progression_status:'advancing',
      candidate_sequence:2,decision_completed_count:0};
    const exhausted={...advancing,candidate_acquisition_status:'no_candidates',
      candidate_progression_status:'exhausted'};
    let reads=0;
    const result=await waitForCandidateTerminal(()=>++reads<3?advancing:exhausted,'exhausted');
    assert.deepEqual(result,exhausted);assert.equal(reads,3);
    await assert.rejects(()=>waitForCandidateTerminal(()=>advancing,'exhausted',0));
    await assert.rejects(()=>waitForCandidateTerminal(()=>advancing,'exhausted',5001));`);
  const harness = fs.readFileSync('e2e/support/candidate-harness.ts','utf8');
  const helper = harness.slice(harness.indexOf('export async function waitForCandidateTerminal'),
    harness.indexOf('function terminalDiagnostic'));
  expect(helper).toMatch(/timeout = 5000/);
  expect(helper).toMatch(/expect\.poll[\s\S]*terminalGuard\(expected, room\)/);
  expect(helper).not.toMatch(/setTimeout/);
});
