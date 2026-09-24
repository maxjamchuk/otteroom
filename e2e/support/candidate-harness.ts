import { expect, type Frame, type Page, type Request, type Response, type Route } from '@playwright/test';
import fs from 'node:fs';
import { parseEnv } from 'node:util';
import { type SafeDiagnostics, safeError } from './safe-diagnostics.ts';
import { committedRoomSnapshot, type PublicApi, type RoomProjection } from './room-harness.ts';
import { candidateHealthGuardDiagnostic, candidateOverlapDiagnostic,
  candidatePresentationDiagnostic,
  candidateTerminalGuardDiagnostic, type CandidateHealthGuard,
  type CandidateHealthGuardDiagnostic, type CandidateRequestDiagnostic,
  type CandidatePresentationDiagnostic,
  type CandidateResponseExceptionCategory, type CandidateResponseFailure,
  type CandidateResponseReadStage,
  type CandidateTerminalGuard } from './harness-observability.ts';
import type { TmdbStubScenario } from './tmdb-stub.ts';
import { controlledCandidate, controlledFixtureById, controlledSuccessor,
  type ControlledCandidateFixture } from './tmdb-controlled-fixture.ts';

export { controlledCandidate, controlledSuccessor } from './tmdb-controlled-fixture.ts';
const posterPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const endpoint = (value: string) => new URL(value).pathname === '/functions/v1/room-candidate';
const initialEmptyCopy = 'No eligible movie was observed during the completed search.';
const exhaustedCopy = 'No further eligible movies were found for this selection.';

type PresentationRequest = {
  state: CandidatePresentationDiagnostic['metadataRequestState'];
  attempts: number;
  recoveryActive: boolean;
  httpStatusClass: CandidatePresentationDiagnostic['metadataHttpStatusClass'];
  resultClass: CandidatePresentationDiagnostic['metadataResultClass'];
  titlePresent: boolean;
  releaseYearPresent: boolean;
  posterPresent: boolean;
  candidateSequence: number | null;
};

const emptyPresentationRequest = (): PresentationRequest => ({ state: 'none', attempts: 0,
  recoveryActive: false,
  httpStatusClass: 'none', resultClass: 'none', titlePresent: false,
  releaseYearPresent: false, posterPresent: false, candidateSequence: null });

function httpStatusClass(status: number): CandidatePresentationDiagnostic['metadataHttpStatusClass'] {
  if (status >= 200 && status < 300) return '2xx';
  if (status >= 400 && status < 500) return '4xx';
  if (status >= 500 && status < 600) return '5xx';
  return 'other';
}

type CandidateTerminalProjection = Pick<RoomProjection, 'candidate_acquisition_status' |
  'candidate_progression_status' | 'candidate_sequence' | 'decision_completed_count'>;

type CandidateTerminalKind = 'initial-empty' | 'exhausted';

export function candidateTerminalExpectation(room: CandidateTerminalProjection) {
  if (room.candidate_acquisition_status === 'no_candidates' &&
      room.candidate_progression_status === 'inactive' && room.candidate_sequence === 0 &&
      room.decision_completed_count === 0)
    return { kind: 'initial-empty', copy: initialEmptyCopy } as const;
  if (room.candidate_acquisition_status === 'no_candidates' &&
      room.candidate_progression_status === 'exhausted' &&
      Number.isInteger(room.candidate_sequence) && room.candidate_sequence > 0 &&
      room.decision_completed_count === 0)
    return { kind: 'exhausted', copy: exhaustedCopy } as const;
  throw safeError();
}

function terminalGuard(expected: CandidateTerminalKind, room: CandidateTerminalProjection):
  CandidateTerminalGuard | null {
  if (room.candidate_acquisition_status !== 'no_candidates') return 'acquisition-status';
  if (room.candidate_progression_status !==
      (expected === 'initial-empty' ? 'inactive' : 'exhausted')) return 'progression-status';
  if (expected === 'initial-empty' ? room.candidate_sequence !== 0 :
      !Number.isInteger(room.candidate_sequence) || room.candidate_sequence <= 0)
    return 'candidate-sequence';
  if (room.decision_completed_count !== 0) return 'decision-count';
  return null;
}

export async function waitForCandidateTerminal(read: () => CandidateTerminalProjection,
  expected: CandidateTerminalKind, timeout = 5000): Promise<CandidateTerminalProjection> {
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 5000) throw safeError();
  let room = read();
  if (terminalGuard(expected, room) === null) return room;
  await expect.poll(() => {
    room = read();
    return terminalGuard(expected, room);
  }, { timeout }).toBe(null);
  return room;
}

function terminalDiagnostic(guard: CandidateTerminalGuard, expected: CandidateTerminalKind,
  room: CandidateTerminalProjection | null, bindingPresent: boolean, snapshotReadable: boolean) {
  const acquisitionMatches = room?.candidate_acquisition_status === 'no_candidates';
  const progressionMatches = room?.candidate_progression_status ===
    (expected === 'initial-empty' ? 'inactive' : 'exhausted');
  const sequenceMatches = !!room && (expected === 'initial-empty' ? room.candidate_sequence === 0 :
    Number.isInteger(room.candidate_sequence) && room.candidate_sequence > 0);
  const decisionsZero = room?.decision_completed_count === 0;
  return candidateTerminalGuardDiagnostic({ guard, expected,
    acquisitionStatus: room?.candidate_acquisition_status ?? 'unavailable',
    progressionStatus: room?.candidate_progression_status ?? 'unavailable',
    candidateSequence: Number.isInteger(room?.candidate_sequence) ? room!.candidate_sequence : null,
    decisionCount: Number.isInteger(room?.decision_completed_count) ? room!.decision_completed_count : null,
    bindingPresent, snapshotReadable, acquisitionMatches, progressionMatches, sequenceMatches,
    decisionsZero, terminalKindMatches: acquisitionMatches && progressionMatches &&
      sequenceMatches && decisionsZero && guard !== 'terminal-kind' });
}

