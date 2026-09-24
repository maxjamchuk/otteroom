// Source-attributed snapshot of TMDB's officially supported primary
// translation tags. Refresh this list only as a deliberate code/deploy change.
// Source: https://developer.themoviedb.org/reference/configuration-primary-translations
export const TMDB_PRIMARY_TRANSLATIONS_SOURCE =
  'https://developer.themoviedb.org/reference/configuration-primary-translations';
export const TMDB_PRIMARY_TRANSLATIONS_SNAPSHOT = '2026-09-21';

export const TMDB_PRIMARY_TRANSLATIONS = Object.freeze([
  'ar-AE', 'ar-SA', 'be-BY', 'bg-BG', 'bn-BD', 'ca-ES', 'ch-GU', 'cn-CN',
  'cs-CZ', 'da-DK', 'de-AT', 'de-CH', 'de-DE', 'el-GR', 'en-AU', 'en-CA',
  'en-GB', 'en-IE', 'en-NZ', 'en-US', 'eo-EO', 'es-ES', 'es-MX', 'et-EE',
  'eu-ES', 'fa-IR', 'fi-FI', 'fr-CA', 'fr-FR', 'gl-ES', 'he-IL', 'hi-IN',
  'hu-HU', 'id-ID', 'it-IT', 'ja-JP', 'ka-GE', 'kk-KZ', 'kn-IN', 'ko-KR',
  'lt-LT', 'lv-LV', 'ml-IN', 'ms-MY', 'ms-SG', 'nb-NO', 'nl-NL', 'no-NO',
  'pl-PL', 'pt-BR', 'pt-PT', 'ro-RO', 'ru-RU', 'si-LK', 'sk-SK', 'sl-SI',
  'sq-AL', 'sr-RS', 'sv-SE', 'ta-IN', 'te-IN', 'th-TH', 'tl-PH', 'tr-TR',
  'uk-UA', 'vi-VN', 'zh-CN', 'zh-HK', 'zh-TW', 'zu-ZA',
] as const);

export const TMDB_PRIMARY_TRANSLATION_SET = new Set<string>(TMDB_PRIMARY_TRANSLATIONS);
