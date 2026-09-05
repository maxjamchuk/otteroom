import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sanitizeDiagnostic } from '../e2e/support/sanitize-diagnostics.ts';

const root = fileURLToPath(new URL('../', import.meta.url));

export function localExecutable(name) {
  if (!['expo', 'supabase', 'playwright'].includes(name)) throw new Error('PROCESS_OPERATION_REJECTED');
  const expected = path.join(root, 'node_modules', '.bin', name);
  const found = (process.env.PATH ?? '').split(path.delimiter)
    .map(directory => path.join(directory, name)).find(candidate => {
      try { fs.accessSync(candidate, fs.constants.X_OK); return true; } catch { return false; }
    });
  if (!found || fs.realpathSync(found) !== fs.realpathSync(expected)) throw new Error('PROJECT_LOCAL_EXECUTABLE_REQUIRED');
  return found;
}

export function operationSpec(operation) {
  switch (operation) {
    case 'web:e2e': return { binary: 'expo', args: ['start', '--web', '--port', '8081'] };
    case 'supabase:start': return { binary: 'supabase', args: ['start'] };
    case 'supabase:status': return { binary: 'supabase', args: ['status'] };
    case 'supabase:stop': return { binary: 'supabase', args: ['stop'] };
    default: throw new Error('PROCESS_OPERATION_REJECTED');
  }
}

// Drain streams without assembling or persisting their content. Fixed status only:
// a secret split across arbitrary stdout/stderr chunks cannot become an excerpt.
export async function runManagedProcess({ command, args, input, label, signal, env = process.env, onStatus = () => {}, detached = true, metadata = false, timeoutMs = 0 }) {
  if (metadata && label !== 'docker-metadata') throw new Error('PROCESS_METADATA_REJECTED');
  const component = ['web:e2e', 'supabase:start', 'supabase:status', 'supabase:stop', 'playwright', 'fixture'].includes(label)
    ? label : 'managed-process';
  const emit = status => onStatus(sanitizeDiagnostic({ component, status }));
  return await new Promise(resolve => {
    let child, timer, deadline, stopped = false, settled = false, timedOut = false, overflow = false;
    const chunks = []; let bytes = 0;
    const killGroup = sig => {
      if (!child?.pid) return;
      try { if (detached && process.platform !== 'win32') process.kill(-child.pid, sig); else child.kill(sig); } catch { /* Owned process already exited. */ }
    };
    const stop = () => {
      stopped = true;
      // Playwright installs SIGINT (not SIGTERM) teardown handlers. Allow its
      // configured 5s web-server shutdown to finish before a forced fallback.
      killGroup(component === 'playwright' ? 'SIGINT' : 'SIGTERM');
      timer ??= setTimeout(() => killGroup('SIGKILL'), component === 'playwright' ? 15000 : 3000);
    };
    const finish = code => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(deadline);
      signal?.removeEventListener('abort', stop);
      // Descendants must not outlive even a normally exiting wrapper.
      killGroup('SIGKILL');
      emit(code === 0 ? 'finished' : 'failed');
      resolve(metadata ? { code, output: overflow ? '' : Buffer.concat(chunks).toString('utf8') } : code);
    };
    try {
      child = spawn(command, args, { cwd: root, env, detached, stdio: ['pipe', 'pipe', 'pipe'] });
      if (metadata) child.stdout.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > 1024) { overflow = true; chunks.length = 0; killGroup('SIGKILL'); }
        else if (!overflow) chunks.push(chunk);
      });
      else child.stdout.resume();
      child.stderr.resume();
      child.stdin.on('error', () => {});
      child.on('error', () => finish(1));
      child.on('exit', () => killGroup('SIGKILL'));
      child.on('close', (code, sig) => finish(overflow ? 1 : timedOut ? 124 : stopped ? signal?.reason === 'SIGINT' ? 130 : 143 : code ?? (sig === 'SIGINT' ? 130 : 143)));
      child.stdin.end(input);
      emit('started');
      signal?.addEventListener('abort', stop, { once: true });
      if (signal?.aborted) stop();
      if (timeoutMs) deadline = setTimeout(() => { timedOut = true; stop(); }, timeoutMs);
    } catch { finish(1); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const abort = new AbortController();
  const interrupt = signal => abort.abort(signal);
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  try {
    if (process.argv.length !== 3) throw new Error('PROCESS_OPERATION_REJECTED');
    const operation = process.argv[2], spec = operationSpec(operation);
    process.exitCode = await runManagedProcess({
      command: localExecutable(spec.binary), args: spec.args, label: operation,
      // Managed Expo stays inside Playwright's web-server process group, so even
      // forced runner teardown cannot strand a detached Metro process.
      detached: operation !== 'web:e2e',
      env: { ...process.env, CI: '1' }, signal: abort.signal,
      onStatus: message => process.stdout.write(message + '\n'),
    });
  } catch { process.stderr.write('SAFE_PROCESS_FAILED\n'); process.exitCode = 1; }
  finally { process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt); }
}