export type StubSnapshot = Readonly<{ scenario: TmdbStubScenario; calls: Readonly<{
  discover: number; details: number; configuration: number; poster: number }>; held: number;
  released: boolean; invalid: number; provider: Readonly<{
    requests: number; completed: number; active: number }> }>;

function controlUrl(): string {
  const value = process.env.OTTEROOM_TMDB_STUB_CONTROL_URL;
  if (!value || new URL(value).hostname !== '127.0.0.1') throw safeError();
  return value;
}

async function control(body: Record<string, unknown>) {
  const response = await fetch(controlUrl(), { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body) });
  if (!response.ok || JSON.stringify(await response.json()) !== '{"ok":true}') throw safeError();
}

export async function configureTmdb(scenario: TmdbStubScenario, hold = false, language: 'en-US' | 'de-DE' = 'en-US') {
  await control({ scenario, hold, language });
}
export async function releaseTmdb() { await control({ release: true }); }
export async function tmdbSnapshot(): Promise<StubSnapshot> {
  const response = await fetch(controlUrl()); const value = await response.json();
  if (!response.ok || !value || typeof value !== 'object' || !value.calls ||
      !['discover','details','configuration','poster'].every(key => Number.isInteger(value.calls[key])) ||
      !Number.isInteger(value.held) || !Number.isInteger(value.invalid) || !value.provider ||
      !['requests','completed','active'].every(key => Number.isInteger(value.provider[key])) ||
      value.provider.completed + value.provider.active > value.provider.requests) throw safeError();
  return value as StubSnapshot;
}

export function assertControlledProviderComplete(snapshot: StubSnapshot, minimumDiscover = 1): void {
  if (!Number.isInteger(minimumDiscover) || minimumDiscover < 1 || snapshot.invalid !== 0 ||
      snapshot.provider.active !== 0 || snapshot.provider.completed !== snapshot.provider.requests ||
      snapshot.calls.discover < minimumDiscover) throw safeError();
}
export async function installCandidateRequestOverlap(pages: Page[], room: RoomProjection,
  diagnostics?: Pick<SafeDiagnostics, 'recordHarnessDiagnostic'>) {
  if (pages.length < 2 || pages.length > 4 || new Set(pages).size !== pages.length ||
      !/^[0-9a-f-]{36}$/.test(room.id)) throw safeError();
  const minimumConcurrent = 2;
  let held = 0, forwarding = 0, failed = false, disposed = false;
  type Lifecycle = { sequence: number; routeObserved: true; continueSucceeded: boolean;
    nativeResponseObserved: boolean; httpStatus: number | null; expectedAvailable: boolean;
    requestFinished: boolean; requestFailed: CandidateRequestDiagnostic['requestFailed']; active: boolean };
  const tracked = new Map<Request, Lifecycle>(), settled = new Set<Request>();
  const results = new Map<Request, { status: number; outcome: 'available' }>();
  const responseWork = new Set<Promise<void>>();
  let release!: () => void, arrived!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const ready = new Promise<void>(resolve => { arrived = resolve; });
  const entries = pages.map(page => ({ page, handler: async (route: Route) => {
    const request = route.request();
    let didForward = false;
    try {
      const body = request.postDataJSON();
      if (request.method() !== 'POST' || Object.keys(body ?? {}).join(',') !== 'room_id' ||
          body.room_id !== room.id) throw safeError();
      const lifecycle: Lifecycle = { sequence: tracked.size + 1, routeObserved: true,
        continueSucceeded: false, nativeResponseObserved: false, httpStatus: null,
        expectedAvailable: false, requestFinished: false, requestFailed: 'none', active: true };
      tracked.set(request, lifecycle); held++; if (held === minimumConcurrent) arrived(); await gate;
      forwarding++; didForward = true; await route.continue(); lifecycle.continueSucceeded = true;
    } catch { failed = true; arrived(); release(); await route.abort('failed').catch(() => {}); }
    finally { if (didForward) forwarding--; }
  }}));
  const onResponse = (response: Response) => {
    const request = response.request();
    const lifecycle = tracked.get(request);
    if (!lifecycle) return;
    lifecycle.nativeResponseObserved = true;
    lifecycle.httpStatus = response.status();
    const work = (async () => {
      try {
        const bytes = await response.body();
        const value = bytes.length <= 4096 ? JSON.parse(bytes.toString('utf8')) : null;
        if (response.status() !== 200 || !strictAvailable(value)) throw safeError();
        lifecycle.expectedAvailable = true;
        results.set(request, { status: response.status(), outcome: 'available' });
      } catch { if (!disposed) failed = true; }
    })().finally(() => responseWork.delete(work));
    responseWork.add(work);
  };
  const onFinished = (request: Request) => {
    const lifecycle = tracked.get(request);
    if (lifecycle) { lifecycle.requestFinished = true; lifecycle.active = false; settled.add(request); }
  };
  const onFailed = (request: Request) => {
    const lifecycle = tracked.get(request);
    if (lifecycle) {
      const text = request.failure()?.errorText ?? '';
      lifecycle.requestFailed = /abort/i.test(text) ? 'aborted' : /tim(?:e|ed)out/i.test(text) ? 'timeout' :
        /net::|network/i.test(text) ? 'network' : 'other';
      lifecycle.active = false; settled.add(request); failed = true;
    }
  };
  for (const entry of entries) {
    entry.page.on('response', onResponse);
    entry.page.on('requestfinished', onFinished);
    entry.page.on('requestfailed', onFailed);
    await entry.page.route('**/functions/v1/room-candidate', entry.handler, { times: 1 });
  }
  const waitFor = (complete: () => boolean, timeout = 30000) => expect.poll(() =>
    failed || disposed ? -1 : complete() ? 1 : 0, { timeout }).toBe(1);
  const requestDiagnostics = (): CandidateRequestDiagnostic[] => [...tracked.values()].map(item => ({
    sequence: `req-${item.sequence}`, routeObserved: item.routeObserved,
    continueSucceeded: item.continueSucceeded, nativeResponseObserved: item.nativeResponseObserved,
    httpStatus: item.httpStatus, expectedAvailable: item.expectedAvailable,
    requestFinished: item.requestFinished, requestFailed: item.requestFailed, active: item.active,
  }));
  const emitDiagnostic = async () => {
    let provider: { state: 'observed' | 'unavailable'; requests: number | null;
      completed: number | null; active: number | null } =
      { state: 'unavailable', requests: null, completed: null, active: null };
    let authority: 'present' | 'absent' | 'inspection-failed' = 'inspection-failed';
    try {
      const snapshot = await tmdbSnapshot();
      provider = { state: 'observed', ...snapshot.provider };
    } catch { /* The fixed unavailable state is safe and explicit. */ }
    try {
      authority = committedRoomSnapshot(room).row.candidate_acquisition_status === 'assigned' ? 'present' : 'absent';
    } catch { /* The fixed inspection-failed state is safe and explicit. */ }
    diagnostics?.recordHarnessDiagnostic(candidateOverlapDiagnostic({ forwarding,
      responseValidationActive: responseWork.size, failed, disposed, provider, authority,
      requests: requestDiagnostics() }));
  };
  const drain = async (timeout = 30000) => {
    try {
      await waitFor(() => held >= minimumConcurrent && forwarding === 0 && tracked.size === settled.size &&
        tracked.size === results.size && responseWork.size === 0, timeout);
    } catch (error) {
      await emitDiagnostic();
      throw error;
    }
    if (failed || disposed || held < minimumConcurrent || forwarding !== 0 || tracked.size !== settled.size ||
        tracked.size !== results.size || responseWork.size !== 0)
      throw safeError();
  };
  return {
    wait: () => Promise.race([ready, new Promise<never>((_, reject) =>
      setTimeout(() => reject(safeError()), 15000))]).then(() => {
      if (failed || held < minimumConcurrent) throw safeError();
    }),
    release: () => release(),
    drain,
    results: () => [...results.values()],
    close: async () => {
      if (disposed) return;
      release();
      if (!failed && held >= minimumConcurrent) await drain().catch(() => { failed = true; });
      await expect.poll(() => forwarding, { timeout: 30000 }).toBe(0).catch(() => {});
      await Promise.allSettled([...responseWork]);
      disposed = true;
      await Promise.all(entries.map(async entry => {
        entry.page.removeListener('response', onResponse);
        entry.page.removeListener('requestfinished', onFinished);
        entry.page.removeListener('requestfailed', onFailed);
        await entry.page.unroute('**/functions/v1/room-candidate', entry.handler);
      }));
    },
  };
}

