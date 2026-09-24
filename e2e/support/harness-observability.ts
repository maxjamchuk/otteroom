export type HarnessDiagnostic = ContainmentDiagnostic | CandidateBoundaryDiagnostic |
  CandidateOverlapDiagnostic | FilterResolutionBoundaryDiagnostic |
  CandidateTerminalGuardDiagnostic | CandidateHealthGuardDiagnostic |
  CandidatePresentationDiagnostic;

export type CandidatePresentationDiagnostic = Readonly<{
  kind: 'candidate-presentation';
  presentationState: 'route-loading' | 'route-error' | 'route-other' |
    'metadata-loading' | 'metadata-request-failure' | 'metadata-recovery' |
    'stale-client-projection' | 'metadata-ready-card-missing' | 'heading-visible' |
    'acquisition-loading' | 'acquisition-failure' | 'poster-loading' |
    'poster-failure' | 'no-poster' | 'integrity-error' | 'exhausted' | 'agreed' |
    'other';
  routeView: 'room' | 'loading' | 'error' | 'malformed' | 'other';
  candidateAttempt: 'not-observed' | 'acquiring' | 'acquisition-error' |
    'loading-metadata' | 'metadata-error' | 'loading-poster' | 'poster-error' |
    'available' | 'no-poster' | 'no-candidates' | 'integrity-error';
  canonicalReadable: boolean;
  acquisitionStatus: 'pending' | 'assigned' | 'no_candidates' | 'unavailable';
  progressionStatus: 'inactive' | 'collecting' | 'advancing' | 'agreed' |
    'exhausted' | 'unavailable';
  candidateSequence: number | null;
  decisionCount: number | null;
  canonicalCandidateIdentityPresent: boolean;
  titleMetadataPresent: boolean;
  releaseYearMetadataPresent: boolean;
  posterMetadataPresent: boolean;
  metadataRequestState: 'none' | 'pending' | 'completed' | 'failed';
  metadataRequestAttemptCount: number;
  metadataRecoveryActive: boolean;
  metadataHttpStatusClass: 'none' | '2xx' | '4xx' | '5xx' | 'network' | 'other';
  metadataResultClass: 'none' | 'available' | 'metadata_unavailable' |
    'candidate_acquisition_unavailable' | 'other-success' | 'other-failure' |
    'unreadable';
  requestSequenceMatches: boolean | null;
  candidateCardExists: boolean;
  expectedHeadingExists: boolean;
  expectedHeadingVisible: boolean;
  expectedHeadingHidden: boolean;
  loadingSurfacePresent: boolean;
  errorSurfacePresent: boolean;
  exhaustedSurfacePresent: boolean;
  agreedSurfacePresent: boolean;
  clientProjectionStale: boolean;
}>;

type CandidatePresentationState = Omit<CandidatePresentationDiagnostic,
  'kind' | 'presentationState' | 'expectedHeadingHidden' | 'clientProjectionStale'>;

export type CandidateTerminalGuard = 'binding-present' | 'snapshot-readable' |
  'acquisition-status' | 'progression-status' | 'candidate-sequence' |
  'decision-count' | 'terminal-kind';

export type CandidateTerminalGuardDiagnostic = Readonly<{
  kind: 'candidate-terminal-guard';
  guard: CandidateTerminalGuard;
  expected: 'initial-empty' | 'exhausted';
  acquisitionStatus: 'pending' | 'assigned' | 'no_candidates' | 'unavailable';
  progressionStatus: 'inactive' | 'collecting' | 'advancing' | 'agreed' |
    'exhausted' | 'unavailable';
  candidateSequence: number | null;
  decisionCount: number | null;
  bindingPresent: boolean;
  snapshotReadable: boolean;
  acquisitionMatches: boolean;
  progressionMatches: boolean;
  sequenceMatches: boolean;
  decisionsZero: boolean;
  terminalKindMatches: boolean;
}>;

export type CandidateHealthGuard = 'request-origin' | 'request-method' |
  'request-shape' | 'request-room' | 'request-subject' | 'response-body' |
  'response-size' | 'response-json' | 'response-contract' | 'not-disposed' |
  'binding-present' | 'invalid-zero' | 'direct-provider-zero' | 'fixture-zero';

export type CandidateResponseReadStage = 'not-started' | 'body-requested' |
  'body-obtained' | 'json-decoded' | 'contract-checked';

export type CandidateResponseFailure = 'none' | 'navigation' | 'target-closed' |
  'disposed' | 'network' | 'empty-body' | 'malformed-json' | 'oversize' |
  'contract' | 'other';

export type CandidateResponseExceptionCategory = 'none' | 'protocol' |
  'target-closed' | 'generic-error' | 'non-error';

