/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
};
const supabaseConfig = fs.readFileSync(path.join(root, 'supabase/config.toml'), 'utf8');
const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
const expoConfig = fs.readFileSync(path.join(root, 'app.json'), 'utf8');
const edgeSource = fs.readFileSync(path.join(root, 'supabase/functions/room-candidate/index.ts'), 'utf8');

it('provides the reviewed Feature 006 zero-secret commands and a reproducible Deno 2 runtime', () => {
  expect(manifest.scripts['test:edge']).toBe('deno test --allow-env --allow-read=config,supabase/functions --allow-net=127.0.0.1 supabase/functions/_tests');
  expect(manifest.scripts['test:tmdb:contract']).toBe('node scripts/run-tmdb-contract.mjs');
  expect(manifest.scripts['test:e2e:feature006']).toBe('node scripts/run-e2e.mjs feature006');
  expect(manifest.scripts['test:e2e:feature009']).toBe('node scripts/run-e2e.mjs feature009');
  expect(manifest.devDependencies.deno).toMatch(/^2\./);
});

it('enables only the authenticated room-candidate Edge boundary with JWT verification', () => {
  expect(supabaseConfig).toMatch(/\[edge_runtime\][\s\S]*?enabled\s*=\s*true/);
  expect(supabaseConfig).toMatch(/\[functions\.room-candidate\][\s\S]*?verify_jwt\s*=\s*true/);
});

it('documents server-only names and keeps local function secrets ignored', () => {
  expect(envExample).toContain('TMDB_API_READ_ACCESS_TOKEN=');
  expect(envExample).toContain('SUPABASE_SERVICE_ROLE_KEY=');
  const ignored = fs.readFileSync(path.join(root, 'supabase/.gitignore'), 'utf8');
  expect(ignored).toMatch(/functions\/\.env/);
  expect(ignored).toMatch(/\.env\.local/);
});

it('keeps ordinary Expo configuration on the exact public Supabase allowlist', () => {
  const publicNames = [...`${envExample}\n${expoConfig}`.matchAll(/EXPO_PUBLIC_[A-Z0-9_]+/g)]
    .map(match => match[0]);
  expect([...new Set(publicNames)].sort()).toEqual([
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'EXPO_PUBLIC_SUPABASE_URL',
  ]);
  expect(`${envExample}\n${expoConfig}`).not.toMatch(/EXPO_PUBLIC_.*(?:TMDB|SERVICE_ROLE|SECRET)/);
});

it('limits Edge database access to the three RPC names and keeps the TMDB token out of URLs',()=>{
  expect(edgeSource).not.toMatch(/\.from\s*\(|\/rest\/v1\/(?!rpc\/)|[?&](?:api_key|access_token)=/);
  for(const name of ['prepare_room_tmdb_candidate','commit_room_tmdb_candidate','commit_room_tmdb_no_candidates'])
    expect(edgeSource).toContain(name);
  expect(edgeSource.match(/'prepare_room_tmdb_candidate'|'commit_room_tmdb_candidate'|'commit_room_tmdb_no_candidates'/g)?.length)
    .toBeGreaterThanOrEqual(6);
});
