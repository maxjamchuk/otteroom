import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const prefix = path.join(os.tmpdir(), 'otteroom-t072-supabase-');
const firstPortBase = 56000;
const portOffsets = [0, 1, 2, 3, 6, 7, 8, 9];
const cli = path.join(root, 'node_modules', '.bin', 'supabase');

const fail = () => { throw new Error('T072_ISOLATED_SUPABASE_FAILED'); };

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

async function portFree(port) {
  return await new Promise(resolve => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const finish = value => { socket.destroy(); resolve(value); };
    socket.once('connect', () => finish(false));
    socket.once('error', error => finish(error.code === 'ECONNREFUSED'));
    socket.setTimeout(500, () => finish(false));
  });
}

async function findPortBase() {
  for (let base = firstPortBase; base < firstPortBase + 1000; base += 20) {
    const free = await Promise.all(portOffsets.map(offset => portFree(base + offset)));
    if (free.every(Boolean)) return base;
  }
  fail();
}

function replaceTopLevel(source, key, value) {
  const pattern = new RegExp(`^${key}\\s*=.*$`, 'm');
  const replaced = source.replace(pattern, `${key} = ${value}`);
  if (replaced === source) fail();
  return replaced;
}

function replaceSectionSetting(source, section, key, value) {
  const marker = `[${section}]`;
  const start = source.indexOf(marker);
  if (start < 0) fail();
  const next = source.indexOf('\n[', start + marker.length);
  const end = next < 0 ? source.length : next + 1;
  const block = source.slice(start, end);
  const pattern = new RegExp(`^${key}\\s*=.*$`, 'm');
  const replaced = block.replace(pattern, `${key} = ${value}`);
  if (replaced === block) fail();
  return source.slice(0, start) + replaced + source.slice(end);
}

export async function copySource(source, destination) {
  await fs.cp(source, destination, {
    recursive: true,
    dereference: false,
    verbatimSymlinks: true,
    filter: entry => {
      const name = path.basename(entry);
      return !name.startsWith('.env') && name !== '.temp' && name !== '.branches';
    },
  });
}

async function prepare() {
  const workdir = await fs.mkdtemp(prefix);
  const suffix = path.basename(workdir).slice(path.basename(prefix).length).toLowerCase();
  const project = `otteroom-t072-${suffix}-${randomBytes(2).toString('hex')}`;
  const base = await findPortBase();
  try {
    await copySource(path.join(root, 'supabase'), path.join(workdir, 'supabase'));
    await copySource(path.join(root, 'config'), path.join(workdir, 'config'));
    const configPath = path.join(workdir, 'supabase', 'config.toml');
    let config = await fs.readFile(configPath, 'utf8');
    config = replaceTopLevel(config, 'project_id', JSON.stringify(project));
    config = replaceSectionSetting(config, 'api', 'port', String(base));
    config = replaceSectionSetting(config, 'db', 'port', String(base + 1));
    config = replaceSectionSetting(config, 'db', 'shadow_port', String(base - 1));
    config = replaceSectionSetting(config, 'studio', 'port', String(base + 2));
    config = replaceSectionSetting(config, 'local_smtp', 'port', String(base + 3));
    config = replaceSectionSetting(config, 'edge_runtime', 'inspector_port', String(base + 7));
    config = replaceSectionSetting(config, 'analytics', 'port', String(base + 6));
    config = replaceSectionSetting(config, 'db.pooler', 'port', String(base + 9));
    await fs.writeFile(configPath, config, { mode: 0o644 });

    const canonical = await fs.readFile(path.join(root, 'config', 'selection-rules.yaml'));
    const bundled = await fs.readFile(path.join(workdir, 'supabase/functions/_shared/selection-rules.yaml'));
    if (!canonical.equals(bundled)) fail();
    await fs.writeFile(path.join(workdir, 'runtime.json'), JSON.stringify({
      project, workdir, portBase: base, sourceRoot: root,
    }, null, 2) + '\n', { mode: 0o600 });
  } catch (error) {
    await fs.rm(workdir, { recursive: true, force: true });
    throw error;
  }
  process.stdout.write(`export OTTEROOM_SUPABASE_PROJECT_ID=${shellQuote(project)}\n`);
  process.stdout.write(`export OTTEROOM_SUPABASE_WORKDIR=${shellQuote(workdir)}\n`);
  process.stdout.write(`export OTTEROOM_T072_RUNTIME=${shellQuote(workdir)}\n`);
  process.stdout.write(`export OTTEROOM_T072_PORT_BASE=${shellQuote(String(base))}\n`);
}

function runStop(project, workdir) {
  return new Promise((resolve, reject) => {
    const child = spawn(cli, ['stop', '--project-id', project, '--no-backup', '--yes', '--workdir', workdir], {
      cwd: root,
      env: { ...process.env, CI: '1', DO_NOT_TRACK: '1', SUPABASE_TELEMETRY_DISABLED: '1',
        XDG_CONFIG_HOME: path.join(os.tmpdir(), 'otteroom-supabase-config') },
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    const timer = setTimeout(() => { child.kill('SIGTERM'); }, 30000);
    child.once('error', reject);
    child.once('close', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error('T072_ISOLATED_STOP_FAILED')); });
  });
}

async function cleanup(workdir) {
  const resolved = path.resolve(workdir ?? '');
  if (!resolved.startsWith(prefix)) fail();
  const runtime = JSON.parse(await fs.readFile(path.join(resolved, 'runtime.json'), 'utf8'));
  if (runtime.workdir !== resolved || runtime.sourceRoot !== root || !/^otteroom-t072-[A-Za-z0-9-]+$/.test(runtime.project)) fail();
  await runStop(runtime.project, resolved);
  await fs.rm(resolved, { recursive: true, force: true });
  process.stdout.write(`T072_ISOLATED_CLEANUP project=${runtime.project} port-base=${runtime.portBase} removed=true\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (process.argv[2] === 'prepare' && process.argv.length === 3) await prepare();
    else if (process.argv[2] === 'cleanup' && process.argv.length === 4) await cleanup(process.argv[3]);
    else fail();
  } catch {
    process.stderr.write('T072_ISOLATED_SUPABASE_FAILED\n');
    process.exitCode = 1;
  }
}