export type CandidateHealthGuardDiagnostic = Readonly<{
  kind: 'candidate-health-guard';
  guard: CandidateHealthGuard;
  participants: number;
  requests: number;
  responses: number;
  errors: number;
  invalid: number;
  directProvider: number;
  fixture: number;
  responseValidationActive: number;
  httpStatus: number | null;
  responseOutcome: 'available' | 'exhausted' | 'metadata_unavailable' |
    'not_ready' | 'not_found' | 'no_candidates' | 'refresh_required' |
    'candidate_acquisition_unavailable' | 'unknown' | 'unreadable';
  responseReadStage: CandidateResponseReadStage;
  responseFailure: CandidateResponseFailure;
  exceptionCategory: CandidateResponseExceptionCategory;
  bodyBytesObtained: boolean;
  bodyLength: number | null;
  jsonDecoded: boolean;
  requestFinished: boolean;
  requestFailed: boolean;
  pageAlive: boolean;
  contextAlive: boolean;
  failed: boolean;
  disposed: boolean;
  bindingPresent: boolean;
}>;

export type FilterResolutionBoundaryDiagnostic = Readonly<{
  kind: 'filter-resolution-boundary';
  operationPhase: 'concurrent-filter-submission' | 'committed-response-loss';
  expectedFilterCount: number;
  authoritativeFilterCount: number;
  filterCountComplete: boolean;
  expectedResolution: 'compatible' | 'incompatible';
  filterResolution: 'pending' | 'compatible' | 'incompatible';
  terminalAuthorityObserved: boolean;
  terminalViewObserved: boolean;
  resolverRequestsObserved: number;
  resolverResponsesObserved: number;
  resolverSuccessResponses: number;
  resolverRequestFailures: number;
  missing: readonly ('filter-count' | 'terminal-authority' | 'terminal-view')[];
}>;

export type ContainmentDiagnostic = Readonly<{
  kind: 'candidate-containment';
  classification: 'no-handoff' | 'active-handler' | 'new-work-after-drain' |
    'handler-failure' | 'request-cancellation' | 'disposed' | 'other';
  handoffs: number;
  activeHandlers: number;
  handlersStarted: number;
  handlersCompleted: number;
  handlerFailures: number;
  requestCancellations: number;
  reopenedAfterDrain: number;
  harnessFailures: number;
}>;

export type CandidateBoundaryDiagnostic = Readonly<{
  kind: 'candidate-boundary';
  phase: 'before-drain' | 'after-drain';
  expectedResolution: 'compatible' | 'incompatible';
  filterResolution: 'pending' | 'compatible' | 'incompatible';
  compatible: boolean;
  resolutionMatches: boolean;
  candidateStatus: 'pending' | 'assigned' | 'no_candidates';
  candidatePending: boolean;
  authoritativeCandidateNull: boolean;
  relatedCandidateEvidenceNull: boolean;
  decisionCount: number;
  decisionsZero: boolean;
  missing: readonly ('resolution-mismatch' | 'candidate-pending' |
    'authoritative-candidate-null' | 'related-candidate-evidence-null' |
    'decisions-zero')[];
}>;

export type CandidateRequestDiagnostic = Readonly<{
  sequence: string;
  routeObserved: boolean;
  continueSucceeded: boolean;
  nativeResponseObserved: boolean;
  httpStatus: number | null;
  expectedAvailable: boolean;
  requestFinished: boolean;
  requestFailed: 'none' | 'aborted' | 'network' | 'timeout' | 'other';
  active: boolean;
}>;

export type CandidateOverlapDiagnostic = Readonly<{
  kind: 'candidate-overlap';
  missing: readonly ('minimum-overlap' | 'native-continue' | 'native-response' |
    'http-200-available' | 'request-settlement' | 'request-failure' |
    'active-request' | 'response-validation' | 'forwarding' | 'harness-failure' |
    'disposed')[];
  observed: number;
  forwarding: number;
  responseValidationActive: number;
  provider: Readonly<{ state: 'observed' | 'unavailable'; requests: number | null;
    completed: number | null; active: number | null }>;
  authority: 'present' | 'absent' | 'inspection-failed';
  phase: 'before-authority' | 'after-authority' | 'authority-unknown';
  requests: readonly CandidateRequestDiagnostic[];
}>;

type ContainmentState = {
  handoffs: number;
  activeHandlers: number;
  handlersStarted: number;
  handlersCompleted: number;
  handlerFailures: number;
  requestCancellations: number;
  reopenedAfterDrain: number;
  harnessFailures: number;
  disposed: boolean;
};

type CandidateOverlapState = {
  forwarding: number;
  responseValidationActive: number;
  failed: boolean;
  disposed: boolean;
  provider: CandidateOverlapDiagnostic['provider'];
  authority: CandidateOverlapDiagnostic['authority'];
  requests: readonly CandidateRequestDiagnostic[];
};

