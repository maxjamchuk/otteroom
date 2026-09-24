import { TMDB_PRIMARY_TRANSLATION_SET } from './tmdb-primary-translations.ts';

const yaml = await (typeof Deno === 'undefined' ? import('yaml') : import('npm:yaml@2.9.0'));
const { isAlias, isMap, isScalar, isSeq, parseAllDocuments } = yaml;

export const ORDERINGS = Object.freeze(['vote_count_desc', 'average_rating_desc', 'popularity_desc', 'title_asc'] as const);
export type SelectionOrdering = (typeof ORDERINGS)[number];
export const GENRE_MODES = Object.freeze(['or', 'and'] as const);
export type SelectionGenreMode = (typeof GENRE_MODES)[number];

export type SelectionRules = Readonly<{
  ordering: SelectionOrdering;
  minimumVoteCount: number;
  minimumAverageRating: number | null;
  metadataLanguage: string;
  genreMode: SelectionGenreMode;
  agreementNumerator: number;
  agreementDenominator: number;
  ruleSetKind: 'configured_009_v1';
}>;

export const CONFIG_DIAGNOSTICS = Object.freeze([
  'CONFIG_EMPTY', 'CONFIG_MALFORMED', 'CONFIG_MULTIPLE_DOCUMENTS', 'CONFIG_DUPLICATE_KEY',
  'CONFIG_UNSAFE_YAML', 'CONFIG_ROOT', 'CONFIG_UNKNOWN_KEY', 'CONFIG_REQUIRED', 'CONFIG_NULL',
  'CONFIG_TYPE', 'CONFIG_VALUE', 'CONFIG_LANGUAGE', 'CONFIG_FRACTION',
  'CONFIG_PATH_NOT_FOUND', 'CONFIG_READ_DENIED', 'CONFIG_INTERNAL',
] as const);
export type ConfigDiagnostic = (typeof CONFIG_DIAGNOSTICS)[number];

export const CONFIG_FAILURE_KINDS = Object.freeze([
  'path_not_found', 'read_denied', 'empty_content', 'yaml_syntax', 'root_not_mapping',
  'unknown_key', 'missing_required_key', 'invalid_enum', 'invalid_number_range',
  'invalid_language', 'invalid_fraction', 'duplicate_or_unsupported_structure',
  'other_registered_internal_failure',
] as const);
export type ConfigFailureKind = (typeof CONFIG_FAILURE_KINDS)[number];

const DEFAULT_FAILURE_KIND: Record<ConfigDiagnostic, ConfigFailureKind> = {
  CONFIG_PATH_NOT_FOUND: 'path_not_found',
  CONFIG_READ_DENIED: 'read_denied',
  CONFIG_EMPTY: 'empty_content',
  CONFIG_MALFORMED: 'yaml_syntax',
  CONFIG_ROOT: 'root_not_mapping',
  CONFIG_UNKNOWN_KEY: 'unknown_key',
  CONFIG_REQUIRED: 'missing_required_key',
  CONFIG_VALUE: 'invalid_number_range',
  CONFIG_LANGUAGE: 'invalid_language',
  CONFIG_FRACTION: 'invalid_fraction',
  CONFIG_MULTIPLE_DOCUMENTS: 'duplicate_or_unsupported_structure',
  CONFIG_DUPLICATE_KEY: 'duplicate_or_unsupported_structure',
  CONFIG_UNSAFE_YAML: 'duplicate_or_unsupported_structure',
  CONFIG_NULL: 'duplicate_or_unsupported_structure',
  CONFIG_TYPE: 'duplicate_or_unsupported_structure',
  CONFIG_INTERNAL: 'other_registered_internal_failure',
};

export class SelectionRulesConfigError extends Error {
  readonly code: ConfigDiagnostic;
  readonly kind: ConfigFailureKind;
  constructor(code: ConfigDiagnostic, kind?: ConfigFailureKind) {
    const boundedCode = CONFIG_DIAGNOSTICS.includes(code) ? code : 'CONFIG_INTERNAL';
    super(boundedCode);
    this.name = 'SelectionRulesConfigError';
    this.code = boundedCode;
    this.kind = kind && CONFIG_FAILURE_KINDS.includes(kind) ? kind : DEFAULT_FAILURE_KIND[boundedCode];
  }
}

const FIELD_NAMES = new Set(['minimum_vote_count', 'metadata_language', 'ordering',
  'minimum_average_rating', 'genre_mode', 'larger_group_agreement']);

function fail(code: ConfigDiagnostic, kind?: ConfigFailureKind): never {
  throw new SelectionRulesConfigError(code, kind);
}

function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

type InspectableNode = {
  anchor?: unknown;
  tag?: unknown;
};

