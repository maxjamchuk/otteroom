import { assert, assertEquals, assertFalse, assertThrows } from './assert.ts';
import { acceptedSelectionRules, rejectedSelectionRules, safeDiagnosticForbiddenFragments } from './fixtures/selection-rules.ts';
import { parseSelectionRules, SelectionRulesConfigError, CONFIG_FAILURE_KINDS } from '../_shared/selection-rules.ts';
import { classifySelectionRulesReadFailure } from '../_shared/selection-rules-config.ts';

Deno.test('strict parser accepts complete and approved-omission vectors', () => {
  for (const vector of acceptedSelectionRules) {
    const parsed = parseSelectionRules(vector.yaml);
    assertEquals({
      ordering: parsed.ordering, minimumVoteCount: parsed.minimumVoteCount,
      minimumAverageRating: parsed.minimumAverageRating, metadataLanguage: parsed.metadataLanguage,
      genreMode: parsed.genreMode, agreementNumerator: parsed.agreementNumerator,
      agreementDenominator: parsed.agreementDenominator,
    }, vector.expected);
    assert(Object.isFrozen(parsed));
    assert(Object.isFrozen(parsed) && Object.keys(parsed).length === 8);
  }
});

Deno.test('strict parser rejects every malformed, unsafe and invalid vector with fixed diagnostics', () => {
  for (const vector of rejectedSelectionRules) {
    try { parseSelectionRules(vector.yaml); } catch (error) {
      assert(error instanceof SelectionRulesConfigError, `${vector.name} did not use safe config error`);
      assertEquals((error as SelectionRulesConfigError).code, vector.diagnostic);
      const message = error instanceof Error ? error.message : String(error);
      for (const forbidden of safeDiagnosticForbiddenFragments) assertFalse(message.includes(forbidden));
      continue;
    }
    throw new Error(`expected ${vector.name} to be rejected`);
  }
});

Deno.test('parser rejects aliases, anchors, custom tags, duplicate keys and explicit null independently', () => {
  for (const yaml of [
    'minimum_vote_count: 1\nmetadata_language: en-US\nordering: &ordering vote_count_desc\n',
    'minimum_vote_count: 1\nmetadata_language: en-US\nordering: *ordering\n',
    'minimum_vote_count: !env 1\nmetadata_language: en-US\n',
    'minimum_vote_count: 1\nmetadata_language: en-US\nminimum_vote_count: 1\n',
    'minimum_vote_count: 1\nmetadata_language: en-US\nminimum_average_rating: null\n',
  ]) assertThrows(() => parseSelectionRules(yaml));
});

Deno.test('fraction normalization is exact and deep freezing prevents mutation', () => {
  const parsed = parseSelectionRules('minimum_vote_count: 3\nmetadata_language: en-US\nlarger_group_agreement: 12/18\n');
  assertEquals([parsed.agreementNumerator, parsed.agreementDenominator], [2, 3]);
  assertThrows(() => { (parsed as { ordering: string }).ordering = 'title_asc'; });
});

Deno.test('config diagnostics use closed failure kinds for every parser and loader stage', () => {
  const cases = [
    ['', 'empty_content'],
    ['minimum_vote_count: [', 'yaml_syntax'],
    ['- item\n', 'root_not_mapping'],
    ['minimum_vote_count: 1\nmetadata_language: en-US\nunknown: 1\n', 'unknown_key'],
    ['metadata_language: en-US\n', 'missing_required_key'],
    ['minimum_vote_count: 1\nmetadata_language: en-US\nordering: unknown\n', 'invalid_enum'],
    ['minimum_vote_count: -1\nmetadata_language: en-US\n', 'invalid_number_range'],
    ['minimum_vote_count: 1\nmetadata_language: zz-ZZ\n', 'invalid_language'],
    ['minimum_vote_count: 1\nmetadata_language: en-US\nlarger_group_agreement: 0/1\n', 'invalid_fraction'],
    ['minimum_vote_count: 1\nminimum_vote_count: 2\nmetadata_language: en-US\n', 'duplicate_or_unsupported_structure'],
  ] as const;
  const observed = new Set<string>();
  for (const [source, expected] of cases) {
    try { parseSelectionRules(source); } catch (error) {
      assert(error instanceof SelectionRulesConfigError);
      assertEquals(error.kind, expected);
      observed.add(error.kind);
      assert(CONFIG_FAILURE_KINDS.includes(error.kind));
      assertEquals(error.message, error.code);
      continue;
    }
    throw new Error('expected invalid test config to fail');
  }
  const privatePath = '/private/host/credential-vault/selection-rules.yaml';
  for (const [cause, expected] of [
    [{ name: 'NotFound', message: privatePath }, 'path_not_found'],
    [{ code: 'ENOENT', message: privatePath }, 'path_not_found'],
    [{ name: 'NotCapable', message: privatePath }, 'read_denied'],
    [{ code: 'EACCES', message: privatePath }, 'read_denied'],
    [{ name: 'OtherFailure', message: privatePath }, 'other_registered_internal_failure'],
  ] as const) {
    const error = classifySelectionRulesReadFailure(cause);
    assertEquals(error.kind, expected);
    observed.add(error.kind);
    assertEquals(error.message, error.code);
    assertFalse(error.message.includes(privatePath));
    assertFalse(JSON.stringify({ code: error.code, kind: error.kind }).includes(privatePath));
  }
  assertEquals([...observed].sort(), [...CONFIG_FAILURE_KINDS].sort());
  const unregistered = new SelectionRulesConfigError('HOST_SECRET' as SelectionRulesConfigError['code'],
    privatePath as SelectionRulesConfigError['kind']);
  assertEquals(unregistered.code, 'CONFIG_INTERNAL');
  assertEquals(unregistered.kind, 'other_registered_internal_failure');
  assertFalse(unregistered.message.includes(privatePath));
});