type CandidateBoundaryState = {
  phase: CandidateBoundaryDiagnostic['phase'];
  expectedResolution: CandidateBoundaryDiagnostic['expectedResolution'];
  filterResolution: CandidateBoundaryDiagnostic['filterResolution'];
  candidateStatus: CandidateBoundaryDiagnostic['candidateStatus'];
  authoritativeCandidateNull: boolean;
  relatedCandidateEvidenceNull: boolean;
  decisionCount: number;
};

type FilterResolutionBoundaryState = {
  operationPhase: FilterResolutionBoundaryDiagnostic['operationPhase'];
  expectedFilterCount: number;
  authoritativeFilterCount: number;
  expectedResolution: FilterResolutionBoundaryDiagnostic['expectedResolution'];
  filterResolution: FilterResolutionBoundaryDiagnostic['filterResolution'];
  terminalViewObserved: boolean;
  resolverRequestsObserved: number;
  resolverResponsesObserved: number;
  resolverSuccessResponses: number;
  resolverRequestFailures: number;
};

const boundedCount = (value: unknown, maximum = 1000): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= maximum;

const acquisitionStatuses = new Set(['pending', 'assigned', 'no_candidates', 'unavailable']);
const progressionStatuses = new Set([
  'inactive', 'collecting', 'advancing', 'agreed', 'exhausted', 'unavailable',
]);
const candidateTerminalGuards = new Set<CandidateTerminalGuard>([
  'binding-present', 'snapshot-readable', 'acquisition-status', 'progression-status',
  'candidate-sequence', 'decision-count', 'terminal-kind',
]);
const candidateHealthGuards = new Set<CandidateHealthGuard>([
  'request-origin', 'request-method', 'request-shape', 'request-room', 'request-subject',
  'response-body', 'response-size', 'response-json', 'response-contract', 'not-disposed',
  'binding-present', 'invalid-zero', 'direct-provider-zero', 'fixture-zero',
]);
const candidateResponseOutcomes = new Set([
  'available', 'exhausted', 'metadata_unavailable', 'not_ready', 'not_found',
  'no_candidates', 'refresh_required', 'candidate_acquisition_unavailable', 'unknown', 'unreadable',
]);
const candidateResponseReadStages = new Set([
  'not-started', 'body-requested', 'body-obtained', 'json-decoded', 'contract-checked',
]);
const candidateResponseFailures = new Set([
  'none', 'navigation', 'target-closed', 'disposed', 'network', 'empty-body',
  'malformed-json', 'oversize', 'contract', 'other',
]);
const candidateResponseExceptionCategories = new Set([
  'none', 'protocol', 'target-closed', 'generic-error', 'non-error',
]);
const routeViews = new Set(['room', 'loading', 'error', 'malformed', 'other']);
const candidateAttempts = new Set([
  'not-observed', 'acquiring', 'acquisition-error', 'loading-metadata',
  'metadata-error', 'loading-poster', 'poster-error', 'available', 'no-poster',
  'no-candidates', 'integrity-error',
]);
const metadataRequestStates = new Set(['none', 'pending', 'completed', 'failed']);
const metadataHttpStatusClasses = new Set(['none', '2xx', '4xx', '5xx', 'network', 'other']);
const metadataResultClasses = new Set([
  'none', 'available', 'metadata_unavailable', 'candidate_acquisition_unavailable',
  'other-success', 'other-failure', 'unreadable',
]);

