import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { localExecutable } from './safe-process.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const maxStatusBytes = 65536;
const fields = ['API_URL', 'PUBLISHABLE_KEY', 'ANON_KEY'];
const diagnostics = {
  STATUS_FAILED: 'Local Supabase status failed; run npm run supabase:start and retry npm run env:local.',
  STATUS_INVALID: 'Invalid local CLI env output; verify the pinned project-local Supabase CLI.',
  API_URL: 'Missing or invalid API_URL; expected an HTTP(S) service URL without credentials.',
  PUBLIC_KEY: 'Missing or unsafe PUBLISHABLE_KEY/ANON_KEY; a public client key is required.',
  WRITE_FAILED: 'Cannot atomically write .env.local; check local directory permissions and retry.',
  INTERRUPTED: 'Generation interrupted; previous .env.local preserved.',
  ARGUMENTS: 'Use npm run env:local without arguments.',
};
class LocalEnvError extends Error {
  constructor(code) { super(`LOCAL_ENV_${code}: ${diagnostics[code]}`); }
}

// Raw status may include privileged values. Bound it in memory, never echo it,
// drain stderr, and expose only fixed safe failures (including spawn errors).
export async function readLocalStatus({ spawnProcess = spawn, signal, timeoutMs = 30000 } = {}) {
  try {
    signal?.throwIfAborted();
    const command = localExecutable('supabase');
    return await new Promise((resolve, reject) => {
      let child, timeout, forceStop, failure = false, settled = false, bytes = 0;
      const chunks = [];
      const kill = sig => {
        if (!child?.pid) return;
        try {
          if (process.platform !== 'win32') process.kill(-child.pid, sig);
          else child.kill(sig);
        } catch { /* Only this owned process group; it may already have exited. */ }
      };
      const stop = () => {
        failure = true; chunks.length = 0; kill('SIGTERM');
        forceStop ??= setTimeout(() => kill('SIGKILL'), 1000);
      };
      const finish = code => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout); clearTimeout(forceStop);
        signal?.removeEventListener('abort', stop);
        kill('SIGKILL');
        if (failure || code !== 0 || bytes === 0) reject(new LocalEnvError('STATUS_FAILED'));
        else resolve(Buffer.concat(chunks).toString('utf8'));
        chunks.length = 0;
      };
      child = spawnProcess(command, ['status', '--output', 'env'], {
        cwd: root, env: { ...process.env, CI: '1' },
        detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.stdout.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > maxStatusBytes) stop();
        else if (!failure) chunks.push(chunk);
      });
      child.stderr.resume();
      child.on('error', () => finish(1));
      child.on('close', finish);
      signal?.addEventListener('abort', stop, { once: true });
      if (signal?.aborted) stop();
      timeout = setTimeout(stop, timeoutMs);
    });
  } catch { throw new LocalEnvError(signal?.aborted ? 'INTERRUPTED' : 'STATUS_FAILED'); }
}

export function parseLocalStatus(source) {
  if (typeof source !== 'string' || Buffer.byteLength(source) > maxStatusBytes) throw new LocalEnvError('STATUS_INVALID');
  const selected = new Map();
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!match) throw new LocalEnvError('STATUS_INVALID');
    const [, field, encoded] = match;
    if (!fields.includes(field)) continue; // Do not parse/store unknown values.
    if (selected.has(field)) throw new LocalEnvError('STATUS_INVALID');
    let value;
    try { value = JSON.parse(encoded); } catch { throw new LocalEnvError('STATUS_INVALID'); }
    if (typeof value !== 'string') throw new LocalEnvError('STATUS_INVALID');
    selected.set(field, value);
  }
  const url = selected.get('API_URL');
  try {
    if (!url || /[\s\x00-\x1f\x7f$'"`\\]/.test(url)) throw Error();
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash) throw Error();
  } catch { throw new LocalEnvError('API_URL'); }
  // Presence chooses the preferred field: an invalid preferred key must fail,
  // rather than silently falling back and concealing malformed status output.
  const key = selected.has('PUBLISHABLE_KEY') ? selected.get('PUBLISHABLE_KEY') : selected.get('ANON_KEY');
  if (!key || key.length > 4096 || !/^[A-Za-z0-9_.-]+$/.test(key) || /sb_secret_|service[_-]?role|secret[_-]?key/i.test(key)) throw new LocalEnvError('PUBLIC_KEY');
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
    try {
      const parts = key.split('.');
      if (parts.length !== 3) throw Error();
      const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      // A legacy public anon key is not an authenticated session JWT.
      if (claims.role !== 'anon' || claims.sub || claims.session_id) throw Error();
    } catch { throw new LocalEnvError('PUBLIC_KEY'); }
  }
  return { EXPO_PUBLIC_SUPABASE_URL: url, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key };
}

export async function configureLocalEnv({ directory = root, readStatus = readLocalStatus, io = fs, signal } = {}) {
  const target = path.join(directory, '.env.local');
  let temporary;
  try {
    const values = parseLocalStatus(await readStatus({ signal }));
    signal?.throwIfAborted();
    const content = Object.entries(values).map(([name, value]) => `${name}=${value}\n`).join('');
    temporary = path.join(directory, `.env.local.${randomUUID()}.tmp`);
    await io.writeFile(temporary, content, { flag: 'wx', mode: 0o600, signal });
    signal?.throwIfAborted();
    await io.rename(temporary, target);
    return { file: '.env.local', fields: Object.keys(values), status: 'configured' };
  } catch (error) {
    if (signal?.aborted) throw new LocalEnvError('INTERRUPTED');
    throw error instanceof LocalEnvError ? error : new LocalEnvError(temporary ? 'WRITE_FAILED' : 'STATUS_FAILED');
  } finally {
    if (temporary) {
      try { await io.unlink(temporary); }
      catch (error) { if (error.code !== 'ENOENT') throw new LocalEnvError('WRITE_FAILED'); }
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const abort = new AbortController();
  const onInt = () => abort.abort('SIGINT'), onTerm = () => abort.abort('SIGTERM');
  process.once('SIGINT', onInt); process.once('SIGTERM', onTerm);
  try {
    if (process.argv.length !== 2) throw new LocalEnvError('ARGUMENTS');
    await configureLocalEnv({ signal: abort.signal });
    process.stdout.write('Local public environment configured in ignored .env.local (values withheld).\n');
  } catch (error) {
    process.stderr.write((error instanceof LocalEnvError ? error.message : diagnostics.STATUS_FAILED) + '\n');
    process.exitCode = abort.signal.aborted ? abort.signal.reason === 'SIGINT' ? 130 : 143 : 1;
  } finally { process.removeListener('SIGINT', onInt); process.removeListener('SIGTERM', onTerm); }
}
