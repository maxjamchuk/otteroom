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

it('locks the feature007 owner profile to K01=2 K02=4 and exact safe receipts', () => {
  verify(`import assert from 'node:assert/strict';
    import {parseInvocation,verifyAcceptanceProfile} from './scripts/run-e2e.mjs';
    const receipt=(browserCase,identities,extra={})=>({browserCase,signups:identities,identities,
      status:'passed',cleanup:true,authSuccess:true,budgetFailure:false,...extra});
    const complete=[receipt('K01',2,{performanceSamples:20,performancePassing:19,
      performanceMaximumMs:1999,performanceRecoverableFailures:0}),receipt('K02',4)];
    assert.deepEqual(parseInvocation(['feature007']),{mode:'acceptance',profile:'feature007',
      staticOnly:false,forwarded:['--grep','@feature007']});
    assert.equal(verifyAcceptanceProfile('feature007',complete),true);
    assert.equal(complete.reduce((sum,item)=>sum+item.identities,0),6);
    for(const changed of [{performanceSamples:19},{performancePassing:18},
      {performanceMaximumMs:-1},{performanceRecoverableFailures:1},{cleanup:false},
      {authSuccess:false},{budgetFailure:true},{status:'failed'},{signups:3},{identities:3}])
      assert.equal(verifyAcceptanceProfile('feature007',complete.map((value,index)=>
        index?value:{...value,...changed})),false);
    assert.equal(verifyAcceptanceProfile('feature007',complete.slice(0,1)),false);`);
  const config = fs.readFileSync('playwright.config.ts', 'utf8');
  expect(config).toMatch(/retries:\s*0/);
  expect(config).toMatch(/repeatEach:\s*1/);
  expect(config).toMatch(/workers:\s*1/);
  for (const field of ['trace', 'video', 'screenshot']) expect(config).toMatch(new RegExp(`${field}:\\s*'off'`));
  expect(JSON.parse(fs.readFileSync('package.json', 'utf8')).scripts['test:e2e:feature007'])
    .toBe('node scripts/run-e2e.mjs feature007');
});

it('projects only sanitized K receipts and bounded aggregate performance', () => {
  verify(`import assert from 'node:assert/strict';
    import {safeResult} from './e2e/support/safe-reporter.ts';
    const annotations=[{type:'safe-signups',description:'2'},{type:'safe-identities',description:'2'},
      {type:'safe-performance-samples',description:'20'},
      {type:'safe-performance-passing',description:'20'},
      {type:'safe-performance-maximum-ms',description:'321'},
      {type:'safe-performance-recoverable-failures',description:'0'}];
    const value=safeResult({title:'@feature007 K01 exact-two immutable decision lifecycle',repeatEachIndex:0},
      {status:'passed',parallelIndex:0,annotations});
    assert.deepEqual({scenario:value.scenario,browserCase:value.browserCase,samples:value.performanceSamples,
      passing:value.performancePassing,maximum:value.performanceMaximumMs,
      failures:value.performanceRecoverableFailures},
      {scenario:'decision',browserCase:'K01',samples:20,passing:20,maximum:321,failures:0});
    assert.equal(/percentile|p95|durationSamples|roomId|tmdb/i.test(JSON.stringify(value)),false);`);
});

it('bounds direct J03 and rejects every identity/provider/credential override', () => {
  verify(`import assert from 'node:assert/strict';
    import {parseInvocation,verifyAcceptanceProfile,validateInvocationEnvironment} from './scripts/run-e2e.mjs';
    assert.equal(parseInvocation(['acceptance','--grep','J03']).profile,'j03');
    assert.equal(verifyAcceptanceProfile('j03',[{browserCase:'J03',signups:2,identities:2,
      status:'passed',cleanup:true,authSuccess:true,budgetFailure:false}]),true);
    for(const args of [['feature007','--workers','2'],['feature007','--grep','K01'],
      ['acceptance','--grep','@feature007','--repeat-each','2'],
      ['acceptance','--grep','K01','--workers','2']])assert.throws(()=>parseInvocation(args));
    for(const name of ['OTTEROOM_TMDB_STUB_CONTROL_URL','OTTEROOM_E2E_IDENTITY',
      'TMDB_API_BASE_URL','TMDB_API_READ_ACCESS_TOKEN','SUPABASE_SERVICE_ROLE_KEY'])
      assert.throws(()=>validateInvocationEnvironment({[name]:'synthetic'}));`);
});

it('preserves the Feature 007 slice inside the additive 46-case 112-identity inventory without browsers', () => {
  verify(`import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
    const files=['room-session.spec.ts','generalized-room-membership-qr.spec.ts','participant-filters.spec.ts',
      'common-filter-resolution.spec.ts','tmdb-candidate-source.spec.ts','swipe-decisions.spec.ts'];
    const titles=[];for(const file of files){const source=fs.readFileSync('e2e/'+file,'utf8');
      const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
      const walk=node=>{if(ts.isCallExpression(node)&&node.expression.getText(ast)==='test'&&
        ts.isStringLiteral(node.arguments[0]))titles.push(node.arguments[0].text);ts.forEachChild(node,walk)};walk(ast);}
    assert.equal(42+2+2,46);assert.deepEqual(titles.filter(title=>title.startsWith('@feature007 '))
      .map(title=>title.split(' ')[1]),['K01','K02']);
    assert.equal(100+2+4+2+4,112);`);
});

