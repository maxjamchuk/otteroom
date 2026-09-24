/** @jest-environment node */
import { spawnSync } from 'node:child_process';
import { expectCleanNodeChild } from './subprocess-diagnostics';

// Child assertions use only synthetic status and key fixtures.
function verify(source: string) {
  const result = spawnSync(process.execPath, ['--input-type=module'], {
    input: source, encoding: 'utf8', timeout: 20000, maxBuffer: 131072,
  });
  expectCleanNodeChild(result);
}

const prelude = `
  import assert from 'node:assert/strict';
  import fs from 'node:fs/promises';
  import fsSync from 'node:fs';
  import os from 'node:os';
  import path from 'node:path';
  import { spawn } from 'node:child_process';
  import { configureLocalEnv, parseLocalStatus, readLocalStatus } from './scripts/configure-local-env.mjs';
  const publicKey = 'sb_publishable_synthetic_public_example';
  const legacy = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url') + '.' +
    Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url') + '.synthetic_signature';
  const good = 'API_URL="http://127.0.0.1:55321"\\nPUBLISHABLE_KEY="' + publicKey + '"\\n';
  async function isolated(work) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'otteroom-env-test-'));
    try { await work(directory, path.join(directory, '.env.local')); }
    finally { await fs.rm(directory, { recursive: true, force: true }); }
  }
  async function preserved(status) {
    await isolated(async (directory, target) => {
      await configureLocalEnv({ directory, readStatus: async () => good });
      const before = await fs.readFile(target);
      await assert.rejects(configureLocalEnv({ directory, readStatus: async () => status }), error => {
        assert.equal(error.message.startsWith('LOCAL_ENV_'), true);
        return true;
      });
      assert.equal(before.equals(await fs.readFile(target)), true);
      assert.deepEqual(await fs.readdir(directory), ['.env.local']);
    });
  }
`;

