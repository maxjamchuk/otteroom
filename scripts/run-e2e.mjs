import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CredentialRegistry, startRegistryServer } from '../e2e/support/credential-registry.ts';
import { scanArtifacts } from './check-e2e-artifacts.mjs';
import { localExecutable, runManagedProcess } from './safe-process.mjs';
import { withPlaywrightRuntime, runtimeEnvironment, runtimeDiagnostic, signalExit } from './playwright-runtime.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

export function parseInvocation(argv) {
  const [mode, ...options] = argv;
  if (!['acceptance', 'security'].includes(mode)) throw new Error('SAFE_INVOCATION_REQUIRED');
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
      grep = value;
    } else if (!/^[1-4]$/.test(value ?? '') ||
      (mode === 'security' && value !== '1') || (name === '--repeat-each' && Number(value) > 3)) throw new Error('UNSAFE_OVERRIDE_REJECTED');
    forwarded.push(name, value);
  }
  return Object.freeze({ mode, staticOnly: mode === 'security' && grep === '@diagnostics-static', forwarded });
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

async function launchPlaywright({ invocation, directory, socket, signal, runtime }) {
  const env = { ...runtimeEnvironment(runtime),
    CI: '1', PLAYWRIGHT_NO_COPY_PROMPT: '1',
    OTTEROOM_E2E_ARTIFACT_DIR: directory, OTTEROOM_CREDENTIAL_SOCKET: socket,
    OTTEROOM_E2E_MODE: invocation.mode, OTTEROOM_E2E_STATIC: invocation.staticOnly ? '1' : '0',
  };
  return await runManagedProcess({
    command: localExecutable('playwright'),
    args: ['test', '--config', 'playwright.config.ts', '--project', invocation.mode === 'security' ? 'credential-safety' : 'acceptance', ...invocation.forwarded],
    label: 'playwright', signal, env,
    onStatus: message => process.stdout.write(message + '\n'),
  });
}

// Dependency injection is restricted to in-process synthetic tests, never CLI flags.
export async function executeInvocation(invocation, { artifactRoot = path.join(root, 'test-results'), launch = launchPlaywright, runtime = withPlaywrightRuntime, signal } = {}) {
  const registry = new CredentialRegistry();
  let server, outcome = 1;
  try {
    if (signal?.aborted) throw new Error('INTERRUPTED');
    fs.mkdirSync(artifactRoot, { recursive: true, mode: 0o700 });
    if (fs.realpathSync(artifactRoot) !== path.resolve(artifactRoot)) throw new Error('UNSAFE_ARTIFACT_ROOT');
    const directory = fs.mkdtempSync(path.join(artifactRoot, 'run-'));
    server = await startRegistryServer(registry);
    const exitCode = await runtime(selected => launch({ invocation, directory, registry, socket: server.endpoint, signal, runtime: selected }), { signal });
    // Child close includes reporter/web-server teardown; scan even when tests failed.
    fs.writeFileSync(path.join(directory, 'safe-process.txt'), `playwright exit=${exitCode}; managed web and browser runtime finalized\n`, { flag: 'wx', mode: 0o600 });
    const scan = scanArtifacts(directory, { registry });
    let results = [];
    const summary = path.join(directory, 'summary.json');
    if (scan.ok && fs.existsSync(summary) && fs.statSync(summary).size <= 65536) results = JSON.parse(fs.readFileSync(summary, 'utf8'));
    const completeProbe = invocation.mode !== 'security' || invocation.staticOnly || scan.ok && registry.size > 0 && verifyProbeArtifacts(directory);
    outcome = signalExit(signal) ?? (assessRun(invocation.mode, invocation.staticOnly, exitCode, results, scan.ok && completeProbe) ? 0 : exitCode || 1);
    process.stdout.write(JSON.stringify({ component: 'e2e-controller', selection: invocation.staticOnly ? 'synthetic-only' : invocation.mode,
      status: outcome === 0 ? 'passed' : 'failed', artifacts: scan.fileCount, findings: scan.findings,
      innerExit: exitCode, probeArtifactsComplete: completeProbe,
      scenarios: results.map(result => ({ scenario: ['A', 'B', 'C', 'baseline', 'auth', 'us1'].includes(result.scenario) ? result.scenario : 'other', status: result.status === 'passed' ? 'passed' : 'failed',
        signups: Number.isInteger(result.signups) ? result.signups : 0, identities: Number.isInteger(result.identities) ? result.identities : 0 })),
    }) + '\n');
    if (results.some(result => result.budgetFailure === true)) process.stderr.write('AUTH_BUDGET_FAILURE HTTP 429: acceptance N=47, local anonymous_users=150. Check configured limit and remaining hourly allowance; stop/start only after config change, never retry/reset/restart to evade quota.\n');
  } catch (error) { process.stderr.write(runtimeDiagnostic(error) + '\n'); outcome = signalExit(signal) ?? 1; }
  finally {
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
