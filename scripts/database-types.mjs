import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { localExecutable } from './safe-process.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const canonical = 'src/types/database.generated.ts';
const args = ['gen', 'types', '--lang', 'typescript', '--local', '--schema', 'public'];
const diagnostics = {
  ARGUMENTS: 'Use npm run db:types (write) or npm run db:types:check (validation).',
  MISSING: `${canonical} is missing or unreadable; intentionally generate it with npm run db:types, then review the migration and artifact together.`,
  GENERATOR: 'Local generation failed; verify the pinned project-local CLI, npm run supabase:start and fully applied migrations (npm run db:reset). Existing artifact preserved.',
  EMPTY: 'Local generator returned empty bytes; verify the running, fully migrated local database. Existing artifact preserved.',
  IO: `Cannot prepare or atomically replace ${canonical}; check directory permissions.`,
  CLEANUP: 'Cannot remove database-types temporary output; check src/types permissions before retrying.',
  INTERRUPTED: 'Generation interrupted; no incomplete bytes replace the canonical artifact.',
};
class TypesError extends Error {
  constructor(code, detail = diagnostics[code]) { super(`DATABASE_TYPES_${code}: ${detail}`); }
}

// Stdout goes directly to the unique temporary file descriptor. Stderr is
// drained, never printed or retained (CLI errors can contain connection data).
async function generate({ fd, spawnProcess, signal, timeoutMs }) {
  try {
    signal?.throwIfAborted();
    const command = localExecutable('supabase');
    await new Promise((resolve, reject) => {
      let child, timer, forceStop, stopped = false, settled = false;
      const kill = sig => {
        if (!child?.pid) return;
        try {
          if (process.platform !== 'win32') process.kill(-child.pid, sig);
          else child.kill(sig);
        } catch { /* Only the generator's owned process group. */ }
      };
      const stop = () => {
        stopped = true; kill('SIGTERM');
        forceStop ??= setTimeout(() => kill('SIGKILL'), 1000);
      };
      const finish = code => {
        if (settled) return;
        settled = true;
        clearTimeout(timer); clearTimeout(forceStop);
        signal?.removeEventListener('abort', stop);
        kill('SIGKILL');
        if (stopped || code !== 0) reject(new TypesError('GENERATOR'));
        else resolve();
      };
      child = spawnProcess(command, args, {
        cwd: root, env: { ...process.env, CI: '1' },
        detached: process.platform !== 'win32', stdio: ['ignore', fd, 'pipe'],
      });
      child.stderr.resume();
      child.on('error', () => finish(1));
      child.on('close', finish);
      signal?.addEventListener('abort', stop, { once: true });
      if (signal?.aborted) stop();
      timer = setTimeout(stop, timeoutMs);
    });
  } catch { throw new TypesError(signal?.aborted ? 'INTERRUPTED' : 'GENERATOR'); }
}

export async function databaseTypes(mode, { directory = root, io = fs, spawnProcess = spawn, signal, timeoutMs = 60000 } = {}) {
  if (!['write', 'check'].includes(mode)) throw new TypesError('ARGUMENTS');
  const target = path.join(directory, canonical), parent = path.dirname(target);
  let temporary, handle;
  try {
    signal?.throwIfAborted();
    if (mode === 'check') {
      try { await io.readFile(target); } catch { throw new TypesError('MISSING'); }
    } else await io.mkdir(parent, { recursive: true });
    const candidate = path.join(parent, `.database.generated.${randomUUID()}.tmp`);
    handle = await io.open(candidate, 'wx', 0o600);
    temporary = candidate; // Cleanup owns only a successfully created file.
    await generate({ fd: handle.fd, spawnProcess, signal, timeoutMs });
    if ((await io.stat(temporary)).size === 0) throw new TypesError('EMPTY');
    await handle.close(); handle = undefined;
    signal?.throwIfAborted();
    if (mode === 'write') {
      await io.rename(temporary, target); // Same filesystem, one atomic commit point.
    } else {
      let current;
      try { current = await io.readFile(target); } catch { throw new TypesError('MISSING'); }
      const generated = await io.readFile(temporary);
      if (!current.equals(generated)) {
        let offset = 0;
        while (offset < Math.min(current.length, generated.length) && current[offset] === generated[offset]) offset++;
        throw new TypesError('MISMATCH', `${canonical}: canonical=${current.length} bytes, generated=${generated.length} bytes; first differing byte=${offset}. Check migrations; for an intentional schema change use npm run db:types and review both files. Validation never overwrites the artifact.`);
      }
    }
    return { file: canonical, mode, status: mode === 'write' ? 'written' : 'consistent' };
  } catch (error) {
    if (signal?.aborted) throw new TypesError('INTERRUPTED');
    throw error instanceof TypesError ? error : new TypesError('IO');
  } finally {
    // Close before unlink on every path, including Windows and handled signals.
    try { await handle?.close(); }
    finally {
      if (temporary) {
        try { await io.unlink(temporary); }
        catch (error) { if (error.code !== 'ENOENT') throw new TypesError('CLEANUP'); }
      }
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const abort = new AbortController();
  const onInt = () => abort.abort('SIGINT'), onTerm = () => abort.abort('SIGTERM');
  process.once('SIGINT', onInt); process.once('SIGTERM', onTerm);
  try {
    if (process.argv.length !== 3) throw new TypesError('ARGUMENTS');
    const result = await databaseTypes(process.argv[2], { signal: abort.signal });
    process.stdout.write(`${canonical}: ${result.status}.\n`);
  } catch (error) {
    process.stderr.write((error instanceof TypesError ? error.message : 'DATABASE_TYPES_IO: Operation failed safely.') + '\n');
    process.exitCode = abort.signal.aborted ? abort.signal.reason === 'SIGINT' ? 130 : 143 : 1;
  } finally {
    process.removeListener('SIGINT', onInt); process.removeListener('SIGTERM', onTerm);
  }
}
