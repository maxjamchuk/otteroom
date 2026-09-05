import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { localExecutable, runManagedProcess } from './safe-process.mjs';

export const PLAYWRIGHT_VERSION = '1.63.0';
export const PLAYWRIGHT_IMAGE = 'mcr.microsoft.com/playwright:v1.63.0-noble';
const nativeURL = 'http://127.0.0.1:8081';
// Scope-forward loopback over the official connection, not the host firewall.
const dockerURL = nativeURL;
const hints = Object.freeze({
  DOCKER_UNAVAILABLE: 'Install/start Docker Engine and allow this user to reach its local daemon; rerun npm run playwright:install.',
  DOCKER_IMAGE_MISSING: 'Run npm run playwright:install to pull the pinned image.',
  DOCKER_PREPARE_FAILED: 'Check Docker access and registry connectivity; rerun npm run playwright:install.',
  DOCKER_START_FAILED: 'Check local Docker resources and host-gateway support; rerun the E2E command.',
  DOCKER_NOT_READY: 'Check container resources and npm registry connectivity for playwright@1.63.0; rerun the E2E command.',
  DOCKER_CLEANUP_FAILED: 'Check Docker access and remove only the container carrying this invocation owner label.',
  UNSUPPORTED_PLATFORM: 'Use a supported x64/arm64 OS, or Linux with Docker and the pinned official image.',
  RUNTIME_OVERRIDE_REJECTED: 'Remove custom browser/runtime environment overrides; the repository runner selects and owns the runtime.',
});

export class RuntimeError extends Error {
  constructor(code) { super(Object.hasOwn(hints, code) ? code : 'DOCKER_START_FAILED'); }
}
export function runtimeDiagnostic(error) {
  return error instanceof RuntimeError ? `${error.message}: ${hints[error.message]}` : 'PLAYWRIGHT_RUNTIME_FAILED';
}
export function signalExit(signal) { return signal?.aborted ? signal.reason === 'SIGINT' ? 130 : 143 : undefined; }

export function selectRuntime({ platform = os.platform(), arch = os.arch(), release = os.release(), version = os.version(), osRelease } = {}) {
  if (!['x64', 'arm64'].includes(arch)) throw new RuntimeError('UNSUPPORTED_PLATFORM');
  if (platform === 'linux') {
    if (osRelease === undefined) { try { osRelease = fs.readFileSync('/etc/os-release', 'utf8'); } catch { osRelease = ''; } }
    // Never execute/source os-release; ID_LIKE does not confer official support.
    const fields = Object.fromEntries(osRelease.split('\n').map(line => /^([A-Z_]+)=["']?([^"'\r\n]*)["']?$/.exec(line)).filter(Boolean).map(match => [match[1], match[2]]));
    const supported = fields.ID === 'ubuntu' && ['22.04', '24.04', '26.04'].includes(fields.VERSION_ID) ||
      fields.ID === 'debian' && ['12', '13'].includes(fields.VERSION_ID?.split('.')[0]);
    return supported ? 'native' : 'docker';
  }
  if (platform === 'darwin' && Number(release.split('.')[0]) >= 23) return 'native';
  if (platform === 'win32' && (Number(release.split('.')[2]) >= 22000 || /Windows Server/i.test(version) && Number(release.split('.')[2]) >= 17763)) return 'native';
  throw new RuntimeError('UNSUPPORTED_PLATFORM');
}

export function runtimeEnvironment(runtime, source = process.env) {
  if (!['native', 'docker'].includes(runtime.kind)) throw new RuntimeError('RUNTIME_OVERRIDE_REJECTED');
  const env = { ...source };
  for (const key of Object.keys(env)) {
    if (key.startsWith('PW_') || key.startsWith('PLAYWRIGHT_') || key === 'PWDEBUG' || key === 'DEBUG' ||
      key === 'LD_LIBRARY_PATH' || key === 'LD_PRELOAD' || key === 'NODE_OPTIONS' || key.startsWith('OTTEROOM_E2E_RUNTIME') || key === 'OTTEROOM_E2E_BASE_URL') delete env[key];
  }
  env.OTTEROOM_E2E_RUNTIME = runtime.kind;
  env.OTTEROOM_E2E_BASE_URL = runtime.kind === 'docker' ? dockerURL : nativeURL;
  if (runtime.kind === 'docker') {
    if (!/^ws:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}\/$/.test(runtime.endpoint) || Number(new URL(runtime.endpoint).port) > 65535) throw new RuntimeError('RUNTIME_OVERRIDE_REJECTED');
    env.PW_TEST_CONNECT_WS_ENDPOINT = runtime.endpoint;
  }
  return env;
}

