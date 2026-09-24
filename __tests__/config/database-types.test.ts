/** @jest-environment node */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import type { Database } from '../../src/types/database.generated';
import { expectCleanNodeChild } from './subprocess-diagnostics';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;

type _DecisionEnum = Assert<Equal<Database['public']['Enums']['candidate_decision_value'], 'yes' | 'no'>>;
type _OccurrenceEnum = Assert<Equal<Database['public']['Enums']['candidate_occurrence_status'],
  'collecting' | 'rejected' | 'agreed'>>;
type _ProgressionEnum = Assert<Equal<Database['public']['Enums']['candidate_progression_status'],
  'inactive' | 'collecting' | 'advancing' | 'agreed' | 'exhausted'>>;
type _DecisionTableColumns = Assert<Equal<keyof Database['public']['Tables']['candidate_decisions']['Row'],
  'room_id' | 'room_member_id' | 'candidate_occurrence_id' | 'decision' | 'accepted_at'>>;
type _OccurrenceTableColumns = Assert<Equal<keyof Database['public']['Tables']['room_candidate_occurrences']['Row'],
  'id' | 'room_id' | 'sequence' | 'tmdb_movie_id' | 'status' | 'created_at' | 'resolved_at'>>;
type _RoomDecisionColumn = Assert<Equal<Database['public']['Tables']['rooms']['Row']['decision_completed_count'], number>>;
type _RoomProgressionColumn = Assert<Equal<Database['public']['Tables']['rooms']['Row']['candidate_progression_status'],
  Database['public']['Enums']['candidate_progression_status']>>;
type _RoomSequenceColumn = Assert<Equal<Database['public']['Tables']['rooms']['Row']['candidate_sequence'], number>>;
type _CreateDecisionColumn = Assert<Equal<Database['public']['Functions']['create_room_with_selection_rules']['Returns'][number]['decision_completed_count'], number>>;
type _LegacyCreateRemoved = Assert<Equal<'create_room' extends keyof Database['public']['Functions'] ? true : false, false>>;
type _CreateSelectionArgs = Assert<Equal<Database['public']['Functions']['create_room_with_selection_rules']['Args'], {
  p_actor_user_id: string;
  p_agreement_denominator: number;
  p_agreement_numerator: number;
  p_candidate_ordering: string;
  p_creation_request_id: string;
  p_creator_is_voter: boolean;
  p_genre_mode: string;
  p_metadata_language: string;
  p_minimum_average_rating: number;
  p_minimum_vote_count: number;
  p_required_voter_count: number;
  p_rule_set_kind: string;
}>>;
type _JoinDecisionColumn = Assert<Equal<Database['public']['Functions']['join_room']['Returns'][number]['decision_completed_count'], number>>;
type _GetArgs = Assert<Equal<Database['public']['Functions']['get_room_candidate_decision']['Args'], {
  p_expected_candidate_sequence: number;
  p_expected_tmdb_movie_id: number;
  p_room_id: string;
}>>;
type _SubmitArgs = Assert<Equal<Database['public']['Functions']['submit_room_candidate_decision']['Args'], {
  p_decision: 'yes' | 'no';
  p_expected_candidate_sequence: number;
  p_expected_tmdb_movie_id: number;
  p_room_id: string;
}>>;
type DecisionReturn = {
  agreement_threshold: number;
  candidate_outcome: 'collecting' | 'rejected' | 'agreed';
  candidate_progression_status: 'inactive' | 'collecting' | 'advancing' | 'agreed' | 'exhausted';
  candidate_sequence: number;
  decision_completed_count: number;
  decision_set_complete: boolean;
  my_decision: 'yes' | 'no';
  outcome: string;
  required_voter_count: number;
};
type _GetReturn = Assert<Equal<Database['public']['Functions']['get_room_candidate_decision']['Returns'][number], DecisionReturn>>;
type _SubmitReturn = Assert<Equal<Database['public']['Functions']['submit_room_candidate_decision']['Returns'][number], DecisionReturn>>;
type _PrepareReturn = Assert<Equal<keyof Database['public']['Functions']['prepare_room_tmdb_candidate']['Returns'][number],
  'outcome' | 'candidate_sequence' | 'candidate_progression_status' | 'tmdb_movie_id' |
  'release_year_from' | 'release_year_to' | 'genre_clauses_tmdb_ids' | 'excluded_tmdb_movie_ids' |
  'rule_set_kind' | 'candidate_ordering' | 'minimum_vote_count' | 'minimum_average_rating' |
  'metadata_language' | 'genre_mode'>>;