it('bounds the exact failed-T063 diagnostic set at 30 identities', () => {
  verify(`import assert from 'node:assert/strict';
    import {parseInvocation,verifyAcceptanceProfile} from './scripts/run-e2e.mjs';
    const grep='I01|I03|H02|H03|E05|E06|E09|E11|E12 direct|J01|J02';
    const costs={I01:3,I03:2,H02:3,H03:3,E05:3,E06:3,E09:2,E11:1,
      'E12-mutation':3,J01:3,J02:4};
    const invocation=parseInvocation(['acceptance','--grep',grep]);
    assert.equal(invocation.profile,'t063-debug');
    const results=Object.entries(costs).map(([browserCase,identities])=>({browserCase,signups:identities,
      identities,status:'passed',cleanup:true,authSuccess:true,budgetFailure:false}));
    assert.equal(results.reduce((sum,item)=>sum+item.identities,0),30);
    assert.equal(verifyAcceptanceProfile(invocation.profile,results),true);
    assert.equal(verifyAcceptanceProfile(invocation.profile,results.slice(1)),false);
    const remaining=parseInvocation(['acceptance','--grep','I03|H02|J01|J02']);
    assert.equal(remaining.profile,'t063-debug-remaining');
    assert.equal(verifyAcceptanceProfile(remaining.profile,results.filter(item=>
      ['I03','H02','J01','J02'].includes(item.browserCase))),true);
    const finalTarget=parseInvocation(['acceptance','--grep','H02|J01|J02']);
    assert.equal(finalTarget.profile,'t063-final-target');
    const finalResults=results.filter(item=>['H02','J01','J02'].includes(item.browserCase));
    assert.equal(finalResults.reduce((sum,item)=>sum+item.identities,0),10);
    assert.equal(verifyAcceptanceProfile(finalTarget.profile,finalResults),true);
    assert.equal(verifyAcceptanceProfile(finalTarget.profile,finalResults.slice(1)),false);`);
});

it('bounds the G04-only confirmation at exactly four identities', () => {
  verify(`import assert from 'node:assert/strict';
    import {parseInvocation,verifyAcceptanceProfile} from './scripts/run-e2e.mjs';
    const invocation=parseInvocation(['acceptance','--grep','G04']);
    assert.equal(invocation.profile,'g04');
    const receipt={browserCase:'G04',signups:4,identities:4,status:'passed',cleanup:true,
      authSuccess:true,budgetFailure:false};
    assert.equal(verifyAcceptanceProfile(invocation.profile,[receipt]),true);
    assert.equal(verifyAcceptanceProfile(invocation.profile,[{...receipt,identities:3}]),false);
    assert.equal(verifyAcceptanceProfile(invocation.profile,[{...receipt,signups:3}]),false);
    assert.equal(verifyAcceptanceProfile(invocation.profile,[]),false);`);
});

it('keeps historical room projections exact and contains later candidate handoffs', () => {
  const room = fs.readFileSync('e2e/room-session.spec.ts', 'utf8');
  const projection = 'candidate_acquisition_status,candidate_progression_status,candidate_sequence,' +
    'decision_completed_count,filter_completed_count,' +
    'filter_resolution_status,is_creator,is_voter,outcome,required_voter_count,room_code,room_id,' +
    'room_state,voter_count';
  expect(room.match(new RegExp(projection, 'g'))).toHaveLength(2);
  const resolution = fs.readFileSync('e2e/common-filter-resolution.spec.ts', 'utf8');
  const filters = fs.readFileSync('e2e/participant-filters.spec.ts', 'utf8');
  expect(resolution).toMatch(/isolateCandidateAcquisition/);
  expect(filters).toMatch(/isolateCandidateAcquisition/);
  expect(`${resolution}\n${filters}`).toMatch(/later candidate handoffs? isolated and drained/);
  const candidate = fs.readFileSync('e2e/tmdb-candidate-source.spec.ts', 'utf8');
  expect(candidate).toMatch(/installCandidateRequestOverlap/);
  expect(candidate).toMatch(/overlap\.drain\(\)/);
  expect(candidate).not.toMatch(/waitTmdbHeldAtLeast|configureTmdb\('candidate',true\)/);
});

it('waits for recovered keyboard eligibility and atomically focuses and emits Enter', () => {
  const harness = fs.readFileSync('e2e/support/decision-harness.ts', 'utf8');
  const start = harness.indexOf('export async function keyboardDecision');
  const end = harness.indexOf('export async function touchSwipeDecision', start);
  const helper = harness.slice(start, end);
  const enabled = helper.indexOf('await expect(button).toBeEnabled()');
  const response = helper.indexOf('page.waitForResponse', enabled);
  const enter = helper.indexOf("button.press('Enter')", response);
  const confirmation = helper.indexOf('You chose ${value', enter);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  expect(enabled).toBeGreaterThanOrEqual(0);
  expect(response).toBeGreaterThan(enabled);
  expect(enter).toBeGreaterThan(response);
  expect(confirmation).toBeGreaterThan(enter);
  expect(helper).not.toContain('button.focus()');
  expect(helper).not.toContain("page.keyboard.press('Enter')");
});