export function candidatePresentationDiagnostic(state: CandidatePresentationState):
  CandidatePresentationDiagnostic {
  if (!state || typeof state !== 'object' || Array.isArray(state) ||
      Object.keys(state).sort().join(',') !==
        'acquisitionStatus,agreedSurfacePresent,candidateAttempt,candidateCardExists,candidateSequence,canonicalCandidateIdentityPresent,canonicalReadable,decisionCount,errorSurfacePresent,exhaustedSurfacePresent,expectedHeadingExists,expectedHeadingVisible,loadingSurfacePresent,metadataHttpStatusClass,metadataRecoveryActive,metadataRequestAttemptCount,metadataRequestState,metadataResultClass,posterMetadataPresent,progressionStatus,releaseYearMetadataPresent,requestSequenceMatches,routeView,titleMetadataPresent' ||
      !routeViews.has(state.routeView) || !candidateAttempts.has(state.candidateAttempt) ||
      !acquisitionStatuses.has(state.acquisitionStatus) ||
      !progressionStatuses.has(state.progressionStatus) ||
      !(state.candidateSequence === null || boundedCount(state.candidateSequence, 2147483647)) ||
      !(state.decisionCount === null || boundedCount(state.decisionCount, 2147483647)) ||
      !metadataRequestStates.has(state.metadataRequestState) ||
      !boundedCount(state.metadataRequestAttemptCount, 100) ||
      !metadataHttpStatusClasses.has(state.metadataHttpStatusClass) ||
      !metadataResultClasses.has(state.metadataResultClass) ||
      !(state.requestSequenceMatches === null || typeof state.requestSequenceMatches === 'boolean') ||
      ![state.canonicalReadable, state.canonicalCandidateIdentityPresent,
        state.titleMetadataPresent, state.releaseYearMetadataPresent,
        state.posterMetadataPresent, state.metadataRecoveryActive, state.candidateCardExists,
        state.expectedHeadingExists, state.expectedHeadingVisible,
        state.loadingSurfacePresent, state.errorSurfacePresent,
        state.exhaustedSurfacePresent, state.agreedSurfacePresent]
        .every(value => typeof value === 'boolean') ||
      state.expectedHeadingVisible && !state.expectedHeadingExists ||
      !state.canonicalReadable && (state.acquisitionStatus !== 'unavailable' ||
        state.progressionStatus !== 'unavailable' || state.candidateSequence !== null ||
        state.decisionCount !== null || state.canonicalCandidateIdentityPresent) ||
      state.metadataRequestState === 'none' && (state.metadataRequestAttemptCount !== 0 ||
        state.metadataHttpStatusClass !== 'none' || state.metadataResultClass !== 'none') ||
      state.metadataRequestState === 'pending' && (state.metadataRequestAttemptCount < 1 ||
        state.metadataHttpStatusClass !== 'none' || state.metadataResultClass !== 'none') ||
      (state.metadataRequestState === 'completed' || state.metadataRequestState === 'failed') &&
        (state.metadataRequestAttemptCount < 1 || state.metadataHttpStatusClass === 'none' ||
          state.metadataResultClass === 'none')) throw new Error('E2E_SAFE_FAILURE');

  const expectedHeadingHidden = state.expectedHeadingExists && !state.expectedHeadingVisible;
  const clientProjectionStale = state.requestSequenceMatches === false || state.canonicalReadable && (
    state.acquisitionStatus === 'assigned' &&
      (['acquiring', 'no-candidates'].includes(state.candidateAttempt) ||
        state.candidateAttempt === 'not-observed' && !state.titleMetadataPresent) ||
    state.acquisitionStatus === 'no_candidates' &&
      (state.titleMetadataPresent || state.candidateCardExists ||
        ['loading-metadata', 'metadata-error', 'loading-poster', 'poster-error',
          'available', 'no-poster'].includes(state.candidateAttempt)));

  let presentationState: CandidatePresentationDiagnostic['presentationState'];
  if (state.routeView === 'loading') presentationState = 'route-loading';
  else if (state.routeView === 'error' || state.routeView === 'malformed') presentationState = 'route-error';
  else if (state.routeView !== 'room') presentationState = 'route-other';
  else if (state.progressionStatus === 'exhausted' || state.exhaustedSurfacePresent)
    presentationState = 'exhausted';
  else if (state.expectedHeadingVisible) presentationState = 'heading-visible';
  else if (state.progressionStatus === 'agreed' || state.agreedSurfacePresent)
    presentationState = 'agreed';
  else if (state.acquisitionStatus === 'assigned' && state.candidateAttempt === 'loading-metadata' &&
      state.metadataRequestState === 'pending' && state.metadataRecoveryActive)
    presentationState = 'metadata-recovery';
  else if (state.acquisitionStatus === 'assigned' && state.metadataRequestState === 'failed')
    presentationState = 'metadata-request-failure';
  else if (clientProjectionStale) presentationState = 'stale-client-projection';
  else if (state.acquisitionStatus === 'assigned' && state.titleMetadataPresent &&
      !state.candidateCardExists) presentationState = 'metadata-ready-card-missing';
  else if (state.candidateAttempt === 'loading-metadata') presentationState = 'metadata-loading';
  else if (state.candidateAttempt === 'acquiring') presentationState = 'acquisition-loading';
  else if (state.candidateAttempt === 'acquisition-error') presentationState = 'acquisition-failure';
  else if (state.candidateAttempt === 'loading-poster') presentationState = 'poster-loading';
  else if (state.candidateAttempt === 'poster-error') presentationState = 'poster-failure';
  else if (state.candidateAttempt === 'no-poster') presentationState = 'no-poster';
  else if (state.candidateAttempt === 'integrity-error') presentationState = 'integrity-error';
  else presentationState = 'other';

  return Object.freeze({ kind: 'candidate-presentation', presentationState, ...state,
    expectedHeadingHidden, clientProjectionStale });
}

