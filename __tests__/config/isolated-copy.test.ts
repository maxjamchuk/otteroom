/** @jest-environment node */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

it('copies a relative bundle symlink without resolving it back into the source tree', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'otteroom-isolated-copy-'));
  const source = path.join(temporary, 'source');
  const destination = path.join(temporary, 'destination');
  const target = '../../../config/selection-rules.yaml';
  const asset = path.join(source, 'supabase/functions/_shared/selection-rules.yaml');

  try {
    fs.mkdirSync(path.dirname(asset), { recursive: true });
    fs.mkdirSync(path.join(source, 'config'), { recursive: true });
    fs.writeFileSync(path.join(source, 'config/selection-rules.yaml'), 'rules: []\n');
    fs.symlinkSync(target, asset);

    const helper = pathToFileURL(path.resolve('scripts/t072-isolated-supabase.mjs')).href;
    const script = `import { copySource } from ${JSON.stringify(helper)};
      await copySource(${JSON.stringify(path.join(source, 'supabase'))}, ${JSON.stringify(path.join(destination, 'supabase'))});
      await copySource(${JSON.stringify(path.join(source, 'config'))}, ${JSON.stringify(path.join(destination, 'config'))});`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 15_000, maxBuffer: 65_536,
    });

    expect({ status: result.status, signal: result.signal, stderr: result.stderr }).toEqual({
      status: 0,
      signal: null,
      stderr: '',
    });
    const copiedAsset = path.join(destination, 'supabase/functions/_shared/selection-rules.yaml');
    expect(fs.lstatSync(copiedAsset).isSymbolicLink()).toBe(true);
    expect(fs.readlinkSync(copiedAsset)).toBe(target);
    expect(fs.realpathSync(copiedAsset)).toBe(fs.realpathSync(path.join(destination, 'config/selection-rules.yaml')));
    expect(fs.realpathSync(copiedAsset)).not.toContain(`${source}${path.sep}`);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