export function browserConnection(env = process.env) {
  if (env.OTTEROOM_E2E_RUNTIME === 'native' && !env.PW_TEST_CONNECT_WS_ENDPOINT && env.OTTEROOM_E2E_BASE_URL === nativeURL) return undefined;
  if (env.OTTEROOM_E2E_RUNTIME !== 'docker' || env.OTTEROOM_E2E_BASE_URL !== dockerURL) throw new RuntimeError('RUNTIME_OVERRIDE_REJECTED');
  const checked = runtimeEnvironment({ kind: 'docker', endpoint: env.PW_TEST_CONNECT_WS_ENDPOINT }, {});
  return { wsEndpoint: checked.PW_TEST_CONNECT_WS_ENDPOINT, exposeNetwork: '<loopback>', timeout: 30000 };
}

async function dockerCommand(args, { signal, metadata = false, timeoutMs = 30000 } = {}) {
  // Raw Docker output is discarded, except bounded in-memory port/state metadata.
  const result = await runManagedProcess({ command: 'docker', args, signal, metadata, timeoutMs,
    label: metadata ? 'docker-metadata' : 'docker', env: runtimeEnvironment({ kind: 'native' }),
  });
  return metadata ? result : { code: result, output: '' };
}

async function requireDocker(docker, signal) {
  const result = await docker(['version', '--format', '{{.Server.Version}}'], { signal });
  if (result.code !== 0) throw new RuntimeError('DOCKER_UNAVAILABLE');
}

// A real bounded WS upgrade, not a fixed startup sleep or log-text guess.
export async function probeWebSocket(endpoint, { signal, timeoutMs = 1000 } = {}) {
  return await new Promise(resolve => {
    let socket, timer, done = false;
    const finish = value => {
      if (done) return; done = true; clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      try { socket?.close(); } catch { /* Failed upgrade. */ }
      resolve(value);
    };
    const abort = () => finish(false);
    if (signal?.aborted) return finish(false);
    try {
      socket = new WebSocket(endpoint);
      socket.addEventListener('open', () => finish(true), { once: true });
      socket.addEventListener('error', () => finish(false), { once: true });
      timer = setTimeout(() => finish(false), timeoutMs);
      signal?.addEventListener('abort', abort, { once: true });
    } catch { finish(false); }
  });
}

export async function waitForServer(endpoint, { signal, probe = probeWebSocket, timeoutMs = 120000, intervalMs = 250 } = {}) {
  const deadline = Date.now() + timeoutMs;
  do {
    if (signal?.aborted) throw new RuntimeError('DOCKER_NOT_READY');
    if (await probe(endpoint, { signal, timeoutMs: Math.min(1000, Math.max(1, deadline - Date.now())) })) return;
    if (Date.now() >= deadline) break;
    try { await delay(Math.min(intervalMs, deadline - Date.now()), undefined, { signal }); } catch { break; }
  } while (Date.now() < deadline);
  throw new RuntimeError('DOCKER_NOT_READY');
}

export async function prepareRuntime({ kind = selectRuntime(), docker = dockerCommand, signal,
  nativeInstall = async () => runManagedProcess({ command: localExecutable('playwright'), args: ['install', 'chromium'], label: 'playwright', signal, env: runtimeEnvironment({ kind: 'native' }) }),
} = {}) {
  if (kind === 'native') return await nativeInstall();
  if (kind !== 'docker') throw new RuntimeError('UNSUPPORTED_PLATFORM');
  await requireDocker(docker, signal);
  const result = await docker(['pull', PLAYWRIGHT_IMAGE], { signal, timeoutMs: 600000 });
  if (signal?.aborted) return signalExit(signal);
  if (result.code !== 0) throw new RuntimeError('DOCKER_PREPARE_FAILED');
  return 0;
}

