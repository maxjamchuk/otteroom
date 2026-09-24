import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { parseEnv } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CredentialRegistry, startRegistryServer } from '../e2e/support/credential-registry.ts';
import { scanArtifacts } from './check-e2e-artifacts.mjs';
import { localExecutable, runManagedProcess } from './safe-process.mjs';
import { localSupabaseArgs } from './local-supabase.mjs';
import { withPlaywrightRuntime, runtimeEnvironment, runtimeDiagnostic, signalExit } from './playwright-runtime.mjs';
import { startTmdbStub } from '../e2e/support/tmdb-stub.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const smokeSelection = 'G03|G04|G05|G08|H01';
const t063DebugSelection = 'I01|I03|H02|H03|E05|E06|E09|E11|E12 direct|J01|J02';
const t063RemainingSelection = 'I03|H02|J01|J02';
const t063FinalSelection = 'H02|J01|J02';
const smokeCases = new Set(['G03', 'G04', 'G05', 'G08', 'H01']);
const resolutionCases = new Map([['I01', 3], ['I02', 4], ['I03', 2]]);
const feature006Cases = new Map([['J01', 3], ['J02', 4], ['J03', 2]]);
const feature007Cases = new Map([['K01', 2], ['K02', 4]]);
const feature008Cases = new Map([['L01', 2], ['L02', 4]]);
const feature009Cases = new Map([['M01', 2], ['M02', 4]]);
const t063DebugCases = new Map([['I01',3],['I03',2],['H02',3],['H03',3],['E05',3],['E06',3],
  ['E09',2],['E11',1],['E12-mutation',3],['J01',3],['J02',4]]);
const t063RemainingCases = new Map([['I03',2],['H02',3],['J01',3],['J02',4]]);
const t063FinalCases = new Map([['H02',3],['J01',3],['J02',4]]);
const acceptanceSelections = new Set(['@membership', 'G01', 'G02', 'G03', 'G04', 'G05', 'G06', 'G07', 'G08', 'G09',
  '@filters', 'H01', 'H02', 'H03', '@auth', '@us1', '@us2-join', '@us2-realtime', '@us3', '@us4', '@capacity-smoke',
  '@resolution', 'I01', 'I02', 'I03', '@feature006', 'J01', 'J02', 'J03',
  '@feature007', 'K01', 'K02', '@feature008', 'L01', 'L02', '@feature009', 'M01', 'M02',
  'E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08', 'E09', 'E10', 'E11', 'E12',
  smokeSelection, t063DebugSelection, t063RemainingSelection, t063FinalSelection]);

const forbiddenEnvironmentOverrides = ['OTTEROOM_TMDB_STUB_CONTROL_URL','OTTEROOM_E2E_IDENTITY',
  'TMDB_API_BASE_URL','TMDB_API_READ_ACCESS_TOKEN','SUPABASE_SERVICE_ROLE_KEY'];
export function validateInvocationEnvironment(environment = process.env) {
  if (forbiddenEnvironmentOverrides.some(name => Object.hasOwn(environment, name)))
    throw new Error('UNSAFE_OVERRIDE_REJECTED');
}

