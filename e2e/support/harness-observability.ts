export type HarnessDiagnostic = ContainmentDiagnostic | CandidateBoundaryDiagnostic |
  CandidateOverlapDiagnostic | FilterResolutionBoundaryDiagnostic;

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
