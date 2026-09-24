/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Feature 009 server-only boundary', () => {
  test('canonical configuration exists only in the server config location', () => {
    expect(fs.existsSync(path.join(root, 'config/selection-rules.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'src/config/selection-rules.yaml'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'app/config'))).toBe(false);
  });

  test('client source does not import or project selection rules', () => {
    const files = fs.readdirSync(path.join(root, 'src'), { recursive: true })
      .filter(file => typeof file === 'string' && /\.(ts|tsx)$/.test(file) && file !== 'types/database.generated.ts') as string[];
    // The generated public contract is intentionally checked separately; it
    // must expose the server RPC signatures without bundling operator config.
    for (const file of files) {
      const source = read(path.join('src', file));
      expect(source).not.toMatch(/selection-rules|room_selection_rules|minimum_vote_count|agreement_(numerator|denominator)/);
    }
  });

  test('client artifacts contain no Match/configuration UI or selection-rule environment key', () => {
    const files = fs.readdirSync(path.join(root, 'app'), { recursive: true })
      .filter(file => typeof file === 'string' && /\.(ts|tsx)$/.test(file)) as string[];
    for (const file of files) {
      const source = read(path.join('app', file));
      expect(source).not.toMatch(/selection[- ]rules?|room_selection_rules|minimum_vote_count|agreement_(numerator|denominator)|\bMatch\b|feature[ -]?010/i);
    }
    expect(read('.env.example')).not.toMatch(/SELECTION|RULE|ORDERING|VOTE_COUNT/);
  });

  test('diagnostic source uses fixed safe outcome vocabulary', () => {
    const edgeFiles = fs.readdirSync(path.join(root, 'supabase/functions'), { recursive: true })
      .filter(file => typeof file === 'string' && /\.ts$/.test(file)) as string[];
    for (const file of edgeFiles) {
      const source = read(path.join('supabase/functions', file));
      expect(source).not.toMatch(/console\.(log|error)\([^\n]*(minimum_vote_count|metadata_language|selection-rules\.yaml)/);
    }
  });

  test('Edge YAML parser selects the pinned Deno package while retaining Node test compatibility', () => {
    const parser = read('supabase/functions/_shared/selection-rules.ts');
    const manifest = JSON.parse(read('package.json')) as { dependencies?: { yaml?: string } };
    expect(manifest.dependencies?.yaml).toBe('2.9.0');
    expect(parser).toMatch(/typeof Deno === 'undefined' \? import\('yaml'\) : import\('npm:yaml@2\.9\.0'\)/);
  });

  test('Edge static asset stays inside the supported function bundle without a second config copy', () => {
    const asset = path.join(root, 'supabase/functions/_shared/selection-rules.yaml');
    const canonical = path.join(root, 'config/selection-rules.yaml');
    expect(fs.lstatSync(asset).isSymbolicLink()).toBe(true);
    expect(fs.readlinkSync(asset)).toBe('../../../config/selection-rules.yaml');
    expect(fs.readFileSync(asset)).toEqual(fs.readFileSync(canonical));
    const config = read('supabase/config.toml');
    expect(config.match(/static_files\s*=\s*\["\.\/functions\/_shared\/selection-rules\.yaml"\]/g)).toHaveLength(2);
    expect(read('supabase/functions/_shared/selection-rules-config.ts')).toContain(
      "new URL('./selection-rules.yaml', import.meta.url)");
  });
});
