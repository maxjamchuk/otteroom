import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { localExecutable, runManagedProcess } from './safe-process.mjs';
import { localSupabaseArgs, localSupabaseContainer, localSupabaseRuntime } from './local-supabase.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const runtime=localSupabaseRuntime();
const project=runtime.project;
const container=localSupabaseContainer();
const env={...process.env,PATH:`${path.join(root,'node_modules/.bin')}${path.delimiter}${process.env.PATH??''}`,
  CI:'1',DO_NOT_TRACK:'1',SUPABASE_TELEMETRY_DISABLED:'1'};
const lock=path.join(os.tmpdir(),`otteroom-candidate-progression-migration-${project}.lock`);
const abort=new AbortController();
let locked=false,resetStarted=false,stage='preconditions';
const receipt=value=>process.stdout.write(`CANDIDATE_PROGRESSION_MIGRATION ${value}\n`);
const fail=()=>{throw new Error('CANDIDATE_PROGRESSION_MIGRATION_FAILED');};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

async function managed(command,args,{input,signal=abort.signal,timeoutMs=300000}={}){
  const code=await runManagedProcess({command,args,input,signal,timeoutMs,env,label:'candidate-progression-fixture'});
  if(code!==0)fail();
}
async function bounded(command,args,{input,cap=65536,signal=abort.signal}={}){
  return await new Promise((resolve,reject)=>{
    let child,timer,force,bytes=0,failed=false;const chunks=[];
    const stop=()=>{failed=true;child?.kill('SIGTERM');force??=setTimeout(()=>child?.kill('SIGKILL'),1000);};
    child=spawn(command,args,{cwd:root,env,stdio:['pipe','pipe','pipe']});
    child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>cap)stop();else chunks.push(chunk);});
    child.stderr.resume();child.stdin.on('error',()=>{});child.on('error',stop);
    child.on('close',code=>{clearTimeout(timer);clearTimeout(force);signal?.removeEventListener('abort',stop);
      if(failed||code!==0)reject(new Error('CANDIDATE_PROGRESSION_MIGRATION_FAILED'));
      else resolve(Buffer.concat(chunks).toString('utf8'));});
    signal?.addEventListener('abort',stop,{once:true});child.stdin.end(input);timer=setTimeout(stop,60000);
  });
}
const sqlArgs=['exec','-i',container,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-qAt'];
const onInt=()=>abort.abort('SIGINT'),onTerm=()=>abort.abort('SIGTERM');
process.once('SIGINT',onInt);process.once('SIGTERM',onTerm);
try{
  if(process.argv.length!==2)fail();
  const handle=await fs.open(lock,'wx',0o600);locked=true;await handle.close();
  process.env.PATH=env.PATH;
  const canonical=path.join(root,'src/types/database.generated.ts');
  const typesBefore=digest(await fs.readFile(canonical));
  const historical=await Promise.all((await fs.readdir(path.join(root,'supabase/migrations')))
    .filter(name=>name<='20260916000000_swipe_decisions.sql').sort()
    .map(async name=>[name,digest(await fs.readFile(path.join(root,'supabase/migrations',name)))]));
  stage='feature007-reset';resetStarted=true;
  const cli=localExecutable('supabase');
  await managed(cli,localSupabaseArgs(['db','reset','--local','--version','20260916000000','--no-seed']));
  stage='feature007-fixtures';
  let snapshot=(await bounded('docker',sqlArgs,{input:await fs.readFile(path.join(root,
    'supabase/tests/migration/candidate_progression.before.sql'),'utf8')})).trim();
  const parsed=JSON.parse(snapshot);
  if(parsed.rooms?.length!==8||parsed.decisions?.length!==11||parsed.parents?.length!==7)fail();
  receipt(`legacy-rooms=${parsed.rooms.length} decisions=${parsed.decisions.length} parents=${parsed.parents.length} gotrue-signups=0`);
  stage='actual-cutover';await managed(cli,localSupabaseArgs(['migration','up','--local']));
  stage='compatibility';
  const variable=snapshot.replaceAll('\\','\\\\').replaceAll("'","\\'");
  await managed('docker',sqlArgs,{input:`\\set feature008_snapshot '${variable}'\n${await fs.readFile(path.join(root,
    'supabase/tests/migration/candidate_progression.after.sql'),'utf8')}`});
  snapshot='';
  if(digest(await fs.readFile(canonical))!==typesBefore)fail();
  for(const [name,hash] of historical){if(digest(await fs.readFile(path.join(root,'supabase/migrations',name)))!==hash)fail();}
  receipt('occurrences=6 classifications=collecting/agreed/advancing initial-empty=preserved decisions=11 types-unchanged=true');
}catch{
  receipt(`stage=${stage} result=FAIL`);process.exitCode=abort.signal.aborted?130:1;
}finally{
  if(resetStarted){try{
    await managed(localExecutable('supabase'),localSupabaseArgs(['db','reset','--local','--no-seed']),{signal:null});
    const empty=(await bounded('docker',sqlArgs,{signal:null,input:`select not exists(select 1 from public.rooms)
      and not exists(select 1 from auth.users) and to_regtype('public.candidate_progression_status') is not null
      and to_regprocedure('public.get_room_candidate_decision(uuid,integer,bigint)') is not null;`})).trim();
    if(empty!=='t')fail();receipt('latest-reset=true owned-fixtures=0');
  }catch{receipt('cleanup=FAIL');process.exitCode=1;}}
  if(locked){try{await fs.unlink(lock);}catch{receipt('lock-cleanup=FAIL');process.exitCode=1;}}
  process.removeListener('SIGINT',onInt);process.removeListener('SIGTERM',onTerm);
}
if(!process.exitCode)receipt('result=PASS');