function strictAvailable(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== 'candidate,candidate_progression_status,candidate_sequence,outcome') return false;
  const row = value as Record<string, any>;
  const expected = controlledFixtureById(row.candidate?.tmdb_movie_id);
  const posterMatches = expected === controlledCandidate
    ? /^https:\/\/image\.tmdb\.org\/t\/p\/w\d+\/controlled\.png$/.test(row.candidate?.poster_url)
    : /^https:\/\/image\.tmdb\.org\/t\/p\/w\d+\/controlled-successor\.png$/.test(row.candidate?.poster_url);
  return row.outcome === 'available' && Number.isSafeInteger(row.candidate_sequence) && row.candidate_sequence > 0 &&
    ['collecting','agreed'].includes(row.candidate_progression_status) && !!expected && row.candidate && !Array.isArray(row.candidate) &&
    Object.keys(row.candidate).sort().join(',') === 'poster_url,release_year,title,tmdb_movie_id' &&
    row.candidate.title === expected.title && row.candidate.release_year === expected.releaseYear &&
    (row.candidate.poster_url === null || posterMatches);
}

type CandidateResponseReadState = {
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
};

const unreadResponseState = (): CandidateResponseReadState => ({
  responseReadStage: 'not-started', responseFailure: 'none', exceptionCategory: 'none',
  bodyBytesObtained: false, bodyLength: null, jsonDecoded: false,
  requestFinished: false, requestFailed: false, pageAlive: true, contextAlive: true,
});

export function classifyCandidateResponseReadFailure(error: unknown): Pick<CandidateResponseReadState,
  'responseFailure' | 'exceptionCategory'> {
  const name = error instanceof Error ? error.name.toLowerCase() : '';
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (/navigated away|no data found for resource|no resource with given identifier/.test(message))
    return { responseFailure: 'navigation', exceptionCategory: 'protocol' };
  if (/target.*closed|page.*closed|context.*closed|browser.*closed/.test(message))
    return { responseFailure: 'target-closed', exceptionCategory: 'target-closed' };
  if (/disposed/.test(message))
    return { responseFailure: 'disposed', exceptionCategory: 'generic-error' };
  if (/network|loading failed|connection.*closed/.test(message))
    return { responseFailure: 'network', exceptionCategory: 'generic-error' };
  return { responseFailure: 'other', exceptionCategory: error instanceof Error
    ? name.includes('protocol') ? 'protocol' : 'generic-error' : 'non-error' };
}

function contextIsAlive(page: Page): boolean {
  try {
    if (typeof page.isClosed === 'function' && page.isClosed()) return false;
    if (typeof page.context !== 'function') return true;
    const context = page.context();
    if (typeof context.pages === 'function' && !context.pages().includes(page)) return false;
    const browser = typeof context.browser === 'function' ? context.browser() : null;
    return !browser || typeof browser.isConnected !== 'function' || browser.isConnected();
  } catch { return false; }
}