export function candidateTerminalGuardDiagnostic(state: Omit<CandidateTerminalGuardDiagnostic, 'kind'>):
  CandidateTerminalGuardDiagnostic {
  if (!candidateTerminalGuards.has(state.guard) ||
      !['initial-empty', 'exhausted'].includes(state.expected) ||
      !acquisitionStatuses.has(state.acquisitionStatus) ||
      !progressionStatuses.has(state.progressionStatus) ||
      !(state.candidateSequence === null || boundedCount(state.candidateSequence, 2147483647)) ||
      !(state.decisionCount === null || boundedCount(state.decisionCount, 2147483647)) ||
      ![state.bindingPresent, state.snapshotReadable, state.acquisitionMatches,
        state.progressionMatches, state.sequenceMatches, state.decisionsZero,
        state.terminalKindMatches].every(value => typeof value === 'boolean'))
    throw new Error('E2E_SAFE_FAILURE');
  return Object.freeze({ kind: 'candidate-terminal-guard', ...state });
}

export function candidateHealthGuardDiagnostic(state: Omit<CandidateHealthGuardDiagnostic, 'kind'>):
  CandidateHealthGuardDiagnostic {
  if (!candidateHealthGuards.has(state.guard) || !boundedCount(state.participants, 4) ||
      state.participants < 2 || ![state.requests, state.responses, state.errors, state.invalid,
        state.directProvider, state.fixture, state.responseValidationActive]
        .every(value => boundedCount(value)) ||
      !(state.httpStatus === null || boundedCount(state.httpStatus, 599) && state.httpStatus >= 100) ||
      !candidateResponseOutcomes.has(state.responseOutcome) ||
      !candidateResponseReadStages.has(state.responseReadStage) ||
      !candidateResponseFailures.has(state.responseFailure) ||
      !candidateResponseExceptionCategories.has(state.exceptionCategory) ||
      !(state.bodyLength === null || boundedCount(state.bodyLength, 4097)) ||
      ![state.bodyBytesObtained, state.jsonDecoded, state.requestFinished,
        state.requestFailed, state.pageAlive, state.contextAlive,
        state.failed, state.disposed, state.bindingPresent]
        .every(value => typeof value === 'boolean'))
    throw new Error('E2E_SAFE_FAILURE');
  return Object.freeze({ kind: 'candidate-health-guard', ...state });
}

export function containmentDiagnostic(state: ContainmentState): ContainmentDiagnostic {
  if (![state.handoffs, state.activeHandlers, state.handlersStarted, state.handlersCompleted,
    state.handlerFailures, state.requestCancellations, state.reopenedAfterDrain, state.harnessFailures]
    .every(value => boundedCount(value)) || state.activeHandlers > state.handlersStarted ||
    state.handlersCompleted > state.handlersStarted || state.handoffs !== state.handlersStarted ||
    typeof state.disposed !== 'boolean') throw new Error('E2E_SAFE_FAILURE');
  const classification = state.disposed ? 'disposed' : state.harnessFailures > 0 ? 'other' : state.handoffs === 0 ? 'no-handoff' :
    state.handlerFailures > 0 ? 'handler-failure' : state.requestCancellations > 0 ? 'request-cancellation' :
    state.activeHandlers > 0 && state.reopenedAfterDrain > 0 ? 'new-work-after-drain' :
    state.activeHandlers > 0 ? 'active-handler' : 'other';
  return Object.freeze({ kind: 'candidate-containment', classification,
    handoffs: state.handoffs, activeHandlers: state.activeHandlers,
    handlersStarted: state.handlersStarted, handlersCompleted: state.handlersCompleted,
    handlerFailures: state.handlerFailures, requestCancellations: state.requestCancellations,
    reopenedAfterDrain: state.reopenedAfterDrain, harnessFailures: state.harnessFailures });
}

export function candidateBoundaryDiagnostic(state: CandidateBoundaryState): CandidateBoundaryDiagnostic {
  if (!['before-drain','after-drain'].includes(state.phase) ||
      !['compatible','incompatible'].includes(state.expectedResolution) ||
      !['pending','compatible','incompatible'].includes(state.filterResolution) ||
      !['pending','assigned','no_candidates'].includes(state.candidateStatus) ||
      typeof state.authoritativeCandidateNull !== 'boolean' ||
      typeof state.relatedCandidateEvidenceNull !== 'boolean' ||
      !boundedCount(state.decisionCount)) throw new Error('E2E_SAFE_FAILURE');
  const compatible = state.filterResolution === 'compatible';
  const resolutionMatches = state.filterResolution === state.expectedResolution;
  const candidatePending = state.candidateStatus === 'pending';
  const decisionsZero = state.decisionCount === 0;
  const missing: CandidateBoundaryDiagnostic['missing'][number][] = [];
  if (!resolutionMatches) missing.push('resolution-mismatch');
  if (!candidatePending) missing.push('candidate-pending');
  if (!state.authoritativeCandidateNull) missing.push('authoritative-candidate-null');
  if (!state.relatedCandidateEvidenceNull) missing.push('related-candidate-evidence-null');
  if (!decisionsZero) missing.push('decisions-zero');
  return Object.freeze({ kind: 'candidate-boundary', phase: state.phase,
    expectedResolution: state.expectedResolution, filterResolution: state.filterResolution,
    compatible, resolutionMatches, candidateStatus: state.candidateStatus, candidatePending,
    authoritativeCandidateNull: state.authoritativeCandidateNull,
    relatedCandidateEvidenceNull: state.relatedCandidateEvidenceNull,
    decisionCount: state.decisionCount, decisionsZero,
    missing: Object.freeze(missing) });
}

