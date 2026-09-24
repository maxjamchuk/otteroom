import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { localExecutable, runManagedProcess } from './safe-process.mjs';
import { localSupabaseArgs, localSupabaseContainer, localSupabaseRuntime } from './local-supabase.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const runtime = localSupabaseRuntime();
const project = runtime.project;
const container = localSupabaseContainer();
const env = { ...process.env, PATH: `${path.join(root, 'node_modules/.bin')}${path.delimiter}${process.env.PATH ?? ''}`,
  CI: '1', DO_NOT_TRACK: '1', SUPABASE_TELEMETRY_DISABLED: '1' };
const lock = path.join(os.tmpdir(), `otteroom-selection-rules-migration-${project}.lock`);
const abort = new AbortController();
let locked = false;
let resetStarted = false;
let stage = 'preconditions';
const fail = () => { throw new Error('SELECTION_RULES_MIGRATION_FAILED'); };
const receipt = value => process.stdout.write(`SELECTION_RULES_MIGRATION ${value}\n`);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

async function managed(command, args, { input, signal = abort.signal, timeoutMs = 300000 } = {}) {
  const code = await runManagedProcess({ command, args, input, signal, timeoutMs, env, label: 'fixture' });
  if (code !== 0) fail();
}

async function bounded(command, args, { input, cap = 131072, signal = abort.signal } = {}) {
  return await new Promise((resolve, reject) => {
    let child;
    let timer;
    let force;
    let failed = false;
    const chunks = [];
    const stop = () => { failed = true; child?.kill('SIGTERM'); force ??= setTimeout(() => child?.kill('SIGKILL'), 1000); };
    child = spawn(command, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
    child.stdout.on('data', chunk => {
      if (chunks.reduce((size, item) => size + item.length, 0) + chunk.length > cap) stop();
      else if (!failed) chunks.push(chunk);
    });
    child.stderr.resume(); child.stdin.on('error', () => {}); child.on('error', stop);
    child.on('close', code => {
      clearTimeout(timer); clearTimeout(force); signal?.removeEventListener('abort', stop);
      if (failed || code !== 0) reject(new Error('SELECTION_RULES_MIGRATION_FAILED'));
      else resolve(Buffer.concat(chunks).toString('utf8'));
    });
    signal?.addEventListener('abort', stop, { once: true });
    child.stdin.end(input); timer = setTimeout(stop, 90000);
  });
}

const sqlArgs = ['exec', '-i', container, 'psql', '-X', '-U', 'postgres', '-d', 'postgres',
  '-v', 'ON_ERROR_STOP=1', '-qAt'];
const onInt = () => abort.abort('SIGINT');
const onTerm = () => abort.abort('SIGTERM');
process.once('SIGINT', onInt); process.once('SIGTERM', onTerm);

try {
  if (process.argv.length !== 2) fail();
  const handle = await fs.open(lock, 'wx', 0o600); locked = true; await handle.close();
  const canonical = path.join(root, 'src/types/database.generated.ts');
  const typesBefore = digest(await fs.readFile(canonical));
  const migrations = await fs.readdir(path.join(root, 'supabase/migrations'));
  const historical = await Promise.all(migrations.filter(name => name <= '20260918000000_candidate_progression.sql')
    .sort().map(async name => [name, digest(await fs.readFile(path.join(root, 'supabase/migrations', name)))]));
  const migration = path.join(root, 'supabase/migrations/20260920000000_selection_rules_candidate_ordering.sql');
  if (!await fs.stat(migration).catch(() => null)) fail();
  stage = 'feature008-reset'; resetStarted = true;
  process.env.PATH = env.PATH;
  const cli = localExecutable('supabase');
  await managed(cli, localSupabaseArgs(['db', 'reset', '--local', '--version', '20260918000000', '--no-seed']));
  stage = 'feature009-fixtures';
  const snapshotText = (await bounded('docker', sqlArgs, {
    input: await fs.readFile(path.join(root, 'supabase/tests/migration/selection_rules.before.sql'), 'utf8'),
  })).trim();
  const snapshot = JSON.parse(snapshotText);
  if (snapshot.rooms?.length !== 10 || snapshot.members?.length !== 21 || snapshot.filters?.length !== 15 ||
      snapshot.parents?.length !== 5 || snapshot.occurrences?.length !== 4 || snapshot.decisions?.length !== 2) fail();
  receipt(`legacy-rooms=${snapshot.rooms.length} members=${snapshot.members.length} filters=${snapshot.filters.length} occurrences=${snapshot.occurrences.length} decisions=${snapshot.decisions.length} gotrue-signups=0`);
  stage = 'feature009-cutover';
  await managed(cli, localSupabaseArgs(['migration', 'up', '--local']));
  stage = 'compatibility';
  const variable = snapshotText.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
  await managed('docker', sqlArgs, { input: `\\set feature009_snapshot '${variable}'\n${await fs.readFile(path.join(root, 'supabase/tests/migration/selection_rules.after.sql'), 'utf8')}` });
  if (digest(await fs.readFile(canonical)) !== typesBefore) fail();
  for (const [name, hash] of historical) if (digest(await fs.readFile(path.join(root, 'supabase/migrations', name))) !== hash) fail();
  receipt('historical-migrations=byte-identical generated-types=byte-identical tmdb=not-called gotrue-signups=0 type-generation=not-called');
} catch {
  receipt(`stage=${stage} result=FAIL`); process.exitCode = abort.signal.aborted ? 130 : 1;
} finally {
  if (resetStarted) {
    try {
      await managed(localExecutable('supabase'), localSupabaseArgs(['db', 'reset', '--local', '--no-seed']), { signal: null });
      const empty = (await bounded('docker', sqlArgs, { signal: null, input: `select not exists(select 1 from public.rooms)
        and not exists(select 1 from auth.users) and not exists(select 1 from private.room_selection_rules)
        and to_regprocedure('public.create_room_with_selection_rules(uuid,uuid,integer,boolean,text,text,bigint,numeric,text,text,integer,integer)') is not null;` })).trim();
      if (empty !== 't') fail(); receipt('latest-reset=true owned-fixtures=0');
    } catch { receipt('cleanup=FAIL'); process.exitCode = 1; }
  }
  if (locked) { try { await fs.unlink(lock); } catch { receipt('lock-cleanup=FAIL'); process.exitCode = 1; } }
  process.removeListener('SIGINT', onInt); process.removeListener('SIGTERM', onTerm);
}
if (!process.exitCode) receipt('result=PASS');
