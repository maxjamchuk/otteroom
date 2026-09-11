import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { localExecutable, runManagedProcess } from './safe-process.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const project='otteroom-room-session';
const container=`supabase_db_${project}`;
const env={...process.env,
  PATH:`${path.join(root,'node_modules/.bin')}${path.delimiter}${process.env.PATH??''}`,
  CI:'1',DO_NOT_TRACK:'1',SUPABASE_TELEMETRY_DISABLED:'1'};
const lock=path.join(os.tmpdir(),`otteroom-common-filter-resolution-migration-${project}.lock`);
const abort=new AbortController();
const onInt=()=>abort.abort('SIGINT'),onTerm=()=>abort.abort('SIGTERM');
let locked=false,resetStarted=false,stage='preconditions';
const fail=()=>{throw new Error('MIGRATION_CHECK_FAILED');};
const receipt=value=>process.stdout.write(`COMMON_FILTER_RESOLUTION_MIGRATION ${value}\n`);

async function managed(command,args,{input,signal=abort.signal,timeoutMs=180000}={}){
  const code=await runManagedProcess({command,args,input,signal,timeoutMs,env,label:'fixture'});
  if(code!==0)fail();
}
async function bounded(command,args,{input,cap=32768,signal=abort.signal}={}){
  return await new Promise((resolve,reject)=>{
    let child,timer,force,settled=false,failed=false,size=0;const chunks=[];
    const stop=()=>{failed=true;child?.kill('SIGTERM');force??=setTimeout(()=>child?.kill('SIGKILL'),1000);};
    const finish=code=>{if(settled)return;settled=true;clearTimeout(timer);clearTimeout(force);
      signal?.removeEventListener('abort',stop);
      if(failed||code!==0)reject(new Error('MIGRATION_CHECK_FAILED'));
      else resolve(Buffer.concat(chunks).toString('utf8'));chunks.length=0;};
    try{
      child=spawn(command,args,{cwd:root,env,stdio:['pipe','pipe','pipe']});
      child.stdout.on('data',bytes=>{size+=bytes.length;if(size>cap){chunks.length=0;stop();}
        else if(!failed)chunks.push(bytes);});
      child.stderr.resume();child.stdin.on('error',()=>{});child.on('error',()=>finish(1));child.on('close',finish);
      signal?.addEventListener('abort',stop,{once:true});child.stdin.end(input);timer=setTimeout(stop,30000);
      if(signal?.aborted)stop();
    }catch{finish(1);}
  });
}
const sqlArgs=['exec','-i',container,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-qAt'];
async function portUnused(){return await new Promise(resolve=>{const socket=net.createConnection({host:'127.0.0.1',port:8081});
  const done=value=>{socket.destroy();resolve(value);};socket.once('connect',()=>done(false));
  socket.once('error',error=>done(error.code==='ECONNREFUSED'));socket.setTimeout(1000,()=>done(false));});}

process.once('SIGINT',onInt);process.once('SIGTERM',onTerm);
try{
  if(process.argv.length!==2)fail();
  const config=await fs.readFile(path.join(root,'supabase/config.toml'),'utf8');
  if(!/^project_id = "otteroom-room-session"$/m.test(config)
    ||!/^schemas = \["public", "graphql_public"\]$/m.test(config))fail();
  const handle=await fs.open(lock,'wx',0o600);locked=true;await handle.close();
  const info=(await bounded('docker',['inspect','--format','{{.State.Running}} {{index .Config.Labels "com.supabase.cli.project"}}',container],{cap:1024})).trim();
  if(info!==`true ${project}`||!await portUnused())fail();
  const browsers=await bounded('docker',['ps','-q','--filter','label=com.otteroom.playwright.owner'],{cap:1024});
  if(browsers.trim())fail();
  const idle=await bounded('docker',sqlArgs,{input:`set statement_timeout='5s';
    select not exists(select 1 from public.rooms) and not exists(select 1 from auth.users)
    and not exists(select 1 from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid()
      and backend_type='client backend' and (state<>'idle' or usename in('authenticated','anon')));`});
  if(idle.trim()!=='t')fail();
  process.env.PATH=env.PATH;const cli=localExecutable('supabase');
  const canonical=path.join(root,'src/types/database.generated.ts');
  const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
  const typesBefore=digest(await fs.readFile(canonical));
  stage='feature004-reset';resetStarted=true;
  await managed(cli,['db','reset','--local','--version','20260911000000','--no-seed']);
  stage='feature004-fixtures';
  let snapshot=await bounded('docker',sqlArgs,{input:await fs.readFile(
    path.join(root,'supabase/tests/migration/common_filter_resolution.before.sql'),'utf8')});
  const parsed=JSON.parse(snapshot);
  if(Object.keys(parsed).sort().join(',')!=='candidates,filters,members,rooms'
    ||parsed.rooms?.length!==4||parsed.members?.length!==10||parsed.filters?.length!==6
    ||parsed.candidates?.length!==4
    ||parsed.rooms.some((row,index)=>row.id!==`f5100000-0000-4000-8000-00000000000${index+1}`
      ||row.code!==`F51000000${index+1}`||row.state!==(index===0?'waiting':'ready')
      ||row.filter_completed_count!==[0,1,3,2][index]
      ||row.movie_candidate_id!==([null,'fixture-clockwork-orchard',null,'fixture-cloud-tram-four'][index])))fail();
  receipt('legacy-rooms=4 members=10 filters=6 fixture-candidates=4 synthetic-users=9 gotrue-signups=0');
  stage='actual-cutover';await managed(cli,['migration','up','--local']);
  stage='compatibility';
  const variable=snapshot.trim().replaceAll('\\','\\\\').replaceAll("'","\\'");
  await managed('docker',sqlArgs,{input:`\\set feature005_snapshot '${variable}'\n${await fs.readFile(
    path.join(root,'supabase/tests/migration/common_filter_resolution.after.sql'),'utf8')}`,timeoutMs:45000});
  snapshot='';parsed.rooms.length=0;parsed.members.length=0;parsed.filters.length=0;parsed.candidates.length=0;
  if(digest(await fs.readFile(canonical))!==typesBefore)fail();
  receipt('preserved-rooms=4 members=10 filters=6 xmin=true pending-default=true lazy-compatible=true lazy-incompatible=true candidate-suppressed=true types-unchanged=true');
}catch{
  receipt(`stage=${stage} result=FAIL`);
  process.exitCode=abort.signal.aborted?(abort.signal.reason==='SIGINT'?130:143):1;
}finally{
  if(resetStarted){try{
    await managed(localExecutable('supabase'),['db','reset','--local','--no-seed'],{signal:null});
    const empty=await bounded('docker',sqlArgs,{signal:null,input:`set statement_timeout='5s';
      select not exists(select 1 from public.rooms) and not exists(select 1 from public.room_members)
      and not exists(select 1 from public.participant_filters)
      and not exists(select 1 from private.room_filter_resolutions)
      and not exists(select 1 from private.room_filter_resolution_genre_clauses)
      and not exists(select 1 from auth.users)
      and to_regprocedure('public.resolve_common_filters(uuid)') is not null;`});
    if(empty.trim()!=='t')fail();receipt('latest-reset=true owned-fixtures=0');
  }catch{receipt('cleanup=FAIL');process.exitCode=1;}}
  if(locked){try{await fs.unlink(lock);}catch{receipt('lock-cleanup=FAIL');process.exitCode=1;}}
  process.removeListener('SIGINT',onInt);process.removeListener('SIGTERM',onTerm);
}
if(!process.exitCode)receipt('result=PASS');