type _CandidateCommitArgs = Assert<Equal<keyof Database['public']['Functions']['commit_room_tmdb_candidate']['Args'],
  'p_room_id' | 'p_actor_user_id' | 'p_expected_candidate_sequence' | 'p_tmdb_movie_id' |
  'p_release_year' | 'p_tmdb_genre_ids' | 'p_adult' | 'p_vote_count' | 'p_vote_average'>>;

// Child assertions use only synthetic schema bytes.
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
  import { databaseTypes } from './scripts/database-types.mjs';
  const owner = await fs.mkdtemp(path.join(os.tmpdir(), 'otteroom-t072-supabase-'));
  const ownedTemp = path.join(owner, 'tmp');
  const ownedHome = path.join(owner, 'home');
  await fs.mkdir(ownedTemp); await fs.mkdir(ownedHome);
  await fs.mkdir(path.join(ownedTemp, 'otteroom-supabase-config'));
  process.env.TMPDIR = ownedTemp;
  process.env.HOME = ownedHome;
  const workdir = owner;
  await fs.mkdir(path.join(workdir, 'supabase'));
  await fs.writeFile(path.join(workdir, 'supabase', 'config.toml'), '[project]\\n');
  process.env.OTTEROOM_SUPABASE_PROJECT_ID = 'otteroom-types-contract';
  process.env.OTTEROOM_SUPABASE_WORKDIR = workdir;
  process.once('exit', () => fsSync.rmSync(owner, { recursive: true, force: true }));
  process.env.PATH = path.join(process.cwd(), 'node_modules', '.bin') + path.delimiter + process.env.PATH;
  const bytes = 'export type Database = { public: {} };\\n';
  const cli = (source, before) => (command, args, options) => {
    if (command !== path.join(process.cwd(), 'node_modules', '.bin', 'supabase'))
      process.stderr.write('TEST_CLI_EXECUTABLE_MISMATCH\\n');
    assert.equal(command, path.join(process.cwd(), 'node_modules', '.bin', 'supabase'));
    if (JSON.stringify(args) !== JSON.stringify(['gen', 'types', '--lang', 'typescript', '--local',
      '--schema', 'public', '--workdir', workdir])) process.stderr.write('TEST_CLI_ARGS_MISMATCH\\n');
    assert.deepEqual(args, ['gen', 'types', '--lang', 'typescript', '--local', '--schema', 'public',
      '--workdir', workdir]);
    if (path.resolve(options.cwd) !== process.cwd()) process.stderr.write('TEST_CLI_CWD_MISMATCH\\n');
    assert.equal(path.resolve(options.cwd), process.cwd());
    if (options.env.HOME !== ownedHome || options.env.TMPDIR !== ownedTemp)
      process.stderr.write('TEST_CLI_OWNED_ENV_MISMATCH\\n');
    assert.equal(options.env.HOME, ownedHome);
    assert.equal(options.env.TMPDIR, ownedTemp);
    assert.equal(options.shell === undefined || options.shell === false, true);
    before?.(options);
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
  it('keeps the public database-types validation command check-only', () => {
    const scripts = JSON.parse(fs.readFileSync('package.json', 'utf8')).scripts;
    expect(scripts['db:types:check']).toBe('node scripts/database-types.mjs check');
    expect(scripts['db:types']).toBe('node scripts/database-types.mjs write');
  });

  it('uses the repository-safe Supabase CLI environment', () => verify(prelude + `
    await isolated(async ({directory}) => {
      await databaseTypes('write', {directory, spawnProcess: cli(
        'process.stdout.write(' + JSON.stringify(bytes) + ')', options => {
          assert.equal(options.env.CI, '1');
          assert.equal(options.env.DO_NOT_TRACK, '1');
          assert.equal(options.env.SUPABASE_TELEMETRY_DISABLED, '1');
          assert.equal(options.env.XDG_CONFIG_HOME, path.join(os.tmpdir(), 'otteroom-supabase-config'));
        })
      });
    });
  `));

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