describe('local public environment wrapper', () => {
  it('prefers publishable key, supports legacy anon, and allowlists exactly two assignments', () => verify(prelude + `
    const preferred = parseLocalStatus(good + 'ANON_KEY="' + legacy + '"\\n');
    assert.deepEqual(Object.keys(preferred), ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY']);
    assert.equal(preferred.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, publicKey);
    const fallback = parseLocalStatus('API_URL="https://localhost:55321"\\nANON_KEY="' + legacy + '"\\n');
    assert.equal(fallback.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, legacy);
  `));

  it('is byte-idempotent and writes a restrictive file using atomic replacement', () => verify(prelude + `
    await isolated(async (directory, target) => {
      let renames = 0;
      const io = { ...fs, rename: async (from, to) => {
        assert.equal(to, target); assert.equal(path.dirname(from), directory);
        assert.equal((await fs.stat(from)).mode & 0o777, 0o600);
        if (renames) assert.equal((await fs.readFile(target, 'utf8')).includes(publicKey), true);
        assert.equal((await fs.readFile(from, 'utf8')).split('\\n').length, 3);
        renames++; await fs.rename(from, to);
      }};
      await configureLocalEnv({ directory, io, readStatus: async () => good });
      const first = await fs.readFile(target);
      await configureLocalEnv({ directory, io, readStatus: async () => good });
      assert.equal(renames, 2); assert.equal(first.equals(await fs.readFile(target)), true);
      assert.equal((await fs.stat(target)).mode & 0o777, 0o600);
      assert.deepEqual(await fs.readdir(directory), ['.env.local']);
    });
  `));

  it('rejects missing, empty, malformed and duplicate required fields without damaging target', () => verify(prelude + `
    for (const bad of ['', 'not env output', '{}',
      good.replace('API_URL=', 'OTHER_URL='), good.replace('PUBLISHABLE_KEY=', 'OTHER_KEY='),
      good.replace(publicKey, ''), good.replace('http://127.0.0.1:55321', 'ftp://localhost'),
      good.replace('http://127.0.0.1:55321', 'not-a-url'),
      good + 'API_URL="http://localhost"\\n', good.replace('API_URL="', 'API_URL='),
      good + 'ANON_KEY="' + legacy + '"\\nPUBLISHABLE_KEY=""\\n']) await preserved(bad);
  `));

  it('rejects URL credentials, injection and privileged/session keys', () => verify(prelude + `
    for (const url of ['http://user:synthetic_password@localhost', 'http://localhost/?key=synthetic', 'http://localhost/#synthetic', 'http://localhost/$' + '{SECRET_KEY}']) {
      await preserved(good.replace('http://127.0.0.1:55321', url));
    }
    const roleKey = role => legacy.split('.')[0] + '.' + Buffer.from(JSON.stringify({ role })).toString('base64url') + '.signature';
    for (const key of ['sb_secret_synthetic', 'service_role_synthetic', 'secret_key_synthetic', 'synthetic_database_password', roleKey('service_role'), roleKey('authenticated'), 'bad.jwt.shape', 'Bearer synthetic']) {
      await preserved(good.replace(publicKey, key));
    }
    await preserved(good.replace(publicKey, 'public\\\\nEXPO_PUBLIC_SECRET=synthetic'));
    await preserved(good.replace(publicKey, 'public$' + '{SECRET_KEY}'));
  `));

  it('excludes every extra status field from file and diagnostics', () => verify(prelude + `
    const fields = ['SERVICE_ROLE_KEY', 'SECRET_KEY', 'DB_PASSWORD', 'JWT_SECRET', 'ACCESS_TOKEN', 'REFRESH_TOKEN', 'DATABASE_URL', 'UNEXPECTED'];
    const extra = fields.map((name, i) => name + '="private_synthetic_' + i + '"').join('\\n') + '\\n';
    await isolated(async (directory, target) => {
      const receipt = await configureLocalEnv({ directory, readStatus: async () => good + extra });
      assert.equal(JSON.stringify(receipt).includes(publicKey), false);
      const content = await fs.readFile(target, 'utf8');
      assert.equal(content.includes('private_synthetic_'), false);
      for (const field of fields) assert.equal(content.includes(field), false);
      await assert.rejects(configureLocalEnv({ directory, readStatus: async () => extra }), error => {
        assert.equal(error.message.includes('private_synthetic_'), false); return true;
      });
    });
  `));

  it('preserves prior env and removes partial output after CLI, write or rename failure', () => verify(prelude + `
    for (const stage of ['status', 'write', 'rename']) await isolated(async (directory, target) => {
      await configureLocalEnv({ directory, readStatus: async () => good });
      const first = await fs.readFile(target);
      const io = { ...fs };
      if (stage === 'write') io.writeFile = async (file, data, options) => {
        await fs.writeFile(file, data.slice(0, 12), options); throw Error('synthetic_private_error');
      };
      if (stage === 'rename') io.rename = async () => { throw Error('synthetic_private_error'); };
      await assert.rejects(configureLocalEnv({ directory, io, readStatus: async () => {
        if (stage === 'status') throw Error('synthetic_private_error'); return good;
      }}), error => { assert.equal(error.message.includes('synthetic_private_error'), false); return true; });
      assert.equal(first.equals(await fs.readFile(target)), true);
      assert.deepEqual(await fs.readdir(directory), ['.env.local']);
    });
    await isolated(async directory => {
      await assert.rejects(configureLocalEnv({ directory, readStatus: async () => { throw Error('stopped'); } }));
      assert.deepEqual(await fs.readdir(directory), []);
    });
  `));

  it('captures exact local CLI arguments and rejects nonzero, malformed, oversized and spawn failures safely', () => verify(prelude + `
    const owner = await fs.mkdtemp(path.join(os.tmpdir(), 'otteroom-t072-supabase-'));
    const ownedTemp = path.join(owner, 'tmp'), ownedHome = path.join(owner, 'home');
    await fs.mkdir(ownedTemp); await fs.mkdir(ownedHome);
    const configHome = path.join(ownedTemp, 'otteroom-supabase-config');
    await fs.mkdir(configHome);
    process.env.TMPDIR = ownedTemp;
    process.env.HOME = ownedHome;
    const workdir = owner;
    await fs.mkdir(path.join(workdir, 'supabase'));
    await fs.writeFile(path.join(workdir, 'supabase', 'config.toml'), '[project]\\n');
    process.env.OTTEROOM_SUPABASE_PROJECT_ID = 'otteroom-env-contract';
    process.env.OTTEROOM_SUPABASE_WORKDIR = workdir;
    process.once('exit', () => fsSync.rmSync(owner, { recursive: true, force: true }));
    process.env.PATH = path.join(process.cwd(), 'node_modules', '.bin') + path.delimiter + process.env.PATH;
    const cli = code => (command, args, options) => {
      if (command !== path.join(process.cwd(), 'node_modules', '.bin', 'supabase'))
        process.stderr.write('TEST_CLI_EXECUTABLE_MISMATCH\\n');
      assert.equal(command, path.join(process.cwd(), 'node_modules', '.bin', 'supabase'));
      if (JSON.stringify(args) !== JSON.stringify(['status', '--output', 'env', '--workdir', workdir]))
        process.stderr.write('TEST_CLI_ARGS_MISMATCH\\n');
      assert.deepEqual(args, ['status', '--output', 'env', '--workdir', workdir]);
      if (path.resolve(options.cwd) !== process.cwd()) process.stderr.write('TEST_CLI_CWD_MISMATCH\\n');
      assert.equal(path.resolve(options.cwd), process.cwd());
      if (options.env.HOME !== ownedHome || options.env.TMPDIR !== ownedTemp ||
          options.env.XDG_CONFIG_HOME !== configHome) process.stderr.write('TEST_CLI_OWNED_ENV_MISMATCH\\n');
      assert.equal(options.env.HOME, ownedHome);
      assert.equal(options.env.TMPDIR, ownedTemp);
      assert.equal(options.env.XDG_CONFIG_HOME, configHome);
      assert.equal(options.env.CI, '1');
      assert.equal(options.env.DO_NOT_TRACK, '1');
      assert.equal(options.env.SUPABASE_TELEMETRY_DISABLED, '1');
      assert.equal(options.shell === undefined || options.shell === false, true);
      return spawn(process.execPath, ['-e', code], options);
    };
    assert.equal(await readLocalStatus({ spawnProcess: cli('process.stdout.write(' + JSON.stringify(good) + ');process.stderr.write("synthetic_private_error");') }), good);
    for (const code of ['process.stdout.write(' + JSON.stringify(good) + ');process.stderr.write("synthetic_private_error");process.exit(9)',
      'process.stdout.write("x".repeat(70000))', 'setInterval(()=>{},1000)']) {
      await assert.rejects(readLocalStatus({ spawnProcess: cli(code), timeoutMs: 500 }), error => {
        assert.equal(error.message.includes('synthetic_private_error'), false); return true;
      });
    }
    await assert.rejects(readLocalStatus({ spawnProcess: () => { throw Error('synthetic_private_error'); } }));
    await preserved(await readLocalStatus({ spawnProcess: cli('process.stdout.write("malformed")') }));
  `));

  it('preserves previous file and cleans temporary output on handled interruption', () => verify(prelude + `
    await isolated(async (directory, target) => {
      await configureLocalEnv({ directory, readStatus: async () => good });
      const first = await fs.readFile(target), abort = new AbortController();
      const io = { ...fs, writeFile: async (...args) => { await fs.writeFile(...args); abort.abort('SIGTERM'); } };
      await assert.rejects(configureLocalEnv({ directory, io, signal: abort.signal, readStatus: async () => good }));
      assert.equal(first.equals(await fs.readFile(target)), true);
      assert.deepEqual(await fs.readdir(directory), ['.env.local']);
    });
  `));
});
