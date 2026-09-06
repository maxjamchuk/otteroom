/** @jest-environment node */
import { spawnSync } from 'node:child_process';

// Child assertions use only synthetic schema bytes. Never forward child output.
function verify(source: string) {
  const result = spawnSync(process.execPath, ['--input-type=module'], {
    input: source, encoding: 'utf8', timeout: 20000, maxBuffer: 131072,
  });
  expect(result.error === undefined).toBe(true);
  expect(result.status).toBe(0);
  expect(result.stdout.trim() === '' && result.stderr.trim() === '').toBe(true);
}

const prelude = `
  import assert from 'node:assert/strict';
  import fs from 'node:fs/promises';
  import os from 'node:os';
  import path from 'node:path';
  import { spawn } from 'node:child_process';
  import { databaseTypes } from './scripts/database-types.mjs';
  process.env.PATH = path.join(process.cwd(), 'node_modules', '.bin') + path.delimiter + process.env.PATH;
  const bytes = 'export type Database = { public: {} };\\n';
  const cli = (source, before) => (command, args, options) => {
    assert.equal(command, path.join(process.cwd(), 'node_modules', '.bin', 'supabase'));
    assert.deepEqual(args, ['gen', 'types', '--lang', 'typescript', '--local', '--schema', 'public']);
    assert.equal(options.shell === undefined || options.shell === false, true);
    before?.();
    return spawn(process.execPath, ['-e', source], options);
  };
  const good = () => cli('process.stdout.write(' + JSON.stringify(bytes) + ')');
  async function isolated(work) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'otteroom-types-test-'));
    const parent = path.join(directory, 'src', 'types');
    const target = path.join(parent, 'database.generated.ts');
    try { await work({directory, parent, target}); }
    finally { await fs.rm(directory, {recursive:true, force:true}); }
  }
  async function failed(work) {
    await assert.rejects(work, error => {
      assert.equal(error.message.startsWith('DATABASE_TYPES_'), true);
      assert.equal(error.message.length < 600, true);
      assert.equal(error.message.includes('private_synthetic'), false);
      return true;
    });
  }
`;

