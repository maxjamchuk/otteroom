import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const defaultProject = 'otteroom-room-session';
const projectPattern = /^[a-z][a-z0-9-]{0,62}$/;
const isolatedPrefix = path.join(os.tmpdir(), 'otteroom-t072-supabase-');

export function localSupabaseRuntime(environment = process.env) {
  const project = environment.OTTEROOM_SUPABASE_PROJECT_ID ?? defaultProject;
  const configuredWorkdir = environment.OTTEROOM_SUPABASE_WORKDIR;
  if (!projectPattern.test(project)) throw new Error('LOCAL_SUPABASE_RUNTIME_INVALID');
  if (!configuredWorkdir) {
    if (project !== defaultProject) throw new Error('LOCAL_SUPABASE_RUNTIME_INVALID');
    return { project, workdir: root, isolated: false };
  }
  const workdir = path.resolve(configuredWorkdir);
  if (project === defaultProject || !workdir.startsWith(isolatedPrefix) ||
      !fs.existsSync(path.join(workdir, 'supabase', 'config.toml'))) {
    throw new Error('LOCAL_SUPABASE_RUNTIME_INVALID');
  }
  return { project, workdir, isolated: true };
}

export function localSupabaseArgs(args, environment = process.env) {
  const runtime = localSupabaseRuntime(environment);
  return runtime.isolated ? [...args, '--workdir', runtime.workdir] : [...args];
}

export function localSupabaseContainer(environment = process.env) {
  return `supabase_db_${localSupabaseRuntime(environment).project}`;
}

export function localSupabaseConfig(environment = process.env) {
  return path.join(localSupabaseRuntime(environment).workdir, 'supabase', 'config.toml');
}

export { defaultProject, isolatedPrefix };