function inspectNode(node: unknown, root = false): void {
  if (!node || typeof node !== 'object') fail(root ? 'CONFIG_ROOT' : 'CONFIG_TYPE');
  const value = node as InspectableNode;
  if (isAlias(value) || value.anchor !== undefined || value.tag !== undefined) fail('CONFIG_UNSAFE_YAML');
  if (isSeq(value)) fail(root ? 'CONFIG_ROOT' : 'CONFIG_TYPE');
  if (isMap(value)) {
    for (const pair of value.items) {
      if (!isScalar(pair.key) || typeof pair.key.value !== 'string') fail('CONFIG_UNKNOWN_KEY');
      inspectNode(pair.value);
    }
    return;
  }
  if (!isScalar(value)) fail('CONFIG_TYPE');
  if (value.value === null) fail('CONFIG_NULL');
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function exactFraction(value: unknown): readonly [number, number] {
  if (typeof value !== 'string' || !/^[0-9]+\/[0-9]+$/.test(value)) fail('CONFIG_FRACTION');
  const [pText, qText] = value.split('/');
  try {
    const p = BigInt(pText); const q = BigInt(qText);
    if (p <= 0n || q <= 0n || p > q) fail('CONFIG_FRACTION');
    const divisor = gcd(p, q); const numerator = p / divisor; const denominator = q / divisor;
    if (numerator > 2147483647n || denominator > 2147483647n) fail('CONFIG_FRACTION');
    return [Number(numerator), Number(denominator)];
  } catch { fail('CONFIG_FRACTION'); }
}

function plainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}

export function parseSelectionRules(source: string): SelectionRules {
  if (typeof source !== 'string' || !source.trim()) fail('CONFIG_EMPTY');
  let documents;
  try { documents = parseAllDocuments(source, { uniqueKeys: true, version: '1.2' }); }
  catch { fail('CONFIG_INTERNAL'); }
  if (documents.length !== 1) fail('CONFIG_MULTIPLE_DOCUMENTS');
  const document = documents[0];
  const duplicate = document.errors.some(error => /unique|duplicate/i.test(error.message));
  if (document.errors.length) fail(duplicate ? 'CONFIG_DUPLICATE_KEY' : 'CONFIG_MALFORMED');
  inspectNode(document.contents, true);
  let raw: unknown;
  try { raw = document.toJS(); } catch { fail('CONFIG_INTERNAL'); }
  if (!plainObject(raw)) fail('CONFIG_ROOT');
  const keys = Object.keys(raw);
  if (keys.some(key => !FIELD_NAMES.has(key))) fail('CONFIG_UNKNOWN_KEY');
  if (!Object.hasOwn(raw, 'minimum_vote_count') || !Object.hasOwn(raw, 'metadata_language')) fail('CONFIG_REQUIRED');

  const minimumVoteCount = raw.minimum_vote_count;
  if (typeof minimumVoteCount !== 'number' || !Number.isSafeInteger(minimumVoteCount) || minimumVoteCount < 0) fail('CONFIG_VALUE');
  const metadataLanguage = raw.metadata_language;
  if (typeof metadataLanguage !== 'string') fail('CONFIG_TYPE');
  if (!TMDB_PRIMARY_TRANSLATION_SET.has(metadataLanguage)) fail('CONFIG_LANGUAGE');

  const ordering = raw.ordering === undefined ? 'vote_count_desc' : raw.ordering;
  if (typeof ordering !== 'string' || !ORDERINGS.includes(ordering as SelectionOrdering)) fail('CONFIG_VALUE', 'invalid_enum');
  let minimumAverageRating: number | null = null;
  if (Object.hasOwn(raw, 'minimum_average_rating')) {
    if (raw.minimum_average_rating === null) fail('CONFIG_NULL');
    if (typeof raw.minimum_average_rating !== 'number' || !Number.isFinite(raw.minimum_average_rating) ||
        raw.minimum_average_rating < 0 || raw.minimum_average_rating > 10) fail('CONFIG_VALUE');
    minimumAverageRating = raw.minimum_average_rating;
  }
  const genreMode = raw.genre_mode === undefined ? 'or' : raw.genre_mode;
  if (typeof genreMode !== 'string' || !GENRE_MODES.includes(genreMode as SelectionGenreMode)) fail('CONFIG_VALUE', 'invalid_enum');
  const [agreementNumerator, agreementDenominator] = raw.larger_group_agreement === undefined
    ? [2, 3] as const : exactFraction(raw.larger_group_agreement);
  return freezeDeep({ ordering: ordering as SelectionOrdering, minimumVoteCount,
    minimumAverageRating, metadataLanguage, genreMode: genreMode as SelectionGenreMode,
    agreementNumerator, agreementDenominator, ruleSetKind: 'configured_009_v1' as const });
}