describe('deterministic local database types', () => {
  it('fails missing check before generation without creating repository paths', () => verify(prelude + `
    await isolated(async ({directory}) => {
      await failed(databaseTypes('check', {directory, spawnProcess: () => { assert.fail('must not generate'); }}));
      assert.deepEqual(await fs.readdir(directory), []);
    });
  `));

  it('writes nonempty successful generation atomically then checks without target writes', () => verify(prelude + `
    await isolated(async ({directory, parent, target}) => {
      await fs.mkdir(parent, {recursive:true}); await fs.writeFile(target, 'old');
      let renames=0;
      const io={...fs, rename:async (from,to) => {
        assert.equal(path.dirname(from), parent); assert.equal(to,target);
        assert.equal(await fs.readFile(target,'utf8'),'old');
        assert.equal(await fs.readFile(from,'utf8'),bytes);
        renames++; await fs.rename(from,to);
      }};
      await databaseTypes('write',{directory,io,spawnProcess:good()});
      assert.equal(renames,1);
      const before=await fs.stat(target);
      await databaseTypes('check',{directory,spawnProcess:good(),io:{...fs,rename:async()=>assert.fail('check cannot rename')}});
      const after=await fs.stat(target);
      assert.equal(after.ino,before.ino); assert.equal(after.mtimeMs,before.mtimeMs);
      assert.equal(await fs.readFile(target,'utf8'),bytes);
      assert.deepEqual(await fs.readdir(parent),['database.generated.ts']);
    });
  `));

  it('checks exact bytes (including newline) and emits only bounded actionable mismatch metadata', () => verify(prelude + `
    await isolated(async ({directory,parent,target}) => {
      await databaseTypes('write',{directory,spawnProcess:good()});
      const before=await fs.readFile(target);
      await assert.rejects(databaseTypes('check',{directory,spawnProcess:cli('process.stdout.write('+JSON.stringify(bytes.trimEnd())+')')}),error=>{
        assert.equal(error.message.includes('src/types/database.generated.ts'),true);
        assert.equal(error.message.includes('first differing byte'),true);
        assert.equal(error.message.includes('npm run db:types'),true);
        assert.equal(error.message.length<600,true); return true;
      });
      assert.equal(before.equals(await fs.readFile(target)),true);
      assert.deepEqual(await fs.readdir(parent),['database.generated.ts']);
    });
  `));

  it('rejects generator nonzero, empty, spawn error and timeout in both modes preserving target', () => verify(prelude + `
    for(const mode of ['write','check']) for(const source of [
      'process.stdout.write("partial");process.stderr.write("private_synthetic");process.exit(9)',
      'process.stderr.write("private_synthetic")',
      'process.stdout.write("partial");setInterval(()=>{},1000)', null
    ]) await isolated(async ({directory,parent,target})=>{
      await databaseTypes('write',{directory,spawnProcess:good()});
      const before=await fs.readFile(target);
      await failed(databaseTypes(mode,{directory,timeoutMs:250,spawnProcess:source===null?()=>{throw Error('private_synthetic')}:cli(source)}));
      assert.equal(before.equals(await fs.readFile(target)),true);
      assert.deepEqual(await fs.readdir(parent),['database.generated.ts']);
    });
  `));

  it('cleans temp and preserves target on rename or unreadable-target failure', () => verify(prelude + `
    await isolated(async ({directory,parent,target})=>{
      await databaseTypes('write',{directory,spawnProcess:good()});
      await failed(databaseTypes('write',{directory,spawnProcess:good(),io:{...fs,rename:async()=>{throw Error('private_synthetic')}}}));
      assert.equal(await fs.readFile(target,'utf8'),bytes);
      await failed(databaseTypes('check',{directory,spawnProcess:good(),io:{...fs,readFile:async()=>{throw Error('private_synthetic')}}}));
      assert.deepEqual(await fs.readdir(parent),['database.generated.ts']);
    });
  `));

  it('is independent of absent, unreadable or meaningless Git/index metadata and modified target state', () => verify(prelude + `
    await isolated(async ({directory,parent,target})=>{
      for(const state of ['untracked','tracked','staged','modified']) {
        if(state!=='untracked') {
          await fs.mkdir(path.join(directory,'.git'),{recursive:true});
          await fs.writeFile(path.join(directory,'.git','index'),'intentionally not a Git index: '+state);
        }
        await databaseTypes('write',{directory,spawnProcess:good()});
        await databaseTypes('check',{directory,spawnProcess:good()});
        await fs.writeFile(target,bytes+'// stale');
        await failed(databaseTypes('check',{directory,spawnProcess:good()}));
        assert.deepEqual(await fs.readdir(parent),['database.generated.ts']);
      }
    });
  `));

  it('rejects a global PATH resolution without executing it or modifying canonical file', () => verify(prelude + `
    await isolated(async ({directory,parent,target})=>{
      await databaseTypes('write',{directory,spawnProcess:good()});
      process.env.PATH=directory;
      await failed(databaseTypes('write',{directory,spawnProcess:()=>assert.fail('global executable forbidden')}));
      assert.equal(await fs.readFile(target,'utf8'),bytes);
      assert.deepEqual(await fs.readdir(parent),['database.generated.ts']);
    });
  `));

  it('handles cancellation during generation and before replacement with no target corruption', () => verify(prelude + `
    for(const mode of ['write','check']) await isolated(async ({directory,parent,target})=>{
      await databaseTypes('write',{directory,spawnProcess:good()});
      const abort=new AbortController();
      const timer=setTimeout(()=>abort.abort('SIGTERM'),100);
      await failed(databaseTypes(mode,{directory,signal:abort.signal,spawnProcess:cli('process.stdout.write("partial");setInterval(()=>{},1000)')}));
      clearTimeout(timer);
      assert.equal(await fs.readFile(target,'utf8'),bytes);
      assert.deepEqual(await fs.readdir(parent),['database.generated.ts']);
      const late=new AbortController();
      await failed(databaseTypes(mode,{directory,signal:late.signal,spawnProcess:good(),io:{...fs,stat:async file=>{
        const value=await fs.stat(file); if(file!==target) late.abort('SIGINT'); return value;
      }}}));
      assert.equal(await fs.readFile(target,'utf8'),bytes);
      assert.deepEqual(await fs.readdir(parent),['database.generated.ts']);
    });
  `));
});