export function filterResolutionBoundaryDiagnostic(
  state: FilterResolutionBoundaryState): FilterResolutionBoundaryDiagnostic {
  if (!['concurrent-filter-submission','committed-response-loss'].includes(state.operationPhase) ||
      !boundedCount(state.expectedFilterCount, 5) || state.expectedFilterCount < 2 ||
      !boundedCount(state.authoritativeFilterCount, 5) ||
      !['compatible','incompatible'].includes(state.expectedResolution) ||
      !['pending','compatible','incompatible'].includes(state.filterResolution) ||
      typeof state.terminalViewObserved !== 'boolean' ||
      ![state.resolverRequestsObserved, state.resolverResponsesObserved,
        state.resolverSuccessResponses, state.resolverRequestFailures]
        .every(value => boundedCount(value, 8)) ||
      state.resolverResponsesObserved > state.resolverRequestsObserved ||
      state.resolverSuccessResponses > state.resolverResponsesObserved ||
      state.resolverRequestFailures > state.resolverRequestsObserved)
    throw new Error('E2E_SAFE_FAILURE');
  const filterCountComplete = state.authoritativeFilterCount === state.expectedFilterCount;
  const terminalAuthorityObserved = state.filterResolution === state.expectedResolution;
  const missing: FilterResolutionBoundaryDiagnostic['missing'][number][] = [];
  if (!filterCountComplete) missing.push('filter-count');
  if (!terminalAuthorityObserved) missing.push('terminal-authority');
  if (!state.terminalViewObserved) missing.push('terminal-view');
  return Object.freeze({ kind: 'filter-resolution-boundary', operationPhase: state.operationPhase,
    expectedFilterCount: state.expectedFilterCount,
    authoritativeFilterCount: state.authoritativeFilterCount, filterCountComplete,
    expectedResolution: state.expectedResolution, filterResolution: state.filterResolution,
    terminalAuthorityObserved, terminalViewObserved: state.terminalViewObserved,
    resolverRequestsObserved: state.resolverRequestsObserved,
    resolverResponsesObserved: state.resolverResponsesObserved,
    resolverSuccessResponses: state.resolverSuccessResponses,
    resolverRequestFailures: state.resolverRequestFailures,
    missing: Object.freeze(missing) });
}

const failureClasses = new Set(['none', 'aborted', 'network', 'timeout', 'other']);

function validateRequest(value: CandidateRequestDiagnostic, index: number): CandidateRequestDiagnostic {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join(',') !==
        'active,continueSucceeded,expectedAvailable,httpStatus,nativeResponseObserved,requestFailed,requestFinished,routeObserved,sequence' ||
      value.sequence !== `req-${index + 1}` || !failureClasses.has(value.requestFailed) ||
      ![value.routeObserved, value.continueSucceeded, value.nativeResponseObserved,
        value.expectedAvailable, value.requestFinished, value.active].every(item => typeof item === 'boolean') ||
      !(value.httpStatus === null || boundedCount(value.httpStatus, 599)) ||
      (value.httpStatus !== null && (value.httpStatus < 100 || !value.nativeResponseObserved)) ||
      value.expectedAvailable && (value.httpStatus !== 200 || !value.nativeResponseObserved) ||
      value.requestFinished && value.requestFailed !== 'none' ||
      value.active && (value.requestFinished || value.requestFailed !== 'none'))
    throw new Error('E2E_SAFE_FAILURE');
  return Object.freeze({ ...value });
}