export async function probeAuthTarget({ apiUrl, fetchImpl = globalThis.fetch, signal } = {}) {
  let endpoint;
  try {
    if (typeof apiUrl !== 'string' || !apiUrl || /[\s\x00-\x1f\x7f'"`\\]/.test(apiUrl)) throw new Error();
    const parsed = new URL(apiUrl);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error();
    endpoint = new URL('/auth/v1/health', parsed).toString();
  } catch { throw new Error('AUTH_TARGET_CONFIG_INVALID'); }
  if (typeof fetchImpl !== 'function') throw new Error('AUTH_TARGET_UNAVAILABLE');
  try {
    const timeout = AbortSignal.timeout(3000);
    const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const response = await fetchImpl(endpoint, { method: 'GET', redirect: 'error', signal: requestSignal });
    const status = response?.status;
    if (!Number.isInteger(status) || status < 200 || status > 299) throw new Error('AUTH_TARGET_UNHEALTHY');
    return status;
  } catch (error) {
    if (error instanceof Error && error.message === 'AUTH_TARGET_UNHEALTHY') throw error;
    throw new Error('AUTH_TARGET_UNAVAILABLE');
  }
}

async function probeConfiguredAuthTarget({ signal } = {}) {
  try {
    const local = parseEnv(fs.readFileSync(path.join(root, '.env.local'), 'utf8'));
    return await probeAuthTarget({ apiUrl: local.EXPO_PUBLIC_SUPABASE_URL, signal });
  } catch (error) {
    if (error instanceof Error && /^AUTH_TARGET_(?:CONFIG_INVALID|UNHEALTHY|UNAVAILABLE)$/.test(error.message)) throw error;
    throw new Error('AUTH_TARGET_CONFIG_UNAVAILABLE');
  }
}

function invocationDiagnostic(error) {
  return error instanceof Error && /^AUTH_TARGET_(?:CONFIG_INVALID|CONFIG_UNAVAILABLE|UNHEALTHY|UNAVAILABLE)$/.test(error.message)
    ? error.message : runtimeDiagnostic(error);
}

export function parseInvocation(argv) {
  const [requestedMode, ...requestedOptions] = argv;
  if (!['acceptance', 'smoke', 'security', 'feature006', 'feature007', 'feature008', 'feature009'].includes(requestedMode)) throw new Error('SAFE_INVOCATION_REQUIRED');
  if (['smoke', 'feature006', 'feature007', 'feature008', 'feature009'].includes(requestedMode) && requestedOptions.length > 0) throw new Error('UNSAFE_OVERRIDE_REJECTED');
  const mode = ['smoke', 'feature006', 'feature007', 'feature008', 'feature009'].includes(requestedMode) ? 'acceptance' : requestedMode;
  const profile = requestedMode === 'smoke' ? 'smoke' : requestedMode === 'feature006' ? 'feature006' :
    requestedMode === 'feature007' ? 'feature007' : requestedMode === 'feature008' ? 'feature008' :
    requestedMode === 'feature009' ? 'feature009' : mode === 'security' ? 'security' : 'acceptance';
  const options = requestedMode === 'smoke' ? ['--grep', smokeSelection] :
    requestedMode === 'feature006' ? ['--grep', '@feature006'] :
    requestedMode === 'feature007' ? ['--grep', '@feature007'] :
    requestedMode === 'feature008' ? ['--grep', '@feature008'] : requestedMode === 'feature009' ? ['--grep', '@feature009'] : requestedOptions;
  const forwarded = [], seen = new Set();
  let grep;
  for (let i = 0; i < options.length; i++) {
    const [name, inline] = options[i].split('=');
    if (!['--grep', '--workers', '--repeat-each'].includes(name) || seen.has(name)) throw new Error('UNSAFE_OVERRIDE_REJECTED');
    seen.add(name);
    const value = inline ?? options[++i];
    if (name === '--grep') {
      if (typeof value !== 'string' || value.length > 120 || !/^[@A-Za-z0-9 _:.|^$()*+?\\-]+$/.test(value)) throw new Error('UNSAFE_OVERRIDE_REJECTED');
      if (mode === 'security' && value !== '@diagnostics-static') throw new Error('SECURITY_SELECTION_REJECTED');
      if (mode === 'acceptance' && !acceptanceSelections.has(value)) throw new Error('UNSAFE_OVERRIDE_REJECTED');
      grep = value;
    } else if (!/^[1-4]$/.test(value ?? '') ||
      (mode === 'security' && value !== '1') || (name === '--repeat-each' && Number(value) > 3)) throw new Error('UNSAFE_OVERRIDE_REJECTED');
    forwarded.push(name, value);
  }
  if (['@feature006', '@feature007', '@feature008', '@feature009', 'K01', 'K02', 'L01', 'L02', 'M01', 'M02', 'J03'].includes(grep) &&
    forwarded.some((value, index) => index % 2 === 0 && value !== '--grep'))
    throw new Error('UNSAFE_OVERRIDE_REJECTED');
  const boundedProfile=mode==='acceptance'&&grep==='@resolution'?'resolution':
    mode==='acceptance'&&grep===t063DebugSelection?'t063-debug':
    mode==='acceptance'&&grep===t063RemainingSelection?'t063-debug-remaining':
    mode==='acceptance'&&grep===t063FinalSelection?'t063-final-target':
    mode==='acceptance'&&grep==='G04'?'g04':
    mode==='acceptance'&&grep==='H03'?'h03':mode==='acceptance'&&grep==='J03'?'j03':
    mode==='acceptance'&&grep==='K01'?'k01':mode==='acceptance'&&grep==='K02'?'k02':
    mode==='acceptance'&&grep==='L01'?'l01':mode==='acceptance'&&grep==='L02'?'l02':
    profile==='acceptance'&&!grep?'full':profile;
  return Object.freeze({ mode, profile:boundedProfile, staticOnly: mode === 'security' && grep === '@diagnostics-static', forwarded });
}

export function assessRun(mode, staticOnly, exitCode, results, scanOk) {
  if (!scanOk || !Array.isArray(results) || results.length === 0 || results.some(result => !result || typeof result !== 'object')) return false;
  if (mode === 'acceptance') return exitCode === 0 && results.every(result => result.status === 'passed');
  const checks = results.filter(result => result.scenario === 'A' || result.scenario === 'B');
  if (checks.length !== 2 || new Set(checks.map(result => result.scenario)).size !== 2 || checks.some(result => result.status !== 'passed')) return false;
  if (staticOnly) return exitCode === 0 && results.length === 2 && results.every(result => !result.signups);
  const probes = results.filter(result => result.scenario === 'C');
  if (exitCode !== 1 || probes.length !== 1 || results.length !== 3) return false;
  const probe = probes[0];
  return probe.status === 'failed' && probe.category === 'CONTROLLED_AUTH_DIAGNOSTIC_FAILURE' &&
    probe.authSuccess === true && probe.signups === 1 && probe.cleanup === true && probe.artifactsComplete === true;
}

export function verifyProbeArtifacts(directory) {
  const names = new Set();
  function walk(current) {
    for (const item of fs.readdirSync(current, { withFileTypes: true })) {
      if (item.isDirectory()) walk(path.join(current, item.name));
      else names.add(item.name);
    }
  }
  walk(directory);
  return ['summary.json', 'safe-failure.png', 'safe-diagnostics.txt', 'error-context.md', 'safe-process.txt'].every(name => names.has(name));
}

export function verifyAcceptanceProfile(profile, results) {
  const exactReceipt=(result,browserCase,identities)=>result?.browserCase===browserCase&&
    result?.signups===identities&&result?.identities===identities&&result?.status==='passed'&&
    result?.cleanup===true&&result?.authSuccess===true&&result?.budgetFailure!==true;
  const performanceReceipt=result=>result?.performanceSamples===20&&
    Number.isInteger(result?.performancePassing)&&result.performancePassing>=19&&result.performancePassing<=20&&
    Number.isInteger(result?.performanceMaximumMs)&&result.performanceMaximumMs>=0&&
    result.performanceRecoverableFailures===0;
  if(profile==='feature008'){
    if(!Array.isArray(results)||results.length!==feature008Cases.size)return false;
    return [...feature008Cases].every(([browserCase,identities])=>results.some(result=>
      exactReceipt(result,browserCase,identities)))&&
      results.reduce((sum,result)=>sum+result.identities,0)===6;
  }
  if(profile==='feature009'){
    if(!Array.isArray(results)||results.length!==feature009Cases.size)return false;
    return [...feature009Cases].every(([browserCase,identities])=>results.some(result=>
      exactReceipt(result,browserCase,identities)))&&
      results.reduce((sum,result)=>sum+result.identities,0)===6;
  }
  if(profile==='l01'||profile==='l02'){
    const browserCase=profile.toUpperCase(),identities=feature008Cases.get(browserCase);
    return Array.isArray(results)&&results.length===1&&exactReceipt(results[0],browserCase,identities);
  }
  if(profile==='feature007'){
    if(!Array.isArray(results)||results.length!==feature007Cases.size)return false;
    return [...feature007Cases].every(([browserCase,identities])=>results.some(result=>
      exactReceipt(result,browserCase,identities)&&(browserCase!=='K01'||performanceReceipt(result))))&&
      results.reduce((sum,result)=>sum+result.identities,0)===6;
  }
  if(profile==='k01'||profile==='k02'){
    const browserCase=profile.toUpperCase(),identities=feature007Cases.get(browserCase);
    return Array.isArray(results)&&results.length===1&&exactReceipt(results[0],browserCase,identities)&&
      (browserCase!=='K01'||performanceReceipt(results[0]));
  }
  if(profile==='feature006'){
    if(!Array.isArray(results)||results.length!==feature006Cases.size)return false;
    return [...feature006Cases].every(([browserCase,identities])=>results.some(result=>
      result?.browserCase===browserCase&&result?.signups===identities&&result?.identities===identities&&
      result?.status==='passed'&&result?.cleanup===true&&result?.authSuccess===true&&result?.budgetFailure!==true))&&
      results.reduce((sum,result)=>sum+result.identities,0)===9;
  }
  if(profile==='resolution'){
    if(!Array.isArray(results)||results.length!==resolutionCases.size)return false;
    return [...resolutionCases].every(([browserCase,identities])=>results.some(result=>
      result?.browserCase===browserCase&&result?.signups===identities&&result?.identities===identities))&&
      results.reduce((sum,result)=>sum+result.identities,0)===9;
  }
  if(profile==='h03')return Array.isArray(results)&&results.length===1&&results[0]?.browserCase==='H03'&&
    results[0]?.signups===3&&results[0]?.identities===3;
  if(profile==='j03')return Array.isArray(results)&&results.length===1&&exactReceipt(results[0],'J03',2);
  if(profile==='t063-debug')return Array.isArray(results)&&results.length===t063DebugCases.size&&
    [...t063DebugCases].every(([browserCase,identities])=>results.some(result=>
      exactReceipt(result,browserCase,identities)))&&
    results.reduce((sum,result)=>sum+result.identities,0)===30;
  if(profile==='t063-debug-remaining')return Array.isArray(results)&&results.length===t063RemainingCases.size&&
    [...t063RemainingCases].every(([browserCase,identities])=>results.some(result=>
      exactReceipt(result,browserCase,identities)))&&
    results.reduce((sum,result)=>sum+result.identities,0)===12;
  if(profile==='t063-final-target')return Array.isArray(results)&&results.length===t063FinalCases.size&&
    [...t063FinalCases].every(([browserCase,identities])=>results.some(result=>
      exactReceipt(result,browserCase,identities)))&&
    results.reduce((sum,result)=>sum+result.identities,0)===10;
  if(profile==='g04')return Array.isArray(results)&&results.length===1&&exactReceipt(results[0],'G04',4);
  if(profile==='full')return Array.isArray(results)&&results.length===46&&
    results.reduce((sum,result)=>sum+(Number.isInteger(result?.identities)?result.identities:0),0)===112&&
    [...feature007Cases,...feature008Cases].every(([browserCase,identities])=>
      results.some(result=>exactReceipt(result,browserCase,identities)));
  if (profile !== 'smoke') return true;
  if (!Array.isArray(results) || results.length !== smokeCases.size) return false;
  const cases = new Set(results.map(result => result?.browserCase));
  return cases.size === smokeCases.size && [...smokeCases].every(value => cases.has(value)) &&
    results.reduce((sum, result) => sum + (Number.isInteger(result?.signups) ? result.signups : 0), 0) === 16 &&
    results.reduce((sum, result) => sum + (Number.isInteger(result?.identities) ? result.identities : 0), 0) === 16;
}

export function playwrightArguments(invocation) {
  return ['test', '--config', 'playwright.config.ts', '--project',
    invocation.mode === 'security' ? 'credential-safety' : 'acceptance',
    ...(['feature008', 'feature009'].includes(invocation.profile) ? ['--max-failures', '1'] : []),
    ...invocation.forwarded];
}

async function launchPlaywright({ invocation, directory, socket, signal, runtime }) {
  const env = { ...runtimeEnvironment(runtime),
    CI: '1', PLAYWRIGHT_NO_COPY_PROMPT: '1',
    OTTEROOM_E2E_ARTIFACT_DIR: directory, OTTEROOM_CREDENTIAL_SOCKET: socket,
    OTTEROOM_E2E_MODE: invocation.mode, OTTEROOM_E2E_STATIC: invocation.staticOnly ? '1' : '0',
    ...(process.env.OTTEROOM_TMDB_STUB_CONTROL_URL ?
      { OTTEROOM_TMDB_STUB_CONTROL_URL: process.env.OTTEROOM_TMDB_STUB_CONTROL_URL } : {}),
  };
  return await runManagedProcess({
    command: localExecutable('playwright'),
    args: playwrightArguments(invocation),
    label: 'playwright', signal, env,
    onStatus: message => process.stdout.write(message + '\n'),
  });
}

async function waitForFunctionReady(signal) {
  const local = parseEnv(fs.readFileSync(path.join(root, '.env.local'), 'utf8'));
  const endpoint = `${new URL(local.EXPO_PUBLIC_SUPABASE_URL).origin}/functions/v1/room-candidate`;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (signal?.aborted) throw new Error('INTERRUPTED');
    try { if ((await fetch(endpoint, { method: 'OPTIONS' })).status === 204) return; } catch { /* bounded readiness */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('FUNCTION_RUNTIME_NOT_READY');
}

async function startControlledProvider(registry, signal) {
  const envFile = path.join(root, 'supabase/functions/.env');
  if (fs.existsSync(envFile)) throw new Error('OWNED_ENV_CONFLICT');
  const token = `controlled-${randomBytes(32).toString('hex')}`;
  const stub = await startTmdbStub(token);
  registry.register('controlled-tmdb', [token]);
  fs.writeFileSync(envFile, `TMDB_API_READ_ACCESS_TOKEN=${token}\nTMDB_API_BASE_URL=${stub.edgeBaseUrl}\n`,
    { flag: 'wx', mode: 0o600 });
  const command = localExecutable('supabase');
  const child = spawn(command, localSupabaseArgs(['functions','serve','room-candidate','room-create','--env-file',envFile,'--log-level','error']), {
    cwd: root, detached: process.platform !== 'win32', stdio: ['ignore','pipe','pipe'], env: {
      ...process.env, XDG_CONFIG_HOME: '/tmp/otteroom-supabase-config', SUPABASE_TELEMETRY_DISABLED: '1',
    },
  });
  child.stdout.resume(); child.stderr.resume();
  const stop = () => { try { if (child.pid && process.platform !== 'win32') process.kill(-child.pid, 'SIGTERM'); else child.kill('SIGTERM'); } catch {} };
  signal?.addEventListener('abort', stop, { once: true });
  try { await waitForFunctionReady(signal); }
  catch (error) { stop(); await stub.close().catch(() => {}); fs.rmSync(envFile, { force: true }); throw error; }
  process.env.OTTEROOM_TMDB_STUB_CONTROL_URL = stub.controlUrl;
  return async () => {
    delete process.env.OTTEROOM_TMDB_STUB_CONTROL_URL; signal?.removeEventListener('abort', stop); stop();
    await new Promise(resolve => { const timer=setTimeout(resolve,3000); child.once('close',()=>{clearTimeout(timer);resolve();}); });
    try { if (child.pid && process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); } catch {}
    await stub.close(); fs.rmSync(envFile, { force: true });
  };
}

// Dependency injection is restricted to in-process synthetic tests, never CLI flags.
export async function executeInvocation(invocation, { artifactRoot = path.join(root, 'test-results'), launch = launchPlaywright,
  runtime = withPlaywrightRuntime, provider = startControlledProvider, authProbe = probeConfiguredAuthTarget, signal } = {}) {
  const registry = new CredentialRegistry();
  let server, closeProvider, outcome = 1;
  try {
    validateInvocationEnvironment();
    if (signal?.aborted) throw new Error('INTERRUPTED');
    fs.mkdirSync(artifactRoot, { recursive: true, mode: 0o700 });
    if (fs.realpathSync(artifactRoot) !== path.resolve(artifactRoot)) throw new Error('UNSAFE_ARTIFACT_ROOT');
    const directory = fs.mkdtempSync(path.join(artifactRoot, 'run-'));
    server = await startRegistryServer(registry);
    // A dead local Auth target must be rejected before Playwright can spend an
    // anonymous attempt. Static A/B diagnostics intentionally remain target-free.
    if (invocation.mode === 'security' && !invocation.staticOnly) await authProbe({ signal });
    if (invocation.mode === 'acceptance') closeProvider = await provider(registry, signal);
    const exitCode = await runtime(selected => launch({ invocation, directory, registry, socket: server.endpoint, signal, runtime: selected }), { signal });
    // Child close includes reporter/web-server teardown; scan even when tests failed.
    fs.writeFileSync(path.join(directory, 'safe-process.txt'), `playwright exit=${exitCode}; managed web and browser runtime finalized\n`, { flag: 'wx', mode: 0o600 });
    const scan = scanArtifacts(directory, { registry });
    let results = [];
    const summary = path.join(directory, 'summary.json');
    if (scan.ok && fs.existsSync(summary) && fs.statSync(summary).size <= 65536) results = JSON.parse(fs.readFileSync(summary, 'utf8'));
    const completeProbe = invocation.mode !== 'security' || invocation.staticOnly || scan.ok && registry.size > 0 && verifyProbeArtifacts(directory);
    const profileComplete = verifyAcceptanceProfile(invocation.profile, results);
    outcome = signalExit(signal) ?? (assessRun(invocation.mode, invocation.staticOnly, exitCode, results, scan.ok && completeProbe && profileComplete) ? 0 : exitCode || 1);
    process.stdout.write(JSON.stringify({ component: 'e2e-controller', selection: invocation.staticOnly ? 'synthetic-only' : invocation.profile,
      status: outcome === 0 ? 'passed' : 'failed', artifacts: scan.fileCount, findings: scan.findings,
      innerExit: exitCode, probeArtifactsComplete: completeProbe,
      scenarios: results.map(result => ({ scenario: ['A', 'B', 'C', 'baseline', 'auth', 'filters', 'membership', 'resolution', 'candidate', 'decision', 'progression', 'selection-rules', 'us1', 'us2-join', 'us2-realtime', 'us3', 'us4', 'capacity-smoke'].includes(result.scenario) ? result.scenario : 'other', status: result.status === 'passed' ? 'passed' : 'failed',
        browserCase: ['G01', 'G02', 'G03', 'G04', 'G05', 'G06', 'G07', 'G08', 'G09', 'H01', 'H02', 'H03', 'I01', 'I02', 'I03', 'J01', 'J02', 'J03', 'K01', 'K02', 'L01', 'L02', 'M01', 'M02', 'E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08', 'E09', 'E10', 'E11', 'E12-read', 'E12-subscription', 'E12-navigation', 'E12-mutation'].includes(result.browserCase) ? result.browserCase : 'none',
        worker: Number.isInteger(result.worker) && result.worker >= 0 && result.worker < 4 ? result.worker : -1,
        repetition: Number.isInteger(result.repetition) && result.repetition >= 1 && result.repetition <= 3 ? result.repetition : 0,
        signups: Number.isInteger(result.signups) ? result.signups : 0, identities: Number.isInteger(result.identities) ? result.identities : 0 })),
    }) + '\n');
    if (results.some(result => result.budgetFailure === true)) process.stderr.write(`AUTH_BUDGET_FAILURE HTTP 429: ${invocation.profile === 'smoke' ? 'smoke N=16' : invocation.profile==='feature006'?'feature006 N=9':invocation.profile==='feature007'?'feature007 N=6':invocation.profile==='feature008'?'feature008 N=6':invocation.profile==='feature009'?'feature009 N=6':invocation.profile==='resolution'?'resolution N=9':invocation.profile==='h03'?'H03 N=3':invocation.profile==='j03'?'J03 N=2':invocation.profile==='t063-debug'?'T063 debug N=30':invocation.profile==='t063-debug-remaining'?'T063 debug remaining N=12':invocation.profile==='t063-final-target'?'T063 final target N=10':'acceptance N=112'}, local anonymous_users=150. Check configured limit and remaining hourly allowance; stop/start only after config change, never retry/reset/restart to evade quota.\n`);
  } catch (error) { process.stderr.write(invocationDiagnostic(error) + '\n'); outcome = signalExit(signal) ?? 1; }
  finally {
    try { await closeProvider?.(); } catch { process.stderr.write('TMDB_STUB_CLEANUP_FAILED\n'); outcome = 1; }
    try { await server?.close(); } catch { process.stderr.write('E2E_CLEANUP_FAILED\n'); outcome = 1; }
    registry.clear();
  }
  return outcome;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const abort = new AbortController();
  const interrupt = signal => abort.abort(signal);
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  try { process.exitCode = await executeInvocation(parseInvocation(process.argv.slice(2)), { signal: abort.signal }); }
  catch { process.stderr.write('E2E_INVOCATION_REJECTED\n'); process.exitCode = 1; }
  finally { process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt); }
}
