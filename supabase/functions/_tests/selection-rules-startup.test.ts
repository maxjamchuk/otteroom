import { assert, assertEquals } from './assert.ts';
import { initializeSelectionRules, startSelectionRulesRuntime } from '../_shared/selection-rules-config.ts';

const valid = 'minimum_vote_count: 3\nmetadata_language: en-US\nordering: title_asc\n';

Deno.test('startup parses before handler construction and exposes only one frozen generation', async () => {
  let constructed = false;
  const result = await initializeSelectionRules(async () => valid, rules => {
    constructed = true;
    return { rules, marker: 'constructed' };
  });
  assert(constructed);
  assertEquals(result.marker, 'constructed');
  assertEquals(result.rules.ordering, 'title_asc');
  assert(Object.isFrozen(result.rules));

  let reads = 0;
  const runtime = await startSelectionRulesRuntime(async () => { reads++; return valid; });
  assertEquals(reads, 1);
  const before = runtime.getRules();
  assertEquals(runtime.getRules(), before);
  assertEquals(reads, 1);
  assertEquals(runtime.getRules().minimumVoteCount, 3);
});

Deno.test('invalid startup prevents construction and has no last-known-good fallback or override', async () => {
  let constructed = false;
  let rejected = false;
  try {
    await initializeSelectionRules(async () => 'minimum_vote_count: -1\nmetadata_language: en-US\n', () => {
      constructed = true;
      return true;
    });
  } catch { rejected = true; }
  assert(rejected);
  assertEquals(constructed, false);
});

Deno.test('room-create and room-candidate startup receives the same normalized generation after reconstruction', async () => {
  const source = async () => valid;
  const [create, candidate] = await Promise.all([
    initializeSelectionRules(source), initializeSelectionRules(source),
  ]);
  assertEquals(create, candidate);
  assert(Object.isFrozen(create));
});