export function candidateOverlapDiagnostic(state: CandidateOverlapState): CandidateOverlapDiagnostic {
  if (!boundedCount(state.forwarding) || !boundedCount(state.responseValidationActive) ||
      typeof state.failed !== 'boolean' || typeof state.disposed !== 'boolean' ||
      !Array.isArray(state.requests) || state.requests.length > 8 ||
      !state.provider || !['observed', 'unavailable'].includes(state.provider.state) ||
      Object.keys(state.provider).sort().join(',') !== 'active,completed,requests,state' ||
      !['present', 'absent', 'inspection-failed'].includes(state.authority))
    throw new Error('E2E_SAFE_FAILURE');
  const requests = state.requests.map(validateRequest);
  if (state.provider.state === 'observed') {
    if (![state.provider.requests, state.provider.completed, state.provider.active].every(value => boundedCount(value)) ||
        (state.provider.completed as number) + (state.provider.active as number) > (state.provider.requests as number))
      throw new Error('E2E_SAFE_FAILURE');
  } else if (state.provider.requests !== null || state.provider.completed !== null || state.provider.active !== null) {
    throw new Error('E2E_SAFE_FAILURE');
  }
  const missing: CandidateOverlapDiagnostic['missing'][number][] = [];
  if (requests.length < 2) missing.push('minimum-overlap');
  if (requests.some(item => !item.continueSucceeded)) missing.push('native-continue');
  if (requests.some(item => !item.nativeResponseObserved)) missing.push('native-response');
  if (requests.some(item => item.httpStatus !== 200 || !item.expectedAvailable)) missing.push('http-200-available');
  if (requests.some(item => !item.requestFinished && item.requestFailed === 'none')) missing.push('request-settlement');
  if (requests.some(item => item.requestFailed !== 'none')) missing.push('request-failure');
  if (requests.some(item => item.active)) missing.push('active-request');
  if (state.responseValidationActive !== 0) missing.push('response-validation');
  if (state.forwarding !== 0) missing.push('forwarding');
  if (state.failed) missing.push('harness-failure');
  if (state.disposed) missing.push('disposed');
  const phase = state.authority === 'present' ? 'after-authority' :
    state.authority === 'absent' ? 'before-authority' : 'authority-unknown';
  return Object.freeze({ kind: 'candidate-overlap', missing: Object.freeze(missing),
    observed: requests.length, forwarding: state.forwarding,
    responseValidationActive: state.responseValidationActive,
    provider: Object.freeze({ ...state.provider }), authority: state.authority, phase,
    requests: Object.freeze(requests) });
}

