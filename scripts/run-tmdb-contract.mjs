import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));

export function validateTmdbContractEnvironment(environment=process.env){
  const token=environment.TMDB_API_READ_ACCESS_TOKEN;
  if(typeof token!=='string'||token.length<20||Object.keys(environment).some(name=>
      /^EXPO_PUBLIC_.*(?:TMDB|SERVICE_ROLE|SECRET)/.test(name))||Object.hasOwn(environment,'TMDB_API_BASE_URL'))
    throw new Error('TMDB_API_READ_ACCESS_TOKEN_REQUIRED');
  return token;
}

export async function runTmdbContract(environment=process.env){
  const token=validateTmdbContractEnvironment(environment);
  const command=path.join(root,'node_modules','.bin','deno');
  return await new Promise(resolve=>{
    const child=spawn(command,['test','--allow-env=TMDB_API_READ_ACCESS_TOKEN',
      '--allow-net=api.themoviedb.org','supabase/functions/_tests/live-tmdb-contract.test.ts'],{
      cwd:root,env:{...environment,TMDB_API_READ_ACCESS_TOKEN:token},stdio:['ignore','pipe','pipe']});
    let timer=setTimeout(()=>{child.kill('SIGTERM');},60000);
    child.stdout.resume();child.stderr.resume();
    child.once('error',()=>{clearTimeout(timer);resolve(1);});
    child.once('close',code=>{clearTimeout(timer);resolve(code===0?0:1);});
  });
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{const status=await runTmdbContract();process.stdout.write(JSON.stringify({component:'tmdb-contract',
    status:status===0?'passed':'failed'})+'\n');process.exitCode=status;}
  catch{process.stderr.write('TMDB_API_READ_ACCESS_TOKEN_REQUIRED\n');process.exitCode=1;}
}