async function locatorState(locator: ReturnType<Page['getByText']>): Promise<{ exists: boolean; visible: boolean }> {
  try {
    const exists = await locator.count() > 0;
    return { exists, visible: exists && await locator.first().isVisible() };
  } catch { return { exists: false, visible: false }; }
}

async function inspectCandidatePresentation(page: Page, request: PresentationRequest,
  canonical: CandidateTerminalProjection | null, canonicalIdentityPresent: boolean,
  expected: ControlledCandidateFixture = controlledCandidate) {
  const text = async (value: string) => locatorState(page.getByText(value, { exact: true }));
  const [roomCode, routeLoading, routeError, malformed, card, title, poster, posterFallback,
    acquiring, advancing, acquisitionError, metadataLoading, metadataError, posterLoading,
    posterError, initialEmpty, exhausted, agreed, integrity] = await Promise.all([
    locatorState(page.getByLabel('Room code', { exact: true })), text('Loading room…'),
    text('Unable to open this room. Please try again.'),
    text('Malformed invitation. Enter a valid room code.'),
    locatorState(page.getByTestId('candidate-card')),
    locatorState(page.getByTestId('candidate-title')),
    locatorState(page.getByTestId('candidate-poster')),
    locatorState(page.getByTestId('candidate-poster-fallback')),
    text('Finding a movie…'), text('Finding another movie…'),
    text('Unable to find a movie right now. Please try again.'),
    text('Loading movie details…'),
    text('Unable to load movie details. Please try again.'), text('Loading poster…'),
    text('Unable to load this poster. Please try again.'), text(initialEmptyCopy),
    text(exhaustedCopy), text('Group agreement reached. Candidate selection has stopped.'),
    text('Candidate status could not be verified. Reload the room and try again.'),
  ]);
  const heading = await locatorState(page.getByRole('heading', {
    name: expected.title, exact: true, includeHidden: true,
  }));
  const routeView: CandidatePresentationDiagnostic['routeView'] = roomCode.exists || card.exists
    ? 'room' : routeLoading.visible ? 'loading' : routeError.visible ? 'error' :
      malformed.visible ? 'malformed' : 'other';
  const candidateAttempt: CandidatePresentationDiagnostic['candidateAttempt'] =
    integrity.visible ? 'integrity-error' : metadataError.visible ? 'metadata-error' :
      acquisitionError.visible ? 'acquisition-error' : posterError.visible ? 'poster-error' :
        metadataLoading.visible ? 'loading-metadata' : posterLoading.visible ? 'loading-poster' :
          acquiring.visible || advancing.visible ? 'acquiring' :
            initialEmpty.visible || exhausted.visible ? 'no-candidates' :
              posterFallback.exists ? 'no-poster' : title.exists ? 'available' : 'not-observed';
  const canonicalReadable = canonical !== null;
  const requestSequenceMatches = canonical?.candidate_sequence === undefined ||
      request.candidateSequence === null ? null :
    canonical.candidate_sequence === request.candidateSequence;
  return candidatePresentationDiagnostic({ routeView, candidateAttempt, canonicalReadable,
    acquisitionStatus: canonical?.candidate_acquisition_status ?? 'unavailable',
    progressionStatus: canonical?.candidate_progression_status ?? 'unavailable',
    candidateSequence: canonical?.candidate_sequence ?? null,
    decisionCount: canonical?.decision_completed_count ?? null,
    canonicalCandidateIdentityPresent: canonicalReadable && canonicalIdentityPresent,
    titleMetadataPresent: request.titlePresent || title.exists,
    releaseYearMetadataPresent: request.releaseYearPresent ||
      (await locatorState(page.getByTestId('candidate-year'))).exists,
    posterMetadataPresent: request.posterPresent || poster.exists,
    metadataRequestState: request.state, metadataRequestAttemptCount: request.attempts,
    metadataRecoveryActive: request.recoveryActive,
    metadataHttpStatusClass: request.httpStatusClass,
    metadataResultClass: request.resultClass, requestSequenceMatches,
    candidateCardExists: card.exists, expectedHeadingExists: heading.exists,
    expectedHeadingVisible: heading.visible,
    loadingSurfacePresent: routeLoading.visible || acquiring.visible || advancing.visible ||
      metadataLoading.visible || posterLoading.visible,
    errorSurfacePresent: routeError.visible || acquisitionError.visible || metadataError.visible ||
      posterError.visible || integrity.visible,
    exhaustedSurfacePresent: exhausted.visible,
    agreedSurfacePresent: agreed.visible,
  });
}

