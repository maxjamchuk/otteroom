export type SelectionRulesVector = Readonly<{
  name: string;
  yaml: string;
  expected?: Readonly<Record<string, unknown>>;
  diagnostic?: string;
}>;

// These vectors deliberately use test-only values. They are shared by the
// parser/startup tests and never replace the approved deployed YAML generation.
export const acceptedSelectionRules: readonly SelectionRulesVector[] = Object.freeze([
  {
    name: 'complete test generation',
    yaml: [
      'minimum_vote_count: 17',
      'metadata_language: fr-FR',
      'ordering: popularity_desc',
      'minimum_average_rating: 7.25',
      'genre_mode: and',
      'larger_group_agreement: 4/7',
      '',
    ].join('\n'),
    expected: {
      ordering: 'popularity_desc', minimumVoteCount: 17, minimumAverageRating: 7.25,
      metadataLanguage: 'fr-FR', genreMode: 'and', agreementNumerator: 4,
      agreementDenominator: 7,
    },
  },
  {
    name: 'approved optional omissions',
    yaml: ['minimum_vote_count: 1', 'metadata_language: en-US', ''].join('\n'),
    expected: {
      ordering: 'vote_count_desc', minimumVoteCount: 1, minimumAverageRating: null,
      metadataLanguage: 'en-US', genreMode: 'or', agreementNumerator: 2,
      agreementDenominator: 3,
    },
  },
  {
    name: 'equivalent fraction reduces exactly',
    yaml: ['minimum_vote_count: 2', 'metadata_language: de-DE',
      'larger_group_agreement: 12/18', ''].join('\n'),
    expected: {
      ordering: 'vote_count_desc', minimumVoteCount: 2, minimumAverageRating: null,
      metadataLanguage: 'de-DE', genreMode: 'or', agreementNumerator: 2,
      agreementDenominator: 3,
    },
  },
]);

export const rejectedSelectionRules: readonly SelectionRulesVector[] = Object.freeze([
  { name: 'empty', yaml: '', diagnostic: 'CONFIG_EMPTY' },
  { name: 'malformed', yaml: 'minimum_vote_count: [', diagnostic: 'CONFIG_MALFORMED' },
  { name: 'multi document', yaml: 'minimum_vote_count: 1\n---\nmetadata_language: en-US\n', diagnostic: 'CONFIG_MULTIPLE_DOCUMENTS' },
  { name: 'duplicate key', yaml: 'minimum_vote_count: 1\nminimum_vote_count: 2\nmetadata_language: en-US\n', diagnostic: 'CONFIG_DUPLICATE_KEY' },
  { name: 'alias', yaml: 'base: &base 1\nminimum_vote_count: *base\nmetadata_language: en-US\n', diagnostic: 'CONFIG_UNSAFE_YAML' },
  { name: 'custom tag', yaml: 'minimum_vote_count: !secret 1\nmetadata_language: en-US\n', diagnostic: 'CONFIG_UNSAFE_YAML' },
  { name: 'non mapping root', yaml: '- minimum_vote_count\n- metadata_language\n', diagnostic: 'CONFIG_ROOT' },
  { name: 'unknown key', yaml: 'minimum_vote_count: 1\nmetadata_language: en-US\nwatched: true\n', diagnostic: 'CONFIG_UNKNOWN_KEY' },
  { name: 'explicit null', yaml: 'minimum_vote_count: 1\nmetadata_language: en-US\nminimum_average_rating: null\n', diagnostic: 'CONFIG_NULL' },
  { name: 'missing vote count', yaml: 'metadata_language: en-US\n', diagnostic: 'CONFIG_REQUIRED' },
  { name: 'missing language', yaml: 'minimum_vote_count: 1\n', diagnostic: 'CONFIG_REQUIRED' },
  { name: 'negative vote count', yaml: 'minimum_vote_count: -1\nmetadata_language: en-US\n', diagnostic: 'CONFIG_VALUE' },
  { name: 'fractional vote count', yaml: 'minimum_vote_count: 1.5\nmetadata_language: en-US\n', diagnostic: 'CONFIG_VALUE' },
  { name: 'non finite rating', yaml: 'minimum_vote_count: 1\nmetadata_language: en-US\nminimum_average_rating: .nan\n', diagnostic: 'CONFIG_VALUE' },
  { name: 'rating outside domain', yaml: 'minimum_vote_count: 1\nmetadata_language: en-US\nminimum_average_rating: 11\n', diagnostic: 'CONFIG_VALUE' },
  { name: 'unsupported ordering', yaml: 'minimum_vote_count: 1\nmetadata_language: en-US\nordering: release_date\n', diagnostic: 'CONFIG_VALUE' },
  { name: 'unsupported genre mode', yaml: 'minimum_vote_count: 1\nmetadata_language: en-US\ngenre_mode: xor\n', diagnostic: 'CONFIG_VALUE' },
  { name: 'unsupported language', yaml: 'minimum_vote_count: 1\nmetadata_language: zz-ZZ\n', diagnostic: 'CONFIG_LANGUAGE' },
  { name: 'malformed fraction', yaml: 'minimum_vote_count: 1\nmetadata_language: en-US\nlarger_group_agreement: 2 / 3\n', diagnostic: 'CONFIG_FRACTION' },
  { name: 'zero fraction', yaml: 'minimum_vote_count: 1\nmetadata_language: en-US\nlarger_group_agreement: 0/1\n', diagnostic: 'CONFIG_FRACTION' },
  { name: 'fraction greater than one', yaml: 'minimum_vote_count: 1\nmetadata_language: en-US\nlarger_group_agreement: 4/3\n', diagnostic: 'CONFIG_FRACTION' },
]);

export const safeDiagnosticForbiddenFragments = Object.freeze([
  'minimum_vote_count', 'minimum_average_rating', 'metadata_language', 'vote_count_desc',
  'fr-FR', '17', '7.25', '4/7', 'selection-rules.yaml',
]);
