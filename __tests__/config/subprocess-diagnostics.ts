import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { SpawnSyncReturns } from 'node:child_process';
import { sanitizeDiagnostic } from '../../e2e/support/sanitize-diagnostics';

// Child fixtures can contain credentials. Report only bounded, redacted stderr,
// never the source program, complete environment, or stdout contents.
export function expectCleanNodeChild(result: SpawnSyncReturns<string>, requireSilence = true) {
  if (!result.error && result.status === 0 && result.signal === null &&
      (!requireSilence || result.stdout.trim() === '' && result.stderr.trim() === '')) return;
  const known = Object.entries(process.env)
    .filter(([name]) => /(?:KEY|TOKEN|PASS|SECRET|AUTH|COOKIE|JWT)/i.test(name))
    .map(([, value]) => value).filter((value): value is string => Boolean(value));
  const owned = (value: string | undefined) => {
    if (!value) return 'unset';
    try {
      const resolved = fs.realpathSync(value);
      const temp = fs.realpathSync(os.tmpdir());
      const parent = path.dirname(temp);
      const root = path.basename(parent).startsWith('otteroom-') ? parent : temp;
      const relative = path.relative(root, resolved);
      return fs.statSync(resolved).uid === process.getuid?.() &&
        relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
        ? 'owned-temp' : 'other';
    } catch { return 'missing'; }
  };
  throw new Error('NODE_CHILD_CONTRACT_FAILED ' + JSON.stringify({
    command: 'node --input-type=module <stdin>',
    executable: process.execPath,
    version: process.version,
    cwd: 'repository-checkout',
    temp: owned(process.env.TMPDIR),
    home: owned(process.env.HOME),
    xdgConfig: owned(process.env.XDG_CONFIG_HOME),
    exitCode: result.status,
    signal: result.signal,
    spawnError: result.error ? (result.error as NodeJS.ErrnoException).code ?? 'unknown' : null,
    stdoutBytes: Buffer.byteLength(result.stdout ?? ''),
    stderrExcerpt: sanitizeDiagnostic(result.stderr ?? '', known),
  }));
}