export function parseHarnessDiagnostic(value: unknown): HarnessDiagnostic {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('E2E_SAFE_FAILURE');
  const item = value as Record<string, unknown>;
  if (item.kind === 'candidate-presentation') {
    if (Object.keys(item).sort().join(',') !==
        'acquisitionStatus,agreedSurfacePresent,candidateAttempt,candidateCardExists,candidateSequence,canonicalCandidateIdentityPresent,canonicalReadable,clientProjectionStale,decisionCount,errorSurfacePresent,exhaustedSurfacePresent,expectedHeadingExists,expectedHeadingHidden,expectedHeadingVisible,kind,loadingSurfacePresent,metadataHttpStatusClass,metadataRecoveryActive,metadataRequestAttemptCount,metadataRequestState,metadataResultClass,posterMetadataPresent,presentationState,progressionStatus,releaseYearMetadataPresent,requestSequenceMatches,routeView,titleMetadataPresent')
      throw new Error('E2E_SAFE_FAILURE');
    const { kind: _kind, presentationState: _presentationState,
      expectedHeadingHidden: _expectedHeadingHidden,
      clientProjectionStale: _clientProjectionStale, ...state } = item;
    const rebuilt = candidatePresentationDiagnostic(state as CandidatePresentationState);
    if (JSON.stringify(rebuilt) !== JSON.stringify(item)) throw new Error('E2E_SAFE_FAILURE');
    return rebuilt;
  }
  if (item.kind === 'candidate-terminal-guard') {
    if (Object.keys(item).sort().join(',') !==
        'acquisitionMatches,acquisitionStatus,bindingPresent,candidateSequence,decisionCount,decisionsZero,expected,guard,kind,progressionMatches,progressionStatus,sequenceMatches,snapshotReadable,terminalKindMatches')
      throw new Error('E2E_SAFE_FAILURE');
    const { kind: _kind, ...state } = item;
    return candidateTerminalGuardDiagnostic(state as Omit<CandidateTerminalGuardDiagnostic, 'kind'>);
  }
  if (item.kind === 'candidate-health-guard') {
    if (Object.keys(item).sort().join(',') !==
        'bindingPresent,bodyBytesObtained,bodyLength,contextAlive,directProvider,disposed,errors,exceptionCategory,failed,fixture,guard,httpStatus,invalid,jsonDecoded,kind,pageAlive,participants,requestFailed,requestFinished,requests,responseFailure,responseOutcome,responseReadStage,responseValidationActive,responses')
      throw new Error('E2E_SAFE_FAILURE');
    const { kind: _kind, ...state } = item;
    return candidateHealthGuardDiagnostic(state as Omit<CandidateHealthGuardDiagnostic, 'kind'>);
  }
  if (item.kind === 'candidate-containment') {
    if (Object.keys(item).sort().join(',') !==
        'activeHandlers,classification,handlerFailures,handlersCompleted,handlersStarted,handoffs,harnessFailures,kind,reopenedAfterDrain,requestCancellations')
      throw new Error('E2E_SAFE_FAILURE');
    const rebuilt = containmentDiagnostic({ handoffs: item.handoffs as number,
      activeHandlers: item.activeHandlers as number, handlersStarted: item.handlersStarted as number,
      handlersCompleted: item.handlersCompleted as number, handlerFailures: item.handlerFailures as number,
      requestCancellations: item.requestCancellations as number,
      reopenedAfterDrain: item.reopenedAfterDrain as number, harnessFailures: item.harnessFailures as number,
      disposed: item.classification === 'disposed' });
    if (rebuilt.classification !== item.classification) throw new Error('E2E_SAFE_FAILURE');
    return rebuilt;
  }
  if (item.kind === 'candidate-overlap') {
    if (Object.keys(item).sort().join(',') !==
        'authority,forwarding,kind,missing,observed,phase,provider,requests,responseValidationActive')
      throw new Error('E2E_SAFE_FAILURE');
    const requests = item.requests as CandidateRequestDiagnostic[];
    const missing = item.missing;
    const rebuilt = candidateOverlapDiagnostic({ forwarding: item.forwarding as number,
      responseValidationActive: item.responseValidationActive as number,
      failed: Array.isArray(missing) && missing.includes('harness-failure'),
      disposed: Array.isArray(missing) && missing.includes('disposed'),
      provider: item.provider as CandidateOverlapDiagnostic['provider'],
      authority: item.authority as CandidateOverlapDiagnostic['authority'], requests });
    if (rebuilt.observed !== item.observed || rebuilt.phase !== item.phase ||
        JSON.stringify(rebuilt.missing) !== JSON.stringify(missing)) throw new Error('E2E_SAFE_FAILURE');
    return rebuilt;
  }
  if (item.kind === 'candidate-boundary') {
    if (Object.keys(item).sort().join(',') !==
        'authoritativeCandidateNull,candidatePending,candidateStatus,compatible,decisionCount,decisionsZero,expectedResolution,filterResolution,kind,missing,phase,relatedCandidateEvidenceNull,resolutionMatches')
      throw new Error('E2E_SAFE_FAILURE');
    const rebuilt = candidateBoundaryDiagnostic({ phase: item.phase as CandidateBoundaryDiagnostic['phase'],
      expectedResolution: item.expectedResolution as CandidateBoundaryDiagnostic['expectedResolution'],
      filterResolution: item.filterResolution as CandidateBoundaryDiagnostic['filterResolution'],
      candidateStatus: item.candidateStatus as CandidateBoundaryDiagnostic['candidateStatus'],
      authoritativeCandidateNull: item.authoritativeCandidateNull as boolean,
      relatedCandidateEvidenceNull: item.relatedCandidateEvidenceNull as boolean,
      decisionCount: item.decisionCount as number });
    if (JSON.stringify(rebuilt) !== JSON.stringify(item)) throw new Error('E2E_SAFE_FAILURE');
    return rebuilt;
  }
  if (item.kind === 'filter-resolution-boundary') {
    if (Object.keys(item).sort().join(',') !==
        'authoritativeFilterCount,expectedFilterCount,expectedResolution,filterCountComplete,filterResolution,kind,missing,operationPhase,resolverRequestFailures,resolverRequestsObserved,resolverResponsesObserved,resolverSuccessResponses,terminalAuthorityObserved,terminalViewObserved')
      throw new Error('E2E_SAFE_FAILURE');
    const rebuilt = filterResolutionBoundaryDiagnostic({
      operationPhase: item.operationPhase as FilterResolutionBoundaryDiagnostic['operationPhase'],
      expectedFilterCount: item.expectedFilterCount as number,
      authoritativeFilterCount: item.authoritativeFilterCount as number,
      expectedResolution: item.expectedResolution as FilterResolutionBoundaryDiagnostic['expectedResolution'],
      filterResolution: item.filterResolution as FilterResolutionBoundaryDiagnostic['filterResolution'],
      terminalViewObserved: item.terminalViewObserved as boolean,
      resolverRequestsObserved: item.resolverRequestsObserved as number,
      resolverResponsesObserved: item.resolverResponsesObserved as number,
      resolverSuccessResponses: item.resolverSuccessResponses as number,
      resolverRequestFailures: item.resolverRequestFailures as number,
    });
    if (JSON.stringify(rebuilt) !== JSON.stringify(item)) throw new Error('E2E_SAFE_FAILURE');
    return rebuilt;
  }
  throw new Error('E2E_SAFE_FAILURE');
}
