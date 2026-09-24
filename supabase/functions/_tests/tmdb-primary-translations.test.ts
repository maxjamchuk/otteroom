import { assert, assertEquals, assertFalse } from './assert.ts';
import { TMDB_PRIMARY_TRANSLATIONS, TMDB_PRIMARY_TRANSLATION_SET,
  TMDB_PRIMARY_TRANSLATIONS_SOURCE, TMDB_PRIMARY_TRANSLATIONS_SNAPSHOT } from '../_shared/tmdb-primary-translations.ts';

Deno.test('primary translation snapshot is source-attributed, unique and canonical', () => {
  assert(TMDB_PRIMARY_TRANSLATIONS_SOURCE.startsWith('https://developer.themoviedb.org/'));
  assert(/^20\d\d-\d\d-\d\d$/.test(TMDB_PRIMARY_TRANSLATIONS_SNAPSHOT));
  assertEquals(new Set(TMDB_PRIMARY_TRANSLATIONS).size, TMDB_PRIMARY_TRANSLATIONS.length);
  assertEquals([...TMDB_PRIMARY_TRANSLATIONS].sort(), [...TMDB_PRIMARY_TRANSLATIONS]);
  for (const language of TMDB_PRIMARY_TRANSLATIONS) assert(/^[a-z]{2,3}-[A-Z]{2}$/.test(language));
});

Deno.test('supported and plausible-but-unsupported language values remain distinct', () => {
  for (const language of ['en-US', 'fr-FR', 'de-DE', 'ja-JP', 'kk-KZ']) assert(TMDB_PRIMARY_TRANSLATION_SET.has(language));
  for (const language of ['en-us', 'en', 'zz-ZZ', 'en-USA']) assertFalse(TMDB_PRIMARY_TRANSLATION_SET.has(language));
});
