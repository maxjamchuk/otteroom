/** @jest-environment node */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const verify=(source:string)=>{const result=spawnSync(process.execPath,['--input-type=module','-e',source],
  {cwd:process.cwd(),encoding:'utf8',timeout:15000,maxBuffer:65536});
  expect({status:result.status,signal:result.signal,stderr:result.stderr}).toEqual({status:0,signal:null,stderr:''});};

it('locks the additive feature006 profile to J01=3 J02=4 J03=2 and safe runner settings',()=>{
  verify(`import assert from 'node:assert/strict';import {parseInvocation,verifyAcceptanceProfile,assessRun} from './scripts/run-e2e.mjs';
    const r=(browserCase,identities)=>({browserCase,signups:identities,identities,status:'passed',cleanup:true,authSuccess:true,budgetFailure:false});
    const complete=[r('J01',3),r('J02',4),r('J03',2)];
    assert.deepEqual(parseInvocation(['feature006']),{mode:'acceptance',profile:'feature006',staticOnly:false,forwarded:['--grep','@feature006']});
    assert.equal(verifyAcceptanceProfile('feature006',complete),true);
    assert.equal(verifyAcceptanceProfile('feature006',[r('J01',3),r('J02',4)]),false);
    for(const changed of [{cleanup:false},{authSuccess:false},{budgetFailure:true},{status:'failed'},{signups:4},{identities:4}])
      assert.equal(verifyAcceptanceProfile('feature006',complete.map((value,index)=>index?value:{...value,...changed})),false);
    assert.equal(assessRun('acceptance',false,0,complete,true),true);
    assert.equal(assessRun('acceptance',false,0,complete,false),false);`);
  const config=fs.readFileSync('playwright.config.ts','utf8');
  expect(config).toMatch(/retries:\s*0/);expect(config).toMatch(/repeatEach:\s*1/);
  expect(config).toMatch(/workers:\s*1/);expect(config).toMatch(/trace:\s*'off'/);
  expect(config).toMatch(/video:\s*'off'/);expect(config).toMatch(/screenshot:\s*'off'/);
  expect(fs.readFileSync('package.json','utf8')).toContain('node scripts/run-e2e.mjs feature006');
});

it('rejects CLI, provider, identity and environment injection',()=>{
  verify(`import assert from 'node:assert/strict';import {parseInvocation,validateInvocationEnvironment} from './scripts/run-e2e.mjs';
    for(const args of [['feature006','--workers','2'],['feature006','--grep','J01'],['acceptance','--grep','@feature006','--workers','2'],['acceptance','--grep','@feature006','--repeat-each','2']])assert.throws(()=>parseInvocation(args));
    for(const name of ['OTTEROOM_TMDB_STUB_CONTROL_URL','OTTEROOM_E2E_IDENTITY','TMDB_API_BASE_URL','TMDB_API_READ_ACCESS_TOKEN','SUPABASE_SERVICE_ROLE_KEY'])assert.throws(()=>validateInvocationEnvironment({[name]:'synthetic'}));`);
});

it('projects J receipts only to fixed feature006 labels and exact identity counts',()=>{
  verify(`import assert from 'node:assert/strict';import {safeResult} from './e2e/support/safe-reporter.ts';
    for(const [title,label,count] of [['@feature006 J01 exact compatible acquisition and lifecycle convergence','J01',3],['@feature006 J02 non-voting parity private traffic and completed empty','J02',4],['@feature006 J03 failure recovery response loss and same identity degradation','J03',2]]){const result=safeResult({title,repeatEachIndex:0},{status:'passed',parallelIndex:0,annotations:[{type:'safe-signups',description:String(count)},{type:'safe-identities',description:String(count)}]});assert.equal(result.scenario,'candidate');assert.equal(result.browserCase,label);assert.equal(result.signups,count);assert.equal(result.identities,count);}`);
});

it('serves bounded scripted TMDB protocol responses without retaining headers or query values',async()=>{
  verify(`import assert from 'node:assert/strict';import {startTmdbStub,TMDB_STUB_SCENARIOS} from './e2e/support/tmdb-stub.ts';
    assert.deepEqual(TMDB_STUB_SCENARIOS,['candidate','empty','timeout','rate-limit','server-error','malformed','limit','details-error','configuration-error','no-poster']);
    const stub=await startTmdbStub(),api=stub.controlUrl.replace('/__control','/3');try{let response=await fetch(stub.controlUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({scenario:'candidate',hold:true})});assert.equal(response.ok,true);const discover=fetch(api+'/discover/movie?language=en-US&include_adult=false&include_video=false&sort_by=primary_release_date.asc&primary_release_date.gte=2000-01-01&primary_release_date.lte=2010-12-31&page=1&with_genres=18',{headers:{authorization:'Bearer synthetic'}});for(let i=0;i<40&&(await (await fetch(stub.controlUrl)).json()).held!==1;i++)await new Promise(r=>setTimeout(r,10));response=await fetch(stub.controlUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({release:true})});assert.equal(response.ok,true);assert.equal((await (await discover).json()).results.length,4);const snapshot=await (await fetch(stub.controlUrl)).json();assert.deepEqual(snapshot,{scenario:'candidate',calls:{discover:1,details:0,configuration:0,poster:0},held:1,released:true,invalid:0});assert.equal(/authorization|with_genres|release_date|Bearer|synthetic/.test(JSON.stringify(snapshot)),false);}finally{await stub.close();}`);
});

it('keeps live TMDB smoke zero-identity, token-required, read-only and output-safe',()=>{
  verify(`import assert from 'node:assert/strict';import fs from 'node:fs';
    import {validateTmdbContractEnvironment} from './scripts/run-tmdb-contract.mjs';
    assert.throws(()=>validateTmdbContractEnvironment({}));
    assert.throws(()=>validateTmdbContractEnvironment({TMDB_API_READ_ACCESS_TOKEN:'synthetic-contract-token-value',TMDB_API_BASE_URL:'http://127.0.0.1'}));
    assert.equal(validateTmdbContractEnvironment({TMDB_API_READ_ACCESS_TOKEN:'synthetic-contract-token-value'}).length,30);
    const runner=fs.readFileSync('scripts/run-tmdb-contract.mjs','utf8');
    const contract=fs.readFileSync('supabase/functions/_tests/live-tmdb-contract.test.ts','utf8');
    assert.equal(runner.includes('--allow-net=api.themoviedb.org'),true);
    assert.equal(runner.includes('--allow-all'),false);
    assert.equal(runner.includes("stdio:['ignore','pipe','pipe']"),true);
    assert.equal(['supabase','auth/v1','signup','service_role'].some(value=>contract.toLowerCase().includes(value)),false);
    assert.equal(contract.includes('/genre/movie/list?language=en-US'),true);
    assert.equal(contract.includes("include_adult:'false'"),true);
    assert.equal(contract.includes("sort_by:'primary_release_date.asc'"),true);
    assert.equal(contract.includes('?language=en-US'),true);
    assert.equal(contract.includes("startsWith('https://')"),true);`);
});
