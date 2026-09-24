import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const canonicalPath = path.join(root, 'config/selection-rules.yaml');
const configPath = path.join(root, 'supabase/config.toml');
const safeFail = () => { throw new Error('SELECTION_RULES_CONFIG_CHECK_FAILED'); };
const receipt = value => process.stdout.write(`SELECTION_RULES_CONFIG ${value}\n`);

try {
  const canonical = await fs.readFile(canonicalPath);
  if (!canonical.length) safeFail();
  const config = await fs.readFile(configPath, 'utf8');
  const asset = './functions/_shared/selection-rules.yaml';
  const bundledPath = path.join(root, 'supabase/functions/_shared/selection-rules.yaml');
  const link = await fs.lstat(bundledPath);
  if (!link.isSymbolicLink() || await fs.readlink(bundledPath) !== '../../../config/selection-rules.yaml') safeFail();
  for (const functionName of ['room-create', 'room-candidate']) {
    const section = new RegExp(`\\[functions\\.${functionName.replace('-', '\\-')}\\]([\\s\\S]*?)(?=\\n\\[|$)`).exec(config)?.[1] ?? '';
    if (!/entrypoint\s*=\s*"\.\/functions\//.test(section) || !section.includes(`static_files = ["${asset}"]`)) safeFail();
  }
  if ((config.match(/static_files\s*=\s*\["\.\/functions\/_shared\/selection-rules\.yaml"\]/g) ?? []).length !== 2) safeFail();
  const clientFiles = [];
  for (const base of ['src', 'app', 'assets']) {
    const entries = await fs.readdir(path.join(root, base), { recursive: true });
    clientFiles.push(...entries.filter(entry => typeof entry === 'string' && entry !== 'types/database.generated.ts' &&
      /\.(ts|tsx|js|json|html|css|png|svg)$/.test(entry)).map(entry => path.join(root, base, entry)));
  }
  for (const file of clientFiles) {
    const content = await fs.readFile(file).catch(() => Buffer.alloc(0));
    if (content.includes(Buffer.from('selection-rules.yaml')) || content.includes(Buffer.from('minimum_vote_count'))) safeFail();
  }
  const envFiles = [path.join(root, '.env.example'), path.join(root, 'supabase/functions/.env.local')];
  for (const file of envFiles) {
    const content = await fs.readFile(file, 'utf8').catch(() => '');
    if (/SELECTION|RULE_SET|MINIMUM_VOTE|METADATA_LANGUAGE|GENRE_MODE|AGREEMENT/.test(content)) safeFail();
  }
  const bundled = await fs.readFile(bundledPath);
  if (!bundled.equals(canonical)) safeFail();
  receipt(`canonical-bytes=${canonical.length} assets=2 byte-identical=true client-inclusion=false env-overrides=false`);
} catch {
  process.stderr.write('SELECTION_RULES_CONFIG_CHECK_FAILED\n');
  process.exitCode = 1;
}
