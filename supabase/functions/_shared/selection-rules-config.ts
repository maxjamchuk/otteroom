import { parseSelectionRules, SelectionRulesConfigError, type SelectionRules } from './selection-rules.ts';
import { readFile } from 'node:fs/promises';

export type ConfigTextReader = () => Promise<string>;
export type SelectionRulesConstruction<T> = (rules: SelectionRules) => T;

const bundledConfigUrl = new URL('./selection-rules.yaml', import.meta.url);

export function classifySelectionRulesReadFailure(error: unknown): SelectionRulesConfigError {
  const value = error as { name?: unknown; code?: unknown } | null;
  const name = typeof value?.name === 'string' ? value.name : '';
  const code = typeof value?.code === 'string' ? value.code : '';
  if (name === 'NotFound' || code === 'ENOENT') return new SelectionRulesConfigError('CONFIG_PATH_NOT_FOUND');
  if (name === 'NotCapable' || name === 'PermissionDenied' || code === 'EACCES' || code === 'EPERM') {
    return new SelectionRulesConfigError('CONFIG_READ_DENIED');
  }
  return new SelectionRulesConfigError('CONFIG_INTERNAL');
}

export async function readBundledSelectionRulesText(): Promise<string> {
  try {
    if (typeof Deno !== 'undefined') return await Deno.readTextFile(bundledConfigUrl);
    // Node-only test/import compatibility; deployed Edge always takes the
    // bundled Deno asset path above and has no environment or request override.
    return await readFile(bundledConfigUrl, 'utf8');
  } catch (error) {
    throw classifySelectionRulesReadFailure(error);
  }
}

export async function initializeSelectionRules<T = SelectionRules>(reader: ConfigTextReader = readBundledSelectionRulesText,
  construct: SelectionRulesConstruction<T> = rules => rules as T): Promise<T> {
  const rules = parseSelectionRules(await reader());
  return construct(rules);
}

export type SelectionRulesRuntime = Readonly<{ getRules(): SelectionRules }>;

export async function startSelectionRulesRuntime(reader: ConfigTextReader = readBundledSelectionRulesText): Promise<SelectionRulesRuntime> {
  const rules = await initializeSelectionRules(reader);
  return Object.freeze({ getRules: () => rules });
}