export async function withPlaywrightRuntime(run, { kind = selectRuntime(), docker = dockerCommand,
  ready = waitForServer, signal, onStatus = message => process.stdout.write(message + '\n'),
} = {}) {
  if (signal?.aborted) return signalExit(signal);
  if (kind === 'native') return await run({ kind });
  if (kind !== 'docker') throw new RuntimeError('UNSUPPORTED_PLATFORM');
  const owner = randomUUID(), name = `otteroom-playwright-${owner}`;
  const label = `com.otteroom.playwright.owner=${owner}`;
  let createAttempted = false, exitCode, failure;
  const status = state => onStatus(JSON.stringify({ component: 'playwright-runtime', runtime: 'docker', image: PLAYWRIGHT_IMAGE, owner, status: state }));
  try {
    await requireDocker(docker, signal);
    if ((await docker(['image', 'inspect', '--format', '{{.Id}}', PLAYWRIGHT_IMAGE], { signal })).code !== 0) throw new RuntimeError('DOCKER_IMAGE_MISSING');
    if (signal?.aborted) return signalExit(signal);
    createAttempted = true;
    const created = await docker(['create', '--name', name, '--label', label, '--init', '--user', 'pwuser', '--workdir', '/home/pwuser',
      '--shm-size=1g', '--log-driver=none', '--add-host=hostmachine:host-gateway', '--publish', '127.0.0.1::3000',
      '--env', 'CI=1', '--env', 'PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1', PLAYWRIGHT_IMAGE,
      'npx', '--yes', `playwright@${PLAYWRIGHT_VERSION}`, 'run-server', '--port', '3000', '--host', '0.0.0.0'], { signal });
    if (created.code !== 0 || signal?.aborted) throw new RuntimeError('DOCKER_START_FAILED');
    if ((await docker(['start', name], { signal })).code !== 0) throw new RuntimeError('DOCKER_START_FAILED');
    status('started');
    const port = await docker(['inspect', '--format', '{{(index (index .NetworkSettings.Ports "3000/tcp") 0).HostPort}}', name], { metadata: true, signal });
    if (port.code !== 0 || !/^[1-9][0-9]{0,4}\s*$/.test(port.output) || Number(port.output) > 65535) throw new RuntimeError('DOCKER_START_FAILED');
    const endpoint = `ws://127.0.0.1:${Number(port.output)}/`;
    await ready(endpoint, { signal }); status('ready');
    if (signal?.aborted) throw new RuntimeError('DOCKER_NOT_READY');
    exitCode = await run({ kind, endpoint });
  } catch (error) { failure = error; }
  finally {
    if (createAttempted) {
      try {
        // Scope cleanup by unpredictable ownership label, including partial create.
        // Never pass the aborted test signal to cleanup operations.
        const owned = await docker(['ps', '-aq', '--filter', `label=${label}`], { metadata: true });
        if (owned.code !== 0 || !/^(?:[a-f0-9]{12,64}\s*)?$/.test(owned.output)) throw new Error();
        const id = owned.output.trim();
        if (id) {
          await docker(['stop', '--time', '5', id]);
          if ((await docker(['rm', '--force', id])).code !== 0) throw new Error();
        }
        const remaining = await docker(['ps', '-aq', '--filter', `label=${label}`], { metadata: true });
        if (remaining.code !== 0 || remaining.output.trim() !== '') throw new Error();
        status('removed');
      } catch { failure = new RuntimeError('DOCKER_CLEANUP_FAILED'); status('cleanup-failed'); }
    }
  }
  if (failure?.message === 'DOCKER_CLEANUP_FAILED') throw failure;
  if (signal?.aborted) return signalExit(signal);
  if (failure) throw failure;
  return exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const abort = new AbortController();
  const interrupt = signal => abort.abort(signal);
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  try {
    if (process.argv.length !== 3 || process.argv[2] !== 'install') throw new RuntimeError('RUNTIME_OVERRIDE_REJECTED');
    const kind = selectRuntime();
    process.stdout.write(JSON.stringify({ component: 'playwright-runtime', runtime: kind, image: kind === 'docker' ? PLAYWRIGHT_IMAGE : undefined, status: 'preparing' }) + '\n');
    process.exitCode = await prepareRuntime({ kind, signal: abort.signal });
    process.stdout.write(process.exitCode === 0 ? 'PLAYWRIGHT_RUNTIME_PREPARED\n' : 'PLAYWRIGHT_RUNTIME_PREPARE_FAILED\n');
  } catch (error) { process.stderr.write(runtimeDiagnostic(error) + '\n'); process.exitCode = signalExit(abort.signal) ?? 1; }
  finally { process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt); }
}
