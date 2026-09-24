/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';

// Deliberately checks only the two approved scalar settings, not a new TOML
// subsystem. The real CLI loads the entire TOML at the Phase 2 startup gate.
function validateLocalAuth(source: string) {
  const required = new Map([
    ['auth.enable_anonymous_sign_ins', 'true'],
    ['auth.rate_limit.anonymous_users', '150'],
  ]);
  const sections = new Set<string>(), values = new Map<string, string>();
  let section = '';
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const header = /^\[([\w.-]+)\]\s*(?:#.*)?$/.exec(line);
    if (header) {
      section = header[1];
      if (sections.has(section)) throw new Error('Duplicate section');
      sections.add(section);
      continue;
    }
    const assignment = /^(\w+)\s*=\s*([^#]*?)(?:\s*#.*)?$/.exec(line);
    if (!assignment) continue;
    const key = `${section}.${assignment[1]}`;
    if (values.has(key)) throw new Error('Duplicate setting');
    values.set(key, assignment[2].trim());
  }
  for (const [key, expected] of required) {
    if (values.get(key) !== expected) throw new Error(`Invalid local setting: ${key}`);
  }
}

const canonical = fs.readFileSync(path.join(process.cwd(), 'supabase/config.toml'), 'utf8');
const fixture = '[auth]\nenable_anonymous_sign_ins = true\n[auth.rate_limit]\nanonymous_users = 150\n';

it('keeps destructive migration fixtures outside normal recursive pgTAP discovery', () => {
  const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  expect(manifest.scripts['db:test']).toBe('node scripts/supabase-cli.mjs test db supabase/tests/database');
  expect(manifest.scripts['db:reset']).toBe('node scripts/supabase-cli.mjs db reset');
  expect(manifest.scripts.edge).toBe('node scripts/supabase-cli.mjs functions serve room-candidate --env-file supabase/functions/.env.local');
  const suites = fs.readdirSync('supabase/tests/database', { recursive: true });
  expect(suites.filter(name => String(name).endsWith('.sql')).sort()).toEqual([
    'candidate_progression.test.sql','common_filter_resolution.test.sql', 'participant_filter_concurrency.test.sql',
    'room_candidate.test.sql', 'room_session.test.sql', 'selection_rules.test.sql', 'swipe_decisions.test.sql',
    'tmdb_candidate_source.test.sql',
  ]);
  for (const phase of ['before', 'after']) {
    for (const feature of ['room_membership','participant_filters','common_filter_resolution']) {
      expect(fs.existsSync(`supabase/tests/migration/${feature}.${phase}.sql`)).toBe(true);
    }
  }
});

describe('committed local Supabase Auth policy', () => {
  it('validates actual local config and numeric quota', () => {
    expect(() => validateLocalAuth(canonical)).not.toThrow();
  });
  it('accepts whitespace, CRLF, and comments without reading commented values', () => {
    expect(() => validateLocalAuth(fixture.replaceAll('\n', '\r\n') + '# anonymous_users = 30\n')).not.toThrow();
    expect(() => validateLocalAuth(fixture.replace('150', '150 # local only'))).not.toThrow();
  });
  it.each([
    fixture.replace('enable_anonymous_sign_ins = true\n', ''),
    fixture.replace('anonymous_users = 150\n', ''),
    fixture.replace('true', 'false'),
    fixture.replace('150', '30'),
    fixture.replace('150', '"150"'),
    fixture.replace('true', '"true"'),
    fixture.replace('[auth]', '[auth.email]'),
    fixture.replace('[auth.rate_limit]', '[unrelated.rate_limit]'),
    fixture.replace('anonymous_users = 150', '# anonymous_users = 150'),
    fixture.replace('anonymous_users = 150', 'anonymous_users = 150\nanonymous_users = 150'),
    fixture.replace('enable_anonymous_sign_ins = true', 'enable_anonymous_sign_ins = true\nenable_anonymous_sign_ins = false'),
    fixture + '[auth.rate_limit]\nanonymous_users = 150\n',
  ])('rejects missing, disabled, duplicated, wrongly typed or misplaced config %#', source => {
    expect(() => validateLocalAuth(source)).toThrow();
  });
  it('never mutates the canonical file while testing altered fixtures', () => {
    expect(fs.readFileSync('supabase/config.toml', 'utf8') === canonical).toBe(true);
  });

  it('routes isolated T072 Supabase state through a distinct project/workdir', () => {
    const runtime = fs.readFileSync('scripts/local-supabase.mjs', 'utf8');
    const provisioner = fs.readFileSync('scripts/t072-isolated-supabase.mjs', 'utf8');
    for (const source of [runtime, provisioner]) {
      expect(source).toContain('OTTEROOM_SUPABASE_PROJECT_ID');
      expect(source).toContain('OTTEROOM_SUPABASE_WORKDIR');
      expect(source).toContain('otteroom-t072-supabase-');
    }
    expect(runtime).toContain("'--workdir', runtime.workdir");
    expect(provisioner).toContain("'stop', '--project-id', project, '--no-backup'");
    for (const file of [
      'scripts/check-room-membership-migration.mjs',
      'scripts/check-participant-filters-migration.mjs',
      'scripts/check-common-filter-resolution-migration.mjs',
      'scripts/check-tmdb-candidate-migration.mjs',
      'scripts/check-swipe-decisions-migration.mjs',
      'scripts/check-candidate-progression-migration.mjs',
      'scripts/check-selection-rules-migration.mjs',
    ]) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source).not.toContain('supabase_db_otteroom-room-session');
      expect(source).toContain('localSupabaseContainer');
      expect(source).toContain('localSupabaseArgs');
    }
    for (const file of [
      'e2e/support/room-harness.ts',
      'e2e/support/decision-harness.ts',
    ]) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source).not.toContain('supabase_db_otteroom-room-session');
      expect(source).toContain('localSupabaseContainer');
    }
  });
});