export async function candidateHarness(participants: SafeDiagnostics[], baseURL: string) {
  if (participants.length < 2 || participants.length > 4 || new Set(participants).size !== participants.length) throw safeError();
  const local = process.env.EXPO_PUBLIC_SUPABASE_URL ? process.env : parseEnv(fs.readFileSync('.env.local','utf8'));
  const apiOrigin = new URL(local.EXPO_PUBLIC_SUPABASE_URL ?? '').origin;
  const appOrigin = new URL(baseURL).origin;
  if (![apiOrigin,appOrigin].every(origin => ['127.0.0.1','localhost','[::1]'].includes(new URL(origin).hostname))) throw safeError();
  let binding: { room: RoomProjection; ids: string[]; api: PublicApi } | null = null;
  let failed = false, disposed = false;
  let failureGuard: CandidateHealthGuard | null = null;
  let failureStatus: number | null = null;
  let failureOutcome: CandidateHealthGuardDiagnostic['responseOutcome'] = 'unreadable';
  let failureReadState = unreadResponseState();
  const intentionallyConsumed = new WeakSet<Request>();
  const requestLifecycle = new WeakMap<Request, { finished: boolean; failed: boolean;
    settle: () => void }>();
  const requestSettlements = new Map<Request, Promise<void>>();
  const failedRequests = new Map<Request, number>();
  let requestEpoch = 0;
  let replacement: { phase: 'draining' | 'navigating'; pendingCommits: Set<Page> } | null = null;
  const stats = participants.map(() => ({ requests: 0, responses: 0, errors: 0, posters: 0,
    directTmdbApi: 0, fixture: 0, invalid: 0 }));
  const presentationRequests = participants.map(() => emptyPresentationRequest());
  const pending = new Set<Promise<void>>();
  const fail = (index: number, guard: CandidateHealthGuard, status: number | null = null,
    outcome: CandidateHealthGuardDiagnostic['responseOutcome'] = 'unreadable',
    readState: CandidateResponseReadState = unreadResponseState()) => {
    stats[index].invalid++; failed = true;
    if (!failureGuard) {
      failureGuard = guard; failureStatus = status; failureOutcome = outcome;
      failureReadState = { ...readState };
    }
  };
  const healthDiagnostic = (guard: CandidateHealthGuard) => candidateHealthGuardDiagnostic({
    guard, participants: participants.length,
    requests: stats.reduce((sum, value) => sum + value.requests, 0),
    responses: stats.reduce((sum, value) => sum + value.responses, 0),
    errors: stats.reduce((sum, value) => sum + value.errors, 0),
    invalid: stats.reduce((sum, value) => sum + value.invalid, 0),
    directProvider: stats.reduce((sum, value) => sum + value.directTmdbApi, 0),
    fixture: stats.reduce((sum, value) => sum + value.fixture, 0),
    responseValidationActive: pending.size, httpStatus: failureStatus,
    responseOutcome: failureOutcome, ...failureReadState,
    failed, disposed, bindingPresent: binding !== null,
  });
  const emitHealthFailure = (guard: CandidateHealthGuard) => {
    participants[0].recordHarnessDiagnostic(healthDiagnostic(guard));
  };
  const listeners = participants.map((participant,index) => {
    const onRequest = (request: Request) => {
      if (disposed) return;
      const url = new URL(request.url());
      if (url.hostname === 'api.themoviedb.org') stats[index].directTmdbApi++;
      if (/cardboard-comet|pebble-bay-lanterns|cloud-tram-four|clockwork-orchard|movie_candidates|ensure_room_candidate/i.test(request.url())) stats[index].fixture++;
      if (!endpoint(request.url())) return;
      requestEpoch++;
      stats[index].requests++;
      presentationRequests[index] = { ...emptyPresentationRequest(), state: 'pending',
        attempts: Math.min(presentationRequests[index].attempts + 1, 100),
        recoveryActive: presentationRequests[index].state === 'failed' };
      let settle!: () => void;
      const settlement = new Promise<void>(resolve => { settle = resolve; });
      requestLifecycle.set(request, { finished: false, failed: false, settle });
      requestSettlements.set(request, settlement);
      try {
        if (url.origin !== apiOrigin) return fail(index, 'request-origin');
        if (request.method() !== 'POST') return fail(index, 'request-method');
        const body = request.postDataJSON();
        if (Object.keys(body ?? {}).join(',') !== 'room_id') return fail(index, 'request-shape');
        if (!binding || body.room_id !== binding.room.id) return fail(index, 'request-room');
        const bearer = request.headers().authorization?.match(/^Bearer (.+)$/)?.[1];
        const subject = bearer ? JSON.parse(Buffer.from(bearer.split('.')[1], 'base64url').toString()).sub : null;
        if (subject !== binding.ids[index]) return fail(index, 'request-subject');
      } catch { fail(index, 'request-subject'); }
    };
    const onResponse = (response: Response) => {
      if (!endpoint(response.url())) return;
      const request = response.request();
      if (intentionallyConsumed.has(request)) return;
      const work = (async () => {
        const state = unreadResponseState();
        const snapshotLifecycle = () => {
          const lifecycle = requestLifecycle.get(request);
          state.requestFinished = state.bodyBytesObtained || lifecycle?.finished === true;
          state.requestFailed = lifecycle?.failed ?? false;
          state.pageAlive = typeof participant.page.isClosed !== 'function' || !participant.page.isClosed();
          state.contextAlive = contextIsAlive(participant.page);
        };
        state.responseReadStage = 'body-requested';
        let bytes: Buffer;
        try { bytes = await response.body(); }
        catch (error) {
          Object.assign(state, classifyCandidateResponseReadFailure(error)); snapshotLifecycle();
          presentationRequests[index] = { ...presentationRequests[index], state: 'failed',
            httpStatusClass: httpStatusClass(response.status()), resultClass: 'unreadable' };
          if (!disposed) fail(index, 'response-body', response.status(), 'unreadable', state);
          return;
        }
        state.responseReadStage = 'body-obtained'; state.bodyBytesObtained = true;
        state.bodyLength = Math.min(bytes.length, 4097); snapshotLifecycle();
        if (bytes.length > 4096) {
          state.responseFailure = 'oversize';
          presentationRequests[index] = { ...presentationRequests[index], state: 'failed',
            httpStatusClass: httpStatusClass(response.status()), resultClass: 'unreadable' };
          fail(index, 'response-size', response.status(), 'unreadable', state); return;
        }
        if (bytes.length === 0) {
          state.responseFailure = 'empty-body';
          presentationRequests[index] = { ...presentationRequests[index], state: 'failed',
            httpStatusClass: httpStatusClass(response.status()), resultClass: 'unreadable' };
          fail(index, 'response-json', response.status(), 'unreadable', state); return;
        }
        let value: any;
        try { value = JSON.parse(bytes.toString('utf8')); }
        catch {
          state.responseFailure = 'malformed-json';
          presentationRequests[index] = { ...presentationRequests[index], state: 'failed',
            httpStatusClass: httpStatusClass(response.status()), resultClass: 'unreadable' };
          if (!disposed) fail(index, 'response-json', response.status(), 'unreadable', state);
          return;
        }
        state.responseReadStage = 'json-decoded'; state.jsonDecoded = true;
        const outcome: CandidateHealthGuardDiagnostic['responseOutcome'] =
          response.status() === 503 && value?.error === 'candidate_acquisition_unavailable'
            ? 'candidate_acquisition_unavailable'
            : ['available','exhausted','metadata_unavailable','not_ready','not_found','no_candidates',
              'refresh_required'].includes(value?.outcome) ? value.outcome : 'unknown';
        const valid = response.ok() ? strictAvailable(value) ||
          value?.outcome === 'exhausted' && Object.keys(value).sort().join(',') === 'candidate_progression_status,candidate_sequence,outcome' ||
          value?.outcome === 'metadata_unavailable' && Object.keys(value).sort().join(',') === 'candidate_progression_status,candidate_sequence,outcome' ||
          ['not_ready','not_found','no_candidates','refresh_required'].includes(value?.outcome) && Object.keys(value).length === 1
          : response.status() === 503 && JSON.stringify(value) === '{"error":"candidate_acquisition_unavailable"}';
        state.responseReadStage = 'contract-checked';
        if (!valid) {
          state.responseFailure = 'contract';
          presentationRequests[index] = { ...presentationRequests[index], state: 'failed',
            httpStatusClass: httpStatusClass(response.status()), resultClass: 'unreadable' };
          fail(index, 'response-contract', response.status(), outcome, state); return;
        }
        const available = value?.outcome === 'available' && strictAvailable(value);
        const resultClass: CandidatePresentationDiagnostic['metadataResultClass'] = available
          ? 'available' : value?.outcome === 'metadata_unavailable' ? 'metadata_unavailable' :
            response.status() === 503 && value?.error === 'candidate_acquisition_unavailable'
              ? 'candidate_acquisition_unavailable' : response.ok() ? 'other-success' : 'other-failure';
        presentationRequests[index] = { ...presentationRequests[index],
          state: resultClass === 'metadata_unavailable' ||
            resultClass === 'candidate_acquisition_unavailable' || !response.ok() ? 'failed' : 'completed',
          httpStatusClass: httpStatusClass(response.status()), resultClass,
          titlePresent: available && typeof value.candidate?.title === 'string',
          releaseYearPresent: available && Number.isInteger(value.candidate?.release_year),
          posterPresent: available && typeof value.candidate?.poster_url === 'string',
          candidateSequence: Number.isSafeInteger(value?.candidate_sequence) &&
            value.candidate_sequence > 0 ? value.candidate_sequence : null };
        stats[index][response.ok() ? 'responses' : 'errors']++;
      })().finally(() => pending.delete(work));
      pending.add(work);
    };
    const posterRoute = async (route: Route) => {
      stats[index].posters++;
      await route.fulfill({ status: 200, contentType: 'image/png', body: posterPng });
    };
    const onRequestFinished = (request: Request) => {
      const lifecycle = requestLifecycle.get(request);
      if (lifecycle && !lifecycle.finished && !lifecycle.failed) {
        lifecycle.finished = true; requestSettlements.delete(request); lifecycle.settle();
      }
    };
    const onRequestFailed = (request: Request) => {
      const lifecycle = requestLifecycle.get(request);
      if (lifecycle && !lifecycle.finished && !lifecycle.failed) {
        lifecycle.failed = true; requestSettlements.delete(request); lifecycle.settle();
        presentationRequests[index] = { ...presentationRequests[index], state: 'failed',
          httpStatusClass: 'network', resultClass: 'unreadable' };
        if (!intentionallyConsumed.has(request)) failedRequests.set(request, index);
      }
    };
    participant.page.on('request',onRequest); participant.page.on('response',onResponse);
    participant.page.on('requestfinished', onRequestFinished);
    participant.page.on('requestfailed', onRequestFailed);
    return { participant, onRequest, onResponse, onRequestFinished, onRequestFailed, posterRoute };
  });
  const replacementRoutes = participants.map(participant => ({ participant, handler: async (route: Route) => {
    const request = route.request();
    if (replacement?.phase === 'navigating' && replacement.pendingCommits.has(participant.page)) {
      intentionallyConsumed.add(request);
      await route.abort('aborted');
      return;
    }
    await route.fallback();
  } }));
  for (const item of listeners) await item.participant.page.route('https://image.tmdb.org/**', item.posterRoute);
  for (const item of replacementRoutes)
    await item.participant.page.route('**/functions/v1/room-candidate', item.handler);
  const emitPresentationDiagnostic = async (page: Page,
    expected: ControlledCandidateFixture = controlledCandidate) => {
    const index = participants.findIndex(item => item.page === page);
    const owner = index >= 0 ? participants[index] : participants[0];
    let canonical: CandidateTerminalProjection | null = null;
    let canonicalIdentityPresent = false;
    if (binding) {
      try {
        const stored = committedRoomSnapshot(binding.room).row;
        canonical = stored;
        canonicalIdentityPresent = typeof stored.tmdb_movie_id === 'number';
      } catch { /* Fixed unavailable canonical fields preserve the safe shape. */ }
    }
    owner.recordHarnessDiagnostic(await inspectCandidatePresentation(page,
      index >= 0 ? presentationRequests[index] : emptyPresentationRequest(),
      canonical, canonicalIdentityPresent, expected));
  };
  return {
    stats,
    bind(room: RoomProjection, ids: string[], api: PublicApi) {
      if (binding || ids.length !== participants.length || new Set(ids).size !== ids.length || api.origin !== apiOrigin) throw safeError();
      binding = { room, ids: [...ids], api };
    },
    rebind(room: RoomProjection) {
      if (!binding || binding.room.id === room.id) throw safeError();
      binding = { ...binding, room };
      for (let index = 0; index < presentationRequests.length; index++)
        presentationRequests[index] = emptyPresentationRequest();
    },
    async available(pages: Page[] = participants.map(item => item.page),
      expected: ControlledCandidateFixture = controlledCandidate) {
      for (const page of pages) {
        try {
          await expect(page.getByRole('heading',{name:expected.title,exact:true}))
            .toBeVisible({timeout:30000});
        } catch {
          await emitPresentationDiagnostic(page, expected);
          throw safeError();
        }
        await expect(page.getByTestId('candidate-year')).toHaveText(String(expected.releaseYear));
        const poster=page.getByTestId('candidate-poster');
        await expect(poster).toBeVisible();
        await expect(poster).toHaveAttribute('aria-label',`Poster for ${expected.title}`);
        expect(await page.evaluate(id => !document.body.innerText.includes(String(id)) &&
          !/Cardboard Comet|Pebble Bay Lanterns|Cloud Tram Four|Clockwork Orchard/.test(document.body.innerText),
          expected.tmdbMovieId)).toBe(true);
      }
    },
    async successorAvailable(pages: Page[] = participants.map(item => item.page)) {
      for (const page of pages) {
        await expect(page.getByRole('heading',{name:controlledSuccessor.title,exact:true}))
          .toBeVisible({timeout:30000});
        await expect(page.getByTestId('candidate-year')).toHaveText(String(controlledSuccessor.releaseYear));
      }
    },
    async noCandidates(pages: Page[] = participants.map(item => item.page)) {
      const expected = 'initial-empty';
      if (!binding) { participants[0].recordHarnessDiagnostic(terminalDiagnostic(
        'binding-present', expected, null, false, false)); throw safeError(); }
      let room: CandidateTerminalProjection;
      try { room = await waitForCandidateTerminal(() => committedRoomSnapshot(binding!.room).row,
        expected); }
      catch {
        try { room = committedRoomSnapshot(binding.room).row; }
        catch { participants[0].recordHarnessDiagnostic(terminalDiagnostic(
          'snapshot-readable', expected, null, true, false)); throw safeError(); }
        const guard = terminalGuard(expected, room) ?? 'terminal-kind';
        participants[0].recordHarnessDiagnostic(terminalDiagnostic(
          guard, expected, room, true, true)); throw safeError();
      }
      const expectation = candidateTerminalExpectation(room);
      if (expectation.kind !== expected) { participants[0].recordHarnessDiagnostic(terminalDiagnostic(
        'terminal-kind', expected, room, true, true)); throw safeError(); }
      for (const page of pages) {
        await expect(page.getByTestId('candidate-status')).toHaveText(expectation.copy);
        await expect(page.getByTestId('candidate-progression-status')).toHaveCount(0);
        await expect(page.getByRole('link',{name:'Create a new room',exact:true})).toHaveAttribute('href','/');
        await expect(page.getByRole('button',{name:/Retry finding a movie/})).toHaveCount(0);
      }
    },
    async exhausted(pages: Page[] = participants.map(item => item.page)) {
      const expected = 'exhausted';
      if (!binding) { participants[0].recordHarnessDiagnostic(terminalDiagnostic(
        'binding-present', expected, null, false, false)); throw safeError(); }
      let room: CandidateTerminalProjection;
      try { room = await waitForCandidateTerminal(() => committedRoomSnapshot(binding!.room).row,
        expected); }
      catch {
        try { room = committedRoomSnapshot(binding.room).row; }
        catch { participants[0].recordHarnessDiagnostic(terminalDiagnostic(
          'snapshot-readable', expected, null, true, false)); throw safeError(); }
        const guard = terminalGuard(expected, room) ?? 'terminal-kind';
        participants[0].recordHarnessDiagnostic(terminalDiagnostic(
          guard, expected, room, true, true)); throw safeError();
      }
      const expectation = candidateTerminalExpectation(room);
      if (expectation.kind !== expected) { participants[0].recordHarnessDiagnostic(terminalDiagnostic(
        'terminal-kind', expected, room, true, true)); throw safeError(); }
      for (const page of pages) {
        await expect(page.getByTestId('candidate-status')).toHaveText(expectation.copy);
        await expect(page.getByTestId('candidate-progression-status')).toHaveText(expectation.copy);
        await expect(page.getByRole('link',{name:'Create a new room',exact:true})).toHaveAttribute('href','/');
        await expect(page.getByRole('button',{name:/Retry finding a movie/})).toHaveCount(0);
      }
    },
    async acquisitionError(page: Page) {
      await expect(page.getByText('Unable to find a movie right now. Please try again.',{exact:true}))
        .toBeVisible({timeout:30000});
      await expect(page.getByRole('button',{name:'Retry finding a movie',exact:true})).toBeVisible();
    },
    async metadataError(page: Page) {
      await expect(page.getByText('Unable to load movie details. Please try again.',{exact:true})).toBeVisible();
      await expect(page.getByRole('button',{name:'Retry movie details',exact:true})).toBeVisible();
    },
    async failPosterOnce(index: number) {
      let calls=0;
      const route=async(value:Route)=>{calls++;if(calls===1)await value.abort('failed');else await value.fulfill({status:200,contentType:'image/png',body:posterPng});};
      await participants[index].page.route('https://image.tmdb.org/**',route);
      return { calls:()=>calls, close:()=>participants[index].page.unroute('https://image.tmdb.org/**',route) };
    },
    async discardNextResponse(index: number) {
      let committed=false,calls=0,settled=false;
      const route=async(value:Route)=>{calls++;intentionallyConsumed.add(value.request());let diagnosed=false;
        try{const response=await value.fetch({maxRetries:0,maxRedirects:0,timeout:30000});
          try{const state=unreadResponseState();state.responseReadStage='body-requested';
            state.pageAlive=typeof participants[index].page.isClosed!=='function'||!participants[index].page.isClosed();
            state.contextAlive=contextIsAlive(participants[index].page);
            let bytes:Buffer;try{bytes=await response.body();}catch(error){diagnosed=true;
              Object.assign(state,classifyCandidateResponseReadFailure(error));
              fail(index,'response-body',response.status(),'unreadable',state);emitHealthFailure('response-body');return;}
            state.responseReadStage='body-obtained';state.bodyBytesObtained=true;
            state.bodyLength=Math.min(bytes.length,4097);state.requestFinished=true;
            if(bytes.length>4096){diagnosed=true;state.responseFailure='oversize';
              fail(index,'response-size',response.status(),'unreadable',state);
              emitHealthFailure('response-size');return;}
            if(bytes.length===0){diagnosed=true;state.responseFailure='empty-body';
              fail(index,'response-json',response.status(),'unreadable',state);emitHealthFailure('response-json');return;}
            let parsed:any;try{parsed=JSON.parse(bytes.toString('utf8'));}catch{diagnosed=true;
              state.responseFailure='malformed-json';fail(index,'response-json',response.status(),'unreadable',state);
              emitHealthFailure('response-json');return;}
            state.responseReadStage='json-decoded';state.jsonDecoded=true;
            committed=response.ok()&&strictAvailable(parsed);
            if(!committed){diagnosed=true;const outcome:CandidateHealthGuardDiagnostic['responseOutcome']=
                ['available','exhausted','metadata_unavailable','not_ready','not_found','no_candidates',
                  'refresh_required'].includes(parsed?.outcome)?parsed.outcome:'unknown';
              state.responseReadStage='contract-checked';state.responseFailure='contract';
              fail(index,'response-contract',response.status(),outcome,state);emitHealthFailure('response-contract');}}
          finally{await response.dispose();}await value.abort('failed');
        }catch(error){if(!diagnosed&&!disposed){const state={...unreadResponseState(),
            ...classifyCandidateResponseReadFailure(error),pageAlive:typeof participants[index].page.isClosed!=='function'||
              !participants[index].page.isClosed(),contextAlive:contextIsAlive(participants[index].page)};
            fail(index,'response-body',null,'unreadable',state);emitHealthFailure('response-body');}}
        finally{settled=true;}};
      await participants[index].page.route('**/functions/v1/room-candidate',route,{times:1});
      return { calls:()=>calls, committed:()=>committed, settled:()=>settled,
        close:()=>participants[index].page.unroute('**/functions/v1/room-candidate',route) };
    },
    async drainResponses() {
      let observedEpoch: number;
      do {
        observedEpoch = requestEpoch;
        await Promise.allSettled([...requestSettlements.values(), ...pending]);
        await new Promise<void>(resolve => setImmediate(resolve));
      } while (requestSettlements.size > 0 || pending.size > 0 || requestEpoch !== observedEpoch);
      if (!failed && failedRequests.size > 0) {
        const [, index] = failedRequests.entries().next().value!;
        const state = unreadResponseState();
        state.responseFailure = 'network'; state.exceptionCategory = 'generic-error';
        state.requestFailed = true;
        state.pageAlive = typeof participants[index].page.isClosed !== 'function' ||
          !participants[index].page.isClosed();
        state.contextAlive = contextIsAlive(participants[index].page);
        fail(index, 'response-body', null, 'unreadable', state);
      }
      if (failed && failureGuard) { emitHealthFailure(failureGuard); throw safeError(); }
    },
    async replaceDocuments<T>(pages: readonly Page[], navigate: () => Promise<T>): Promise<T> {
      if (replacement || pages.length < 1 || pages.length > participants.length ||
          new Set(pages).size !== pages.length || pages.some(page =>
            !participants.some(participant => participant.page === page))) throw safeError();
      const pendingCommits = new Set(pages);
      replacement = { phase: 'draining', pendingCommits };
      const navigations = pages.map(page => ({ page, handler: (frame: Frame) => {
        if (frame === page.mainFrame()) pendingCommits.delete(page);
      } }));
      for (const item of navigations) item.page.on('framenavigated', item.handler);
      try {
        await this.drainResponses();
        replacement.phase = 'navigating';
        return await navigate();
      } finally {
        for (const item of navigations) item.page.removeListener('framenavigated', item.handler);
        replacement = null;
      }
    },
    assertHealthy() {
      const guard = failureGuard ?? (disposed ? 'not-disposed' : !binding ? 'binding-present' :
        stats.some(value => value.invalid) ? 'invalid-zero' :
          stats.some(value => value.directTmdbApi) ? 'direct-provider-zero' :
            stats.some(value => value.fixture) ? 'fixture-zero' : null);
      if (failed || guard) { emitHealthFailure(guard ?? 'invalid-zero'); throw safeError(); }
    },
    async close() {
      if (disposed) return; disposed=true;
      await Promise.allSettled([...pending]);
      for(const item of listeners){item.participant.page.removeListener('request',item.onRequest);
        item.participant.page.removeListener('response',item.onResponse);
        item.participant.page.removeListener('requestfinished', item.onRequestFinished);
        item.participant.page.removeListener('requestfailed', item.onRequestFailed);
        await item.participant.page.unroute('https://image.tmdb.org/**',item.posterRoute);}
      await Promise.all(replacementRoutes.map(item => item.participant.page.unroute(
        '**/functions/v1/room-candidate', item.handler)));
      pending.clear(); requestSettlements.clear(); failedRequests.clear(); binding=null;
    },
  };
}
