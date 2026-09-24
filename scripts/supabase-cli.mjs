import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { localExecutable } from './safe-process.mjs';
import { localSupabaseArgs } from './local-supabase.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (process.argv.length < 3) throw new Error('SUPABASE_ARGUMENTS_REQUIRED');
    const child = spawn(localExecutable('supabase'), localSupabaseArgs(process.argv.slice(2)), {
      cwd: root,
      env: { ...process.env, CI: '1', DO_NOT_TRACK: '1', SUPABASE_TELEMETRY_DISABLED: '1',
        XDG_CONFIG_HOME: path.join(os.tmpdir(), 'otteroom-supabase-config') },
      stdio: 'inherit',
    });
    child.once('error', () => { process.exitCode = 1; });
    child.once('close', (code, signal) => {
      process.exitCode = signal ? 1 : code ?? 1;
    });
  } catch {
    process.stderr.write('SUPABASE_CLI_FAILED\n');
    process.exitCode = 1;
  }
}
