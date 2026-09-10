import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { localExecutable, runManagedProcess } from './safe-process.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const project = 'otteroom-room-session';
const container = `supabase_db_${project}`;
const env = { ...process.env, PATH: `${path.join(root, 'node_modules/.bin')}${path.delimiter}${process.env.PATH ?? ''}`, CI: '1' };
// A fixed project lock serializes migration-runner invocations even in different
// checkouts. Never remove a lock we did not create, or try to steal a stale lock.
const lock = path.join(os.tmpdir(), `otteroom-membership-migration-${project}.lock`);
const abort = new AbortController();
const onInt = () => abort.abort('SIGINT'), onTerm = () => abort.abort('SIGTERM');
let locked = false, resetStarted = false, stage = 'preconditions';
const fail = () => { throw new Error('MIGRATION_CHECK_FAILED'); };
const receipt = value => process.stdout.write(`MEMBERSHIP_MIGRATION ${value}\n`);

async function managed(command, args, { input, signal = abort.signal, timeoutMs = 180000 } = {}) {
  const code = await runManagedProcess({ command, args, input, signal, timeoutMs, env, label: 'fixture' });
  if (code !== 0) fail();
}
// Only fixture snapshots and fixed metadata may enter bounded process memory.
// No child stdout/stderr is ever forwarded, serialized into errors or persisted.
async function bounded(command, args, { input, cap = 16384, signal = abort.signal } = {}) {
  return await new Promise((resolve, reject) => {
    let child, timer, force, settled = false, failed = false, size = 0;
    const chunks = [];
    const stop = () => { failed = true; child?.kill('SIGTERM'); force ??= setTimeout(() => child?.kill('SIGKILL'), 1000); };
    const finish = code => {
      if (settled) return; settled = true;
      clearTimeout(timer); clearTimeout(force); signal?.removeEventListener('abort', stop);
      if (failed || code !== 0) reject(new Error('MIGRATION_CHECK_FAILED'));
      else resolve(Buffer.concat(chunks).toString('utf8'));
      chunks.length = 0;
    };
    try {
      child = spawn(command, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
      child.stdout.on('data', bytes => {
        size += bytes.length;
        if (size > cap) { chunks.length = 0; stop(); } else if (!failed) chunks.push(bytes);
      });
      child.stderr.resume(); child.stdin.on('error', () => {});
      child.on('error', () => finish(1)); child.on('close', finish);
      signal?.addEventListener('abort', stop, { once: true });
      child.stdin.end(input); timer = setTimeout(stop, 15000);
      if (signal?.aborted) stop();
    } catch { finish(1); }
  });
}
const sqlArgs = ['exec', '-i', container, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAt'];
async function portUnused() {
  return await new Promise(resolve => {
    const socket = net.createConnection({ host: '127.0.0.1', port: 8081 });
    const done = value => { socket.destroy(); resolve(value); };
    socket.once('connect', () => done(false)); socket.once('error', error => done(error.code === 'ECONNREFUSED'));
    socket.setTimeout(1000, () => done(false));
  });
}

process.once('SIGINT', onInt); process.once('SIGTERM', onTerm);
try {
  if (process.argv.length !== 2) fail();
  const config = await fs.readFile(path.join(root, 'supabase/config.toml'), 'utf8');
  if (!/^project_id = "otteroom-room-session"$/m.test(config)
    || !/^schemas = \["public", "graphql_public"\]$/m.test(config)) fail();
  const handle = await fs.open(lock, 'wx', 0o600); locked = true;
  await handle.close();
  const info = (await bounded('docker', ['inspect', '--format', '{{.State.Running}} {{index .Config.Labels "com.supabase.cli.project"}}', container], { cap: 1024 })).trim();
  if (info !== `true ${project}` || !await portUnused()) fail();
  const browserContainers = await bounded('docker', ['ps', '-q', '--filter', 'label=com.otteroom.playwright.owner'], { cap: 1024 });
  if (browserContainers.trim()) fail();
  const idle = await bounded('docker', sqlArgs, { input: `set statement_timeout='5s';
    select not exists(select 1 from public.rooms) and not exists(select 1 from auth.users)
    and not exists(select 1 from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid()
      and backend_type='client backend' and (state<>'idle' or usename in('authenticated','anon')));
` });
  if (idle.trim() !== 't') fail();
  // localExecutable enforces the existing R01 project-local binary resolution.
  process.env.PATH = env.PATH;
  const cli = localExecutable('supabase');
  const canonical = path.join(root, 'src/types/database.generated.ts');
  const digest = bytes => createHash('sha256').update(bytes).digest('hex');
  const typesBefore = digest(await fs.readFile(canonical));
  stage = 'legacy-reset'; resetStarted = true;
  await managed(cli, ['db', 'reset', '--local', '--version', '20260909000001', '--no-seed']);
  stage = 'legacy-fixtures';
  let snapshot = await bounded('docker', sqlArgs, { input: await fs.readFile(path.join(root, 'supabase/tests/migration/room_membership.before.sql'), 'utf8') });
  const rows = JSON.parse(snapshot);
  const keys = 'code,created_at,creation_request_id,guest_user_id,host_user_id,id,movie_candidate_id,state,updated_at';
  if (!Array.isArray(rows) || rows.length !== 3 || rows.some((row, i) => Object.keys(row).sort().join(',') !== keys
    || row.id !== `d3000000-0000-4000-8000-00000000010${i + 1}` || row.code !== `D30000000${i + 1}`
    || row.state !== (i === 0 ? 'waiting' : 'ready') || row.movie_candidate_id !== (i === 2 ? 'fixture-clockwork-orchard' : null))) fail();
  receipt('legacy-fixtures=3 synthetic-users=5 gotrue-signups=0');
  stage = 'actual-cutover';
  await managed(cli, ['migration', 'up', '--local']);
  stage = 'compatibility';
  snapshot = JSON.stringify(rows);
  // Escape psql quoted-variable syntax. The validated local SQL snapshot is
  // data, supplied on stdin only; no dynamic shell or SQL command interpolation.
  const variable = snapshot.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
  await managed('docker', sqlArgs, { input: `\\set legacy_snapshot '${variable}'\n${await fs.readFile(path.join(root, 'supabase/tests/migration/room_membership.after.sql'), 'utf8')}`, timeoutMs: 20000 });
  snapshot = ''; rows.length = 0;
  if (digest(await fs.readFile(canonical)) !== typesBefore) fail();
  receipt('preserved-rooms=3 statistics=true authenticated-recovery=true no-reassignment=true types-unchanged=true');
} catch {
  receipt(`stage=${stage} result=FAIL`);
  process.exitCode = abort.signal.aborted ? abort.signal.reason === 'SIGINT' ? 130 : 143 : 1;
} finally {
  if (resetStarted) {
    // Cleanup has its own bounded lifetime even after SIGINT/SIGTERM. A reset
    // failure is fatal; the outer owned-stack block still guarantees shutdown.
    try {
      await managed(localExecutable('supabase'), ['db', 'reset', '--local', '--no-seed'], { signal: null });
      const empty = await bounded('docker', sqlArgs, { signal: null, input: `set statement_timeout='5s';
        select not exists(select 1 from public.rooms) and not exists(select 1 from public.room_members)
        and not exists(select 1 from auth.users) and to_regprocedure('public.create_room(uuid,integer,boolean)') is not null;
` });
      if (empty.trim() !== 't') fail();
      receipt('latest-reset=true owned-fixtures=0');
    } catch { receipt('cleanup=FAIL'); process.exitCode = 1; }
  }
  if (locked) {
    try { await fs.unlink(lock); } catch { receipt('lock-cleanup=FAIL'); process.exitCode = 1; }
  }
  process.removeListener('SIGINT', onInt); process.removeListener('SIGTERM', onTerm);
}
if (!process.exitCode) receipt('result=PASS');
