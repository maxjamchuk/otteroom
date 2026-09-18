/** @jest-environment node */
import { spawnSync } from 'node:child_process';

// Exercise the very same native-TypeScript/ESM modules as the Node controller.
// Only runtime synthetic values enter the isolated child; never print its raw output.
function verify(source: string) {
  const result = spawnSync(process.execPath, ['--input-type=module'], {
    cwd: process.cwd(),
    input: source,
    encoding: 'utf8',
    timeout: 20000,
    maxBuffer: 131072,
  });
  expect(result.error === undefined).toBe(true);
  expect(result.status).toBe(0);
}

const prelude = `
  import assert from 'node:assert/strict';
  import { randomUUID } from 'node:crypto';
  import fs from 'node:fs';
  import os from 'node:os';
  import path from 'node:path';
  const sentinel = () => 'synthetic-' + randomUUID();
`;

it('Feature 007 diagnostics retain only fixed categories and bounded aggregate counts', () => verify(prelude + `
  const { decisionDiagnostic } = await import('./e2e/support/safe-diagnostics.ts');
  for (const category of ['authentication','recovery','submission','synchronization','performance'])
    assert.deepEqual(decisionDiagnostic(category,{attempts:20,recoverableFailures:0}),
      {component:'candidate-decision',category,attempts:20,recoverableFailures:0});
  for (const value of [{attempts:21,recoverableFailures:0},{attempts:1,recoverableFailures:2},
    {attempts:1,recoverableFailures:0,room_id:'synthetic'}])
    assert.throws(()=>decisionDiagnostic('submission',value));
  for (const category of ['yes','no','peer','raw-rpc',sentinel()])
    assert.throws(()=>decisionDiagnostic(category,{attempts:1,recoverableFailures:0}));
`));

it('Feature 006 diagnostics accept only fixed failure categories and bounded aggregate counts', () => verify(prelude + `
  const { candidateDiagnostic } = await import('./e2e/support/safe-diagnostics.ts');
  for (const category of ['authentication','request','preflight','search_incomplete','assignment','metadata','poster']) {
    const value = candidateDiagnostic(category,{attempts:3,pages:2,shards:1});
    assert.deepEqual(value,{component:'room-candidate',category,attempts:3,pages:2,shards:1});
  }
  for (const bad of [
    ['timeout',{attempts:1,pages:0,shards:0}],
    ['metadata',{attempts:101,pages:0,shards:0}],
    ['poster',{attempts:1,pages:0,shards:0,room_id:sentinel()}],
    ['search_incomplete',{attempts:1,pages:0,shards:0,token:sentinel()}],
  ]) assert.throws(()=>candidateDiagnostic(bad[0],bad[1]),/E2E_SAFE_FAILURE/);
  const source=fs.readFileSync('e2e/support/safe-diagnostics.ts','utf8');
  assert.equal(/Authorization|genre_clauses|release_year_from|tmdb_movie_id|upstream_payload/.test(
    source.slice(source.indexOf('export function candidateDiagnostic'),source.indexOf('export function candidateDiagnostic')+1200)),false);
`));

describe('credential-safe diagnostics boundaries', () => {
  it('validates only the exact safe participant-filter RPC projection', () => verify(prelude + `
    const { validateOwnFilterResult } = await import('./e2e/support/filter-harness.ts');
    const saved = [{ outcome: 'saved', genres: ['action', 'comedy'], release_year_from: 1990,
      release_year_to: 2026, filter_completed_count: 1, required_voter_count: 2,
      allowed_release_year_max: 2026 }];
    assert.deepEqual(validateOwnFilterResult(saved), saved[0]);
    for (const bad of [[], [{ ...saved[0], room_id: randomUUID() }], [{ ...saved[0], genres: ['comedy', 'action'] }],
      [{ ...saved[0], outcome: 'not_ready', genres: ['action'] }]]) assert.throws(() => validateOwnFilterResult(bad), /E2E_SAFE_FAILURE/);
  `));
  it('cleans participant-filter abort, loss, hold and overlap barriers without retaining payloads', () => verify(prelude + `
    const { installPreCommitFailure, installCommittedResponseLoss, installSubmitHold, installSubmitOverlap } =
      await import('./e2e/support/filter-harness.ts');
    const makePage = () => ({ routes: [], async route(match, handler) { this.routes.push({ match, handler }); },
      async unroute(match, handler) { this.routes = this.routes.filter(item => item.match !== match || item.handler !== handler); } });
    const body = { p_room_id: randomUUID(), p_genres: ['action'], p_release_year_from: 1900, p_release_year_to: 2026 };
    const request = () => ({ postDataJSON: () => body });
    const first = makePage(), abort = await installPreCommitFailure(first); let aborted = 0;
    await first.routes[0].handler({ abort: async () => { aborted++; } });
    assert.equal(abort.calls(), 1); await abort.close(); assert.equal(first.routes.length, 0); assert.equal(aborted, 1);
    const loss = await installCommittedResponseLoss(first); let disposed = 0;
    await first.routes[0].handler({ fetch: async options => { assert.deepEqual(options, { maxRetries: 0, maxRedirects: 0, timeout: 15000 });
      return { ok: () => true, json: async () => [{ outcome: 'saved', genres: ['action'], release_year_from: 1900,
        release_year_to: 2026, filter_completed_count: 1, required_voter_count: 2, allowed_release_year_max: 2026 }],
        dispose: async () => { disposed++; } }; }, abort: async () => { aborted++; } });
    assert.equal(loss.calls(), 1); assert.equal(loss.result().outcome, 'saved'); assert.equal(disposed, 1);
    await loss.close(); assert.equal(first.routes.length, 0);
    const held = await installSubmitHold(first); let continued = 0;
    const heldCall = first.routes[0].handler({ continue: async () => { continued++; } }); await held.wait();
    assert.equal(held.calls(), 1); held.release(); await heldCall; await held.close(); assert.equal(first.routes.length, 0); assert.equal(continued, 1);
    const pages = [makePage(), makePage()], overlap = await installSubmitOverlap(pages);
    const calls = pages.map(page => page.routes[0].handler({ request, continue: async () => { continued++; }, abort: async () => { aborted++; } }));
    await overlap.wait(); overlap.release(); await Promise.all(calls); await overlap.close();
    assert.equal(pages.every(page => page.routes.length === 0), true); assert.equal(continued, 3);
    assert.equal(JSON.stringify(overlap).includes(body.p_room_id), false);
  `));
  it('scopes candidate traffic by room without requiring one request per page or replacing browser requests', () => verify(prelude + `
    const { isolateCandidateAcquisition } = await import('./e2e/support/room-harness.ts');
    const { installCandidateRequestOverlap } = await import('./e2e/support/candidate-harness.ts');
    const makePage = () => ({ routes: [], events: new Map(),
      async route(match, handler) { this.routes.push({ match, handler }); },
      async unroute(match, handler) { this.routes = this.routes.filter(item => item.match !== match || item.handler !== handler); },
      on(name, handler) { if (!this.events.has(name)) this.events.set(name, new Set()); this.events.get(name).add(handler); },
      removeListener(name, handler) { this.events.get(name)?.delete(handler); },
      emit(name, value) { for (const handler of this.events.get(name) ?? []) handler(value); } });
    const room = id => ({ id, code: 'ABCDEF0123', state: 'ready', voter_count: 2,
      required_voter_count: 2, filter_completed_count: 2, filter_resolution_status: 'compatible',
      candidate_acquisition_status: 'pending', decision_completed_count: 0 });
    const firstRoom = room('11111111-1111-4111-8111-111111111111');
    const secondRoom = room('22222222-2222-4222-8222-222222222222');
    const isolatedPages = [makePage(), makePage()];
    const isolated = await isolateCandidateAcquisition(isolatedPages);
    isolated.allow(firstRoom); isolated.allow(secondRoom);
    // Historical H02/H03 may validly reach compatible authority without any
    // later-feature candidate dispatch. Zero traffic must already be drained.
    await isolated.drain(secondRoom);
    let fulfilled = 0;
    await isolatedPages[0].routes[0].handler({
      request: () => ({ method: () => 'POST', postDataJSON: () => ({ room_id: firstRoom.id }) }),
      fulfill: async value => { assert.equal(value.body, '{"outcome":"not_ready"}'); fulfilled++; },
      abort: async () => { throw new Error('unexpected abort'); },
    });
    await isolated.drain(firstRoom); assert.equal(fulfilled, 1);
    await isolated.close(); assert.equal(isolatedPages.every(page => page.routes.length === 0), true);

    const pages = [makePage(), makePage(), makePage()];
    const overlap = await installCandidateRequestOverlap(pages, firstRoom);
    let forwarded = 0;
    const candidate = { outcome: 'available', candidate: { tmdb_movie_id: 6006,
      title: 'Controlled Constellation', release_year: 2005,
      poster_url: 'https://image.tmdb.org/t/p/w500/controlled.png' } };
    const call = page => {
      const request = { method: () => 'POST', postDataJSON: () => ({ room_id: firstRoom.id }) };
      return page.routes[0].handler({ request: () => request,
        continue: async () => { forwarded++; const response = { request: () => request, status: () => 200,
          body: async () => Buffer.from(JSON.stringify(candidate)) }; page.emit('response', response);
          page.emit('requestfinished', request); },
        abort: async () => { throw new Error('unexpected abort'); },
      });
    };
    const calls = [call(pages[0]), call(pages[1])];
    await overlap.wait(); overlap.release(); await Promise.all(calls); await overlap.drain();
    assert.equal(forwarded, 2); assert.deepEqual(overlap.results(), [
      { status: 200, outcome: 'available' }, { status: 200, outcome: 'available' }]);
    await overlap.close();
    assert.equal(pages.every(page => page.routes.length === 0), true);
  `));
  it('classifies every containment and native candidate drain subcondition independently', () => verify(prelude + `
    const { containmentDiagnostic, candidateBoundaryDiagnostic, candidateOverlapDiagnostic,
      filterResolutionBoundaryDiagnostic, parseHarnessDiagnostic } =
      await import('./e2e/support/harness-observability.ts');
    const containment = (patch = {}) => containmentDiagnostic({ handoffs: 0, activeHandlers: 0,
      handlersStarted: 0, handlersCompleted: 0, handlerFailures: 0, requestCancellations: 0,
      reopenedAfterDrain: 0, harnessFailures: 0, disposed: false, ...patch });
    assert.equal(containment().classification, 'no-handoff');
    assert.equal(containment({ handoffs: 1, activeHandlers: 1, handlersStarted: 1 }).classification, 'active-handler');
    assert.equal(containment({ handoffs: 2, activeHandlers: 1, handlersStarted: 2,
      handlersCompleted: 1, reopenedAfterDrain: 1 }).classification, 'new-work-after-drain');
    assert.equal(containment({ handoffs: 1, handlersStarted: 1, handlersCompleted: 1,
      handlerFailures: 1 }).classification, 'handler-failure');
    assert.equal(containment({ handoffs: 1, handlersStarted: 1, handlersCompleted: 1,
      requestCancellations: 1 }).classification, 'request-cancellation');
    assert.equal(containment({ harnessFailures: 1 }).classification, 'other');
    assert.equal(containment({ disposed: true }).classification, 'disposed');
    assert.deepEqual(parseHarnessDiagnostic(containment({ handoffs: 1, activeHandlers: 1,
      handlersStarted: 1 })), containment({ handoffs: 1, activeHandlers: 1, handlersStarted: 1 }));

    const boundary = (patch = {}) => candidateBoundaryDiagnostic({ phase: 'before-drain',
      expectedResolution: 'compatible', filterResolution: 'compatible', candidateStatus: 'pending',
      authoritativeCandidateNull: true, relatedCandidateEvidenceNull: true, decisionCount: 0, ...patch });
    assert.deepEqual(boundary().missing, []); assert.equal(boundary().compatible, true);
    const incompatible = boundary({ expectedResolution: 'incompatible', filterResolution: 'incompatible' });
    assert.deepEqual(incompatible.missing, []); assert.equal(incompatible.compatible, false);
    assert.deepEqual(boundary({ filterResolution: 'incompatible' }).missing, ['resolution-mismatch']);
    assert.deepEqual(boundary({ candidateStatus: 'assigned' }).missing, ['candidate-pending']);
    assert.deepEqual(boundary({ authoritativeCandidateNull: false }).missing,
      ['authoritative-candidate-null']);
    assert.deepEqual(boundary({ relatedCandidateEvidenceNull: false }).missing,
      ['related-candidate-evidence-null']);
    assert.deepEqual(boundary({ decisionCount: 1 }).missing, ['decisions-zero']);
    const everyBoundaryFailure = boundary({ filterResolution: 'pending', candidateStatus: 'no_candidates',
      authoritativeCandidateNull: false, relatedCandidateEvidenceNull: false, decisionCount: 2 });
    assert.deepEqual(everyBoundaryFailure.missing, ['resolution-mismatch','candidate-pending',
      'authoritative-candidate-null','related-candidate-evidence-null','decisions-zero']);
    assert.deepEqual(parseHarnessDiagnostic(incompatible), incompatible);

    const resolutionBoundary = (patch = {}) => filterResolutionBoundaryDiagnostic({
      operationPhase: 'concurrent-filter-submission', expectedFilterCount: 2,
      authoritativeFilterCount: 2, expectedResolution: 'compatible',
      filterResolution: 'compatible', terminalViewObserved: true,
      resolverRequestsObserved: 2, resolverResponsesObserved: 2,
      resolverSuccessResponses: 2, resolverRequestFailures: 0, ...patch });
    assert.deepEqual(resolutionBoundary().missing, []);
    assert.deepEqual(resolutionBoundary({ authoritativeFilterCount: 1 }).missing, ['filter-count']);
    assert.deepEqual(resolutionBoundary({ filterResolution: 'pending' }).missing, ['terminal-authority']);
    assert.deepEqual(resolutionBoundary({ terminalViewObserved: false }).missing, ['terminal-view']);
    assert.deepEqual(resolutionBoundary({ authoritativeFilterCount: 1,
      filterResolution: 'pending', terminalViewObserved: false }).missing,
      ['filter-count','terminal-authority','terminal-view']);
    assert.deepEqual(parseHarnessDiagnostic(resolutionBoundary()), resolutionBoundary());

    const request = sequence => ({ sequence, routeObserved: true, continueSucceeded: true,
      nativeResponseObserved: true, httpStatus: 200, expectedAvailable: true,
      requestFinished: true, requestFailed: 'none', active: false });
    const overlap = (patch = {}, requests = [request('req-1'), request('req-2')]) =>
      candidateOverlapDiagnostic({ forwarding: 0, responseValidationActive: 0, failed: false,
        disposed: false, provider: { state: 'observed', requests: 3, completed: 2, active: 1 },
        authority: 'absent', requests, ...patch });
    assert.deepEqual(overlap().missing, []); assert.equal(overlap().phase, 'before-authority');
    assert.deepEqual(overlap({}, [request('req-1')]).missing, ['minimum-overlap']);
    assert.deepEqual(overlap({}, [{ ...request('req-1'), continueSucceeded: false }, request('req-2')]).missing,
      ['native-continue']);
    assert.deepEqual(overlap({}, [{ ...request('req-1'), nativeResponseObserved: false,
      httpStatus: null, expectedAvailable: false }, request('req-2')]).missing,
      ['native-response','http-200-available']);
    assert.deepEqual(overlap({}, [{ ...request('req-1'), httpStatus: 503,
      expectedAvailable: false }, request('req-2')]).missing, ['http-200-available']);
    assert.deepEqual(overlap({}, [{ ...request('req-1'), requestFinished: false,
      active: true }, request('req-2')]).missing, ['request-settlement','active-request']);
    assert.deepEqual(overlap({}, [{ ...request('req-1'), requestFinished: false,
      requestFailed: 'aborted' }, request('req-2')]).missing, ['request-failure']);
    assert.deepEqual(overlap({ responseValidationActive: 1 }).missing, ['response-validation']);
    assert.deepEqual(overlap({ forwarding: 1 }).missing, ['forwarding']);
    assert.deepEqual(overlap({ failed: true }).missing, ['harness-failure']);
    assert.deepEqual(overlap({ disposed: true }).missing, ['disposed']);
    const after = overlap({ authority: 'present' }); assert.equal(after.phase, 'after-authority');
    assert.deepEqual(parseHarnessDiagnostic(after), after);

    const harness = fs.readFileSync('e2e/support/room-harness.ts','utf8');
    const beforeBoundary = harness.indexOf("assertBoundary('before-drain')");
    const drainBoundary = harness.indexOf('await drain(room)', beforeBoundary);
    const afterBoundary = harness.indexOf("assertBoundary('after-drain')", drainBoundary);
    assert.equal(beforeBoundary >= 0 && beforeBoundary < drainBoundary && drainBoundary < afterBoundary, true);
    const h02 = fs.readFileSync('e2e/participant-filters.spec.ts','utf8');
    const installContainment = h02.indexOf('await isolateCandidateAcquisition(pages, diagnostics)');
    const createFirstRoom = h02.indexOf('await createWaiting(', installContainment);
    const allowFirstRoom = h02.indexOf('candidateIsolation.allow(initial.room)', createFirstRoom);
    const firstFilterSubmission = h02.indexOf('submitOwnFilter(', allowFirstRoom);
    assert.equal(installContainment >= 0 && installContainment < createFirstRoom &&
      createFirstRoom < allowFirstRoom && allowFirstRoom < firstFilterSubmission, true);
    assert.equal(h02.includes("candidateIsolation.wait(initial.room, 'incompatible')"), true);
    assert.equal(h02.includes("candidateIsolation.wait(next.room, 'compatible')"), true);
    assert.equal(h02.includes("candidateIsolation.wait(third.room, 'compatible')"), true);
    const installConcurrentResolution = h02.indexOf('observeFilterResolutionBoundary(pages, next.room');
    const releaseConcurrentFilters = h02.indexOf('overlap.release()', installConcurrentResolution);
    const waitConcurrentResolution = h02.indexOf('await concurrentResolution.wait(first.page)', releaseConcurrentFilters);
    const inspectConcurrentCandidate = h02.indexOf("candidateIsolation.wait(next.room, 'compatible')",
      waitConcurrentResolution);
    assert.equal(installConcurrentResolution >= 0 &&
      installConcurrentResolution < releaseConcurrentFilters &&
      releaseConcurrentFilters < waitConcurrentResolution &&
      waitConcurrentResolution < inspectConcurrentCandidate, true);
    const installLostResponseResolution = h02.indexOf('observeFilterResolutionBoundary(pages, third.room');
    const finalLostResponseFilter = h02.indexOf('submitOwnFilter(second.page', installLostResponseResolution);
    const waitLostResponseResolution = h02.indexOf('await lostResponseResolution.wait(first.page)',
      finalLostResponseFilter);
    const inspectLostResponseCandidate = h02.indexOf("candidateIsolation.wait(third.room, 'compatible')",
      waitLostResponseResolution);
    assert.equal(installLostResponseResolution >= 0 &&
      installLostResponseResolution < finalLostResponseFilter &&
      finalLostResponseFilter < waitLostResponseResolution &&
      waitLostResponseResolution < inspectLostResponseCandidate, true);
    const resolutionHarness = fs.readFileSync('e2e/support/resolution-harness.ts','utf8');
    const observerStart = resolutionHarness.indexOf('export function observeFilterResolutionBoundary');
    const observerEnd = resolutionHarness.indexOf('export async function installResolutionPreCommitFailure',
      observerStart);
    const observer = resolutionHarness.slice(observerStart, observerEnd);
    for (const required of ["page.on('request'", "page.on('response'", "page.on('requestfailed'",
      'await assertResolutionView(page,expectedResolution)', 'committedRoomSnapshot(room)'])
      assert.equal(observer.includes(required), true);
    for (const forbidden of ['page.route(', 'route.fetch(', 'route.continue(', 'waitForTimeout(', 'setTimeout('])
      assert.equal(observer.includes(forbidden), false);
  `));
  it('emits bounded safe diagnostics from both drain timeout paths and retains them in the safe receipt', () => verify(prelude + `
    const { isolateCandidateAcquisition } = await import('./e2e/support/room-harness.ts');
    const { installCandidateRequestOverlap } = await import('./e2e/support/candidate-harness.ts');
    const { candidateBoundaryDiagnostic } = await import('./e2e/support/harness-observability.ts');
    const { safeResult } = await import('./e2e/support/safe-reporter.ts');
    const { scanArtifacts } = await import('./scripts/check-e2e-artifacts.mjs');
    const makePage = () => ({ routes: [], events: new Map(),
      async route(match, handler) { this.routes.push({ match, handler }); },
      async unroute(match, handler) { this.routes = this.routes.filter(item => item.match !== match || item.handler !== handler); },
      on(name, handler) { if (!this.events.has(name)) this.events.set(name, new Set()); this.events.get(name).add(handler); },
      removeListener(name, handler) { this.events.get(name)?.delete(handler); } });
    const room = { id: '11111111-1111-4111-8111-111111111111', code: 'ABCDEF0123', state: 'ready',
      voter_count: 2, required_voter_count: 2, filter_completed_count: 2,
      filter_resolution_status: 'compatible', candidate_acquisition_status: 'pending', decision_completed_count: 0 };
    const captured = [], sink = { recordHarnessDiagnostic: value => captured.push(value) };
    const first = [makePage(), makePage()], containment = await isolateCandidateAcquisition(first, sink);
    containment.allow(room); await containment.drain(room, 5);
    let release; const active = first[0].routes[0].handler({
      request: () => ({ method: () => 'POST', postDataJSON: () => ({ room_id: room.id }) }),
      fulfill: async () => new Promise(resolve => { release = resolve; }),
      abort: async () => { throw new Error('unexpected abort'); },
    });
    for(let index=0;index<20&&!release;index++)await new Promise(resolve=>setTimeout(resolve,1));
    await assert.rejects(containment.drain(room, 5));
    assert.equal(captured[0].classification, 'new-work-after-drain');
    assert.equal(captured[0].handoffs, 1); assert.equal(captured[0].activeHandlers, 1);
    release(); await active; await containment.close();
    const second = [makePage(), makePage()], overlap = await installCandidateRequestOverlap(second, room, sink);
    await assert.rejects(overlap.drain(5)); await overlap.close();
    assert.deepEqual(captured[1].missing, ['minimum-overlap']);
    assert.equal(captured[1].provider.state, 'unavailable');
    assert.equal(captured[1].authority, 'inspection-failed');
    captured.push(candidateBoundaryDiagnostic({ phase: 'before-drain', expectedResolution: 'compatible',
      filterResolution: 'incompatible', candidateStatus: 'assigned',
      authoritativeCandidateNull: false, relatedCandidateEvidenceNull: true, decisionCount: 1 }));
    const annotations = captured.map(value => ({ type: 'safe-harness-diagnostic', description: JSON.stringify(value) }));
    annotations.push({ type: 'safe-harness-diagnostic', description: JSON.stringify({ room_id: sentinel() }) });
    const receipt = safeResult({ title: '@feature006 J01 exact compatible acquisition and lifecycle convergence' },
      { status: 'failed', annotations });
    assert.deepEqual(receipt.harnessDiagnostics, captured);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'otteroom-harness-diagnostic-'));
    try { fs.writeFileSync(path.join(directory, 'summary.json'), JSON.stringify([receipt]));
      assert.equal(scanArtifacts(directory).ok, true); }
    finally { fs.rmSync(directory, { recursive: true }); }
  `));
  it('rejects unsafe QR subtrees and clears every decoded RGBA buffer on failure', () => verify(prelude + `
    const { assertSafeQrMarkup, decodeQrRgba } = await import('./e2e/support/qr-harness.ts');
    assert.doesNotThrow(() => assertSafeQrMarkup('<svg width="240" height="240" viewBox="0 0 240 240"><rect x="0" y="0" width="240" height="240" fill="#fff"/><path d="M1 1h2v2z" fill="#000"/></svg>'));
    for (const markup of [
      '<svg><script>throw 1</script></svg>', '<svg><foreignObject/></svg>', '<svg><image href="data:image/png;base64,AA"/></svg>',
      '<svg onload="bad()"><path d="M0 0"/></svg>', '<svg><text font-family="remote">x</text></svg>',
      '<svg><path style="fill:url(https://remote.invalid/x)"/></svg>', '<svg><unknown/></svg>', '<svg>' + 'x'.repeat(65536) + '</svg>',
    ]) assert.throws(() => assertSafeQrMarkup(markup), /E2E_SAFE_FAILURE/);
    for (const dimensions of [[513, 1], [1, 513], [2, 2]]) {
      const pixels = new Uint8ClampedArray(dimensions[0] * dimensions[1] * 4);
      pixels.fill(255);
      assert.throws(() => decodeQrRgba(pixels, dimensions[0], dimensions[1], 'https://example.invalid/room/ABCDEF0123'), /E2E_SAFE_FAILURE/);
      assert.equal(pixels.every(value => value === 0), true);
    }
    const source = fs.readFileSync('e2e/support/qr-harness.ts', 'utf8');
    for (const required of ['scrollIntoViewIfNeeded', 'checkVisibility', 'elementFromPoint', 'XMLSerializer', 'createObjectURL', 'revokeObjectURL', 'getImageData', 'jsQR']) assert.equal(source.includes(required), true);
    for (const forbidden of ['screenshot(', 'attach(', 'writeFile']) assert.equal(source.includes(forbidden), false);
  `));
  it('parallelizes only acceptance while keeping the security gate serial and capture off', () => verify(prelude + `
    const { default: config } = await import('./playwright.config.ts');
    assert.equal(config.fullyParallel, false); assert.equal(config.workers, 1);
    assert.equal(config.retries, 0); assert.equal(config.repeatEach, 1);
    assert.equal(config.projects.find(p => p.name === 'acceptance').fullyParallel, true);
    const security = config.projects.find(p => p.name === 'credential-safety');
    assert.equal(security.fullyParallel, false); assert.equal(security.workers, 1);
    for (const field of ['trace', 'video', 'screenshot']) assert.equal(config.use[field], 'off');
  `));

  it('registers real-shape Auth responses before delivery, counts only signups and fails closed on 429 or excess attempts', () => verify(prelude + `
    const { SafeDiagnostics } = await import('./e2e/support/safe-diagnostics.ts');
    const { CredentialRegistry, startRegistryServer } = await import('./e2e/support/credential-registry.ts');
    for (const status of [200, 429]) {
      const registry = new CredentialRegistry(); const server = await startRegistryServer(registry);
      process.env.OTTEROOM_CREDENTIAL_SOCKET = server.endpoint;
      const events = new Map(); let intercept, delivered = 0, aborted = 0, closed = 0;
      const page = { screenshot: async () => Buffer.alloc(0), pdf: async () => Buffer.alloc(0) };
      const context = { tracing: {}, request: {}, addInitScript: async () => {}, newPage: async () => page,
        on: (name, callback) => events.set(name, callback), removeListener: name => events.delete(name),
        route: async (_, handler) => { intercept = handler; }, unrouteAll: async () => {}, close: async () => { closed++; } };
      const info = { title: 'synthetic', annotations: [] };
      const d = await SafeDiagnostics.create(context, {}, info); d.allowAnonymousSignups(1);
      const access = sentinel(), refresh = sentinel();
      const request = { url: () => 'http://127.0.0.1:55321/auth/v1/signup', allHeaders: async () => ({}) };
      const response = { status: () => status, ok: () => status === 200, dispose: async () => {},
        body: async () => Buffer.from(JSON.stringify({ access_token: access, refresh_token: refresh, user: { id: 'synthetic', is_anonymous: true } })) };
      const route = { request: () => request, fetch: async options => { assert.equal(options.maxRetries, 0); return response; },
        fulfill: async () => { assert.equal(registry.hasCredential(access) && registry.hasCredential(refresh), true); delivered++; },
        abort: async () => { aborted++; } };
      try {
        events.get('request')(request); await intercept(route);
        if (status === 200) {
          await d.assertAuthAccounting(1, 1); assert.equal(delivered, 1);
          events.get('request')(request); await intercept(route);
          await assert.rejects(d.flush()); assert.equal(delivered, 1);
        } else {
          await assert.rejects(d.flush()); assert.equal(delivered, 0);
          assert.equal(info.annotations.some(x => x.type === 'safe-auth-budget'), true);
        }
        assert.equal(aborted, 1); assert.equal(JSON.stringify(info).includes(access), false);
      } finally {
        await d.close().catch(() => {}); await server.close(); registry.clear();
      }
      assert.equal(closed, 1); assert.equal(events.size, 0);
    }
  `));

  it('requires actual finalized probe artifact categories, not merely a success receipt', () => verify(prelude + `
    const { verifyProbeArtifacts } = await import('./scripts/run-e2e.mjs');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'otteroom-probe-artifacts-'));
    try {
      assert.equal(verifyProbeArtifacts(dir), false);
      for (const name of ['summary.json', 'safe-failure.png', 'safe-diagnostics.txt', 'error-context.md', 'safe-process.txt']) fs.writeFileSync(path.join(dir, name), 'synthetic');
      assert.equal(verifyProbeArtifacts(dir), true);
      fs.unlinkSync(path.join(dir, 'error-context.md'));
      assert.equal(verifyProbeArtifacts(dir), false);
    } finally { fs.rmSync(dir, { recursive: true }); }
  `));

  it('redacts known values, case-insensitive fields, bearer/JWT and secret-key shapes', () => verify(prelude + `
    const { sanitizeDiagnostic, containsCredential } = await import('./e2e/support/sanitize-diagnostics.ts');
    const values = Array.from({ length: 10 }, sentinel);
    const jwt = ['eyJ' + randomUUID().replaceAll('-', ''), randomUUID().replaceAll('-', ''), randomUUID().replaceAll('-', '')].join('.');
    const fields = ['access_token', 'ReFrEsH_ToKeN', 'Authorization', 'Cookie', 'Set-Cookie', 'service-role', 'secret_key', 'database_password'];
    for (const [i, field] of fields.entries()) {
      const structured = sanitizeDiagnostic({ message: { [field]: values[i], outcome: 'ok' } });
      const text = sanitizeDiagnostic(field + ': ' + values[i]);
      assert.equal(structured.includes(values[i]), false);
      assert.equal(text.includes(values[i]), false);
    }
    const input = 'Bearer ' + values[8] + ' ' + jwt + ' sb_secret_' + values[9].replaceAll('-', '');
    const output = sanitizeDiagnostic(input, values);
    assert.equal(values.some(v => output.includes(v)), false);
    assert.equal(output.includes(jwt), false);
    assert.equal(containsCredential(jwt), true);
    assert.equal(containsCredential(output, values), false);
    assert.equal(sanitizeDiagnostic('route ready').includes('route ready'), true);
    assert.equal(sanitizeDiagnostic({ unknown: values[0], status: 200 }).includes(values[0]), false);
    const known = (function* () { yield values[0]; })();
    assert.equal(sanitizeDiagnostic({ message: values[0], outcome: values[0] }, known).includes(values[0]), false);
  `));

  it('bounds and fails closed on oversized, cyclic and unsupported diagnostic objects', () => verify(prelude + `
    const { sanitizeDiagnostic, DiagnosticBuffer } = await import('./e2e/support/sanitize-diagnostics.ts');
    const secret = sentinel();
    const output = sanitizeDiagnostic('x'.repeat(4090) + secret, [secret]);
    assert.equal(Buffer.byteLength(output) <= 4096, true);
    assert.equal(output.includes(secret.slice(0, 4)), false);
    const cycle = {}; cycle.message = cycle;
    for (const value of [cycle, { message: () => secret }, { message: 'x'.repeat(1048577) }]) {
      const safe = sanitizeDiagnostic(value);
      assert.equal(safe.includes(secret), false);
      assert.equal(safe.includes('REDACTED'), true);
    }
    const buffer = new DiagnosticBuffer();
    for (let i = 0; i < 100; i++) buffer.add('x'.repeat(4096));
    assert.equal(Buffer.byteLength(buffer.text()) <= 65536, true);
    assert.equal(buffer.overflowed, true);
  `));

  it('uses private acknowledged memory-only registration and retains values through context close', () => verify(prelude + `
    const { CredentialRegistry, startRegistryServer, registerCredentials } = await import('./e2e/support/credential-registry.ts');
    const registry = new CredentialRegistry();
    const server = await startRegistryServer(registry);
    const a = sentinel(), b = sentinel();
    try {
      assert.equal(fs.statSync(path.dirname(server.endpoint)).mode & 511, 448);
      await Promise.all([registerCredentials(server.endpoint, 'context-a', [a]), registerCredentials(server.endpoint, 'context-b', [b])]);
      assert.equal(registry.hasCredential(a), true);
      assert.equal(registry.hasCredential(b), true);
      registry.closeContext('context-a');
      assert.equal(registry.hasCredential(a), true);
      assert.throws(() => JSON.stringify(registry));
    } finally { await server.close(); registry.clear(); }
    assert.equal(registry.size, 0);
    assert.equal(fs.existsSync(path.dirname(server.endpoint)), false);
    await assert.rejects(registerCredentials(server.endpoint, 'context-a', [a]));
  `));

  it('recursively scans decoded JSON, rejects forbidden artifacts and never prints detected values', () => verify(prelude + `
    const { CredentialRegistry } = await import('./e2e/support/credential-registry.ts');
    const { scanArtifacts } = await import('./scripts/check-e2e-artifacts.mjs');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'otteroom-scanner-test-'));
    const registry = new CredentialRegistry(); const secret = sentinel(); registry.register('test', [secret]);
    try {
      fs.mkdirSync(path.join(dir, 'nested'));
      fs.writeFileSync(path.join(dir, 'nested/safe.json'), JSON.stringify({ outcome: 'passed' }));
      assert.equal(scanArtifacts(dir, { registry }).ok, true);
      fs.writeFileSync(path.join(dir, 'nested/leak.json'), JSON.stringify(secret).replaceAll('-', '\\u002d'));
      let result = scanArtifacts(dir, { registry });
      assert.equal(result.ok, false);
      assert.equal(JSON.stringify(result).includes(secret), false);
      fs.unlinkSync(path.join(dir, 'nested/leak.json'));
      for (const filename of ['trace.zip', 'network.har', 'storage-state.json', 'cookies.json', 'session.json', 'video.webm', 'unknown.bin']) {
        const file = path.join(dir, filename); fs.writeFileSync(file, 'safe');
        assert.equal(scanArtifacts(dir, { registry }).ok, false); fs.unlinkSync(file);
      }
      fs.writeFileSync(path.join(dir, 'large.txt'), 'x'.repeat(1100000) + secret);
      assert.equal(scanArtifacts(dir, { registry }).ok, false);
    } finally { registry.clear(); fs.rmSync(dir, { recursive: true }); }
  `));

  it('fails scanner CLI safely for missing, unreadable, escaping and synthetic-leaking inputs', () => verify(prelude + `
    const { scanArtifacts } = await import('./scripts/check-e2e-artifacts.mjs');
    const { spawnSync } = await import('node:child_process');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'otteroom-scanner-negative-'));
    const jwt = ['eyJ' + randomUUID().replaceAll('-', ''), randomUUID().replaceAll('-', ''), randomUUID().replaceAll('-', '')].join('.');
    try {
      assert.equal(scanArtifacts(path.join(dir, 'absent')).ok, false);
      fs.symlinkSync('/etc/hosts', path.join(dir, 'escape.txt'));
      assert.equal(scanArtifacts(dir).ok, false); fs.unlinkSync(path.join(dir, 'escape.txt'));
      fs.writeFileSync(path.join(dir, 'unreadable.txt'), 'safe', { mode: 0 });
      assert.equal(scanArtifacts(dir).ok, false); fs.chmodSync(path.join(dir, 'unreadable.txt'), 384); fs.unlinkSync(path.join(dir, 'unreadable.txt'));
      fs.writeFileSync(path.join(dir, 'leak.json'), JSON.stringify({ message: jwt }));
      const result = spawnSync(process.execPath, ['scripts/check-e2e-artifacts.mjs', dir], { encoding: 'utf8' });
      assert.equal(result.status !== 0, true);
      assert.equal((result.stdout + result.stderr).includes(jwt), false);
    } finally { fs.rmSync(dir, { recursive: true }); }
  `));

  it('safe reporter drops raw fields, stdout, attachments and error causes', () => verify(prelude + `
    const { safeResult } = await import('./e2e/support/safe-reporter.ts');
    for (const [title, expected] of [['@us2-join E02 link', 'us2-join'], ['@us2-realtime E03 binding', 'us2-realtime'], ['@us4 E07 reload', 'us4'], ['@capacity-smoke E12 isolation', 'capacity-smoke'], ['@us3 E05 capacity', 'us3'], ['@us3 E06 race', 'us3'], ['@us3 E12 isolation', 'us3'], ['@us3 E13 unknown', 'unclassified']]) {
      assert.equal(safeResult({ title }, { status: 'passed' }).scenario, expected);
    }
    const secret = sentinel();
    const result = safeResult({ title: secret }, { status: 'failed', error: { message: secret, cause: secret }, stdout: [secret], attachments: [{ body: secret }] });
    for (const [title, label] of [['@us3 E05 capacity', 'E05'], ['@us3 E06 race', 'E06'], ['@us3 E12 known-ID read', 'E12-read'], ['@us3 E12 live subscription', 'E12-subscription'], ['@us3 E12 delayed response', 'E12-navigation'], ['@us3 E12 direct write', 'E12-mutation']]) {
      for (let repeatEachIndex = 0; repeatEachIndex < 3; repeatEachIndex++) {
        const projected = safeResult({ title, repeatEachIndex }, { status: 'passed' });
        assert.equal(projected.browserCase, label); assert.equal(projected.repetition, repeatEachIndex + 1);
      }
    }
    assert.equal(safeResult({ title: secret, repeatEachIndex: secret }, {}).browserCase, 'none');
    assert.equal(safeResult({ repeatEachIndex: 3 }, {}).repetition, 0);
    for (const [title, label] of [['@us1 E01 create', 'E01'], ['@us2-join E02 link', 'E02'], ['@us2-realtime E03 binding', 'E03'], ['@us2-join E04 manual', 'E04'], ['@us4 E07 reload', 'E07'], ['@us4 E08 reconnect', 'E08'], ['@us4 E09 repeat', 'E09'], ['@us2-join E10 malformed', 'E10'], ['@us2-join E11 absent', 'E11']]) {
      for (let parallelIndex = 0; parallelIndex < 2; parallelIndex++) {
        const projected = safeResult({ title }, { status: 'passed', parallelIndex });
        assert.equal(projected.browserCase, label); assert.equal(projected.worker, parallelIndex);
      }
    }
    for (const parallelIndex of [secret, -1, 4, 0.5]) assert.equal(safeResult({}, { parallelIndex }).worker, -1);
    assert.equal(JSON.stringify(result).includes(secret), false);
    assert.equal(result.status, 'failed');
    assert.equal(Object.hasOwn(result, 'attachments'), false);
    const controlled = { status: 'failed', error: { message: 'Error: CONTROLLED_AUTH_DIAGNOSTIC_FAILURE' }, errorCount: 1 };
    const probe = { title: '@credential-probe C synthetic classification only', expectedStatus: 'passed' };
    assert.equal(safeResult(probe, controlled).category, 'CONTROLLED_AUTH_DIAGNOSTIC_FAILURE');
    assert.equal(safeResult(probe, { ...controlled, errorCount: 2 }).category, 'E2E_FAILURE');
    assert.equal(safeResult({ ...probe, expectedStatus: 'failed' }, controlled).category, 'E2E_FAILURE');
  `));

  it('safe process drains split secret output and preserves child failures and shutdown', () => verify(prelude + `
    const { runManagedProcess, operationSpec } = await import('./scripts/safe-process.mjs');
    const secret = sentinel(), logs = [];
    const code = 'process.stdout.write(' + JSON.stringify(secret.slice(0, 12)) + '); process.stderr.write(' + JSON.stringify(secret.slice(12)) + '); process.exitCode=7;';
    const result = await runManagedProcess({ command: process.execPath, args: ['--input-type=module'], input: code, label: 'fixture', onStatus: value => logs.push(value) });
    assert.equal(result, 7);
    assert.equal(JSON.stringify(logs).includes(secret), false);
    const abort = new AbortController();
    const pending = runManagedProcess({ command: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'], label: 'fixture', signal: abort.signal });
    abort.abort(); assert.equal(await pending !== 0, true);
    assert.deepEqual(operationSpec('web:e2e').args, ['start', '--web', '--port', '8081']);
    assert.throws(() => operationSpec('arbitrary-command'));
  `));

  it('safe context options and exception/UI boundaries reject capture before it happens', () => verify(prelude + `
    const { validateContextOptions, safeError, inspectUiValues, requireStableCapture } = await import('./e2e/support/safe-diagnostics.ts');
    const secret = sentinel();
    validateContextOptions({ baseURL: 'http://127.0.0.1:8081' });
    for (const options of [{ recordHar: { path: 'a.har' } }, { recordVideo: { dir: 'video' } }, { storageState: {} }]) assert.throws(() => validateContextOptions(options));
    const error = safeError(new Error(secret, { cause: secret }));
    assert.equal(String(error.stack).includes(secret), false);
    assert.equal(Object.hasOwn(error, 'cause'), false);
    assert.equal(inspectUiValues(['safe', secret], [secret]), false);
    assert.equal(inspectUiValues(['safe'], [secret]), true);
    assert.throws(() => requireStableCapture(false, true));
    assert.throws(() => requireStableCapture(true, false));
  `));

  it('safe fixture closes its context and observers even when registration fails', () => verify(prelude + `
    const { SafeDiagnostics } = await import('./e2e/support/safe-diagnostics.ts');
    let closes = 0; const events = new Set();
    const page = { screenshot: async () => Buffer.alloc(0), pdf: async () => Buffer.alloc(0) };
    const context = {
      tracing: {}, request: {}, storageState: async () => ({}), addInitScript: async () => {}, newPage: async () => page,
      route: async () => {}, unrouteAll: async () => {},
      on: name => events.add(name), removeListener: name => events.delete(name), close: async () => { closes++; },
    };
    const diagnostics = await SafeDiagnostics.create(context, {}, { title: 'synthetic', annotations: [] });
    await assert.rejects(diagnostics.register([sentinel()]));
    await assert.rejects(diagnostics.close());
    assert.equal(closes, 1); assert.equal(events.size, 0);
    await diagnostics.close(); assert.equal(closes, 1);
    await assert.rejects(page.screenshot());
  `));

  it('controller rejects unsafe overrides and distinguishes exact controlled failure from unexpected exits', () => verify(prelude + `
    const { parseInvocation, assessRun } = await import('./scripts/run-e2e.mjs');
    assert.equal(parseInvocation(['security', '--grep', '@diagnostics-static']).staticOnly, true);
    for (const args of [['acceptance', '--trace', 'on'], ['acceptance', '--ui'], ['acceptance', '--reporter=json'], ['acceptance', '--output=/tmp/raw'], ['security', '--workers=2'], ['security', '--repeat-each=2']]) assert.throws(() => parseInvocation(args));
    const checks = [{ scenario: 'A', status: 'passed' }, { scenario: 'B', status: 'passed' }];
    const c = { scenario: 'C', status: 'failed', category: 'CONTROLLED_AUTH_DIAGNOSTIC_FAILURE', authSuccess: true, signups: 1, cleanup: true, artifactsComplete: true };
    assert.equal(assessRun('security', false, 1, [...checks, c], true), true);
    for (const changed of [{ category: 'UNEXPECTED_FAILURE' }, { signups: 2 }, { authSuccess: false }, { cleanup: false }, { artifactsComplete: false }]) assert.equal(assessRun('security', false, 1, [...checks, { ...c, ...changed }], true), false);
    assert.equal(assessRun('security', false, 0, checks, true), false);
    assert.equal(assessRun('security', false, 1, [...checks, c], false), false);
    assert.equal(assessRun('acceptance', false, 1, checks, true), false);
    assert.equal(assessRun('security', true, 0, checks, true), true);
  `));

  it('controller scans finalized late output and always clears credentials and private IPC', () => verify(prelude + `
    const { parseInvocation, executeInvocation } = await import('./scripts/run-e2e.mjs');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'otteroom-controller-test-'));
    let endpoint, liveRegistry;
    const checks = [{ scenario: 'A', status: 'passed' }, { scenario: 'B', status: 'passed' }];
    try {
      const outcome = await executeInvocation(parseInvocation(['security', '--grep', '@diagnostics-static']), {
        artifactRoot: root, runtime: run => run({ kind: 'native' }),
        launch: async ({ directory, registry, socket }) => {
          endpoint = socket; liveRegistry = registry;
          const secret = sentinel(); registry.register('synthetic', [secret]);
          fs.writeFileSync(path.join(directory, 'summary.json'), JSON.stringify(checks));
          await new Promise(resolve => setTimeout(resolve, 10));
          fs.writeFileSync(path.join(directory, 'late.txt'), secret);
          return 0;
        },
      });
      assert.equal(outcome, 1);
      assert.equal(liveRegistry.size, 0);
      assert.equal(fs.existsSync(path.dirname(endpoint)), false);
      const failure = await executeInvocation(parseInvocation(['acceptance']), {
        artifactRoot: root, runtime: run => run({ kind: 'native' }), provider: async () => async () => {},
        launch: async ({ socket, registry }) => { endpoint = socket; liveRegistry = registry; throw Error('fixture failure'); },
      });
      assert.equal(failure, 1);
      assert.equal(liveRegistry.size, 0);
      assert.equal(fs.existsSync(path.dirname(endpoint)), false);
    } finally { fs.rmSync(root, { recursive: true }); }
  `));
});

it('ordinary safeBody final check inspects image-bearing text, fails credentials and still closes participants', () => verify(prelude + `
  const { SafeDiagnostics, safeBody } = await import('./e2e/support/safe-diagnostics.ts');
  const { CredentialRegistry, startRegistryServer } = await import('./e2e/support/credential-registry.ts');
  const registry = new CredentialRegistry(), server = await startRegistryServer(registry);
  process.env.OTTEROOM_CREDENTIAL_SOCKET = server.endpoint;
  const secret = sentinel(); let inspections = 0, closed = 0, leak = false;
  const page = { screenshot: async () => Buffer.alloc(0), evaluate: async () => {
    inspections++; return { complete: true, values: [leak ? secret : 'Ready', '/assets/poster.png'] };
  } };
  const context = { tracing: {}, request: {}, addInitScript: async () => {}, newPage: async () => page,
    on: () => {}, removeListener: () => {}, route: async () => {}, unrouteAll: async () => {}, close: async () => { closed++; } };
  const d = await SafeDiagnostics.create(context, {}, { title: 'synthetic', annotations: [] });
  try {
    await d.register([secret]); await safeBody(d, async () => {});
    assert.equal(inspections, 1); leak = true;
    await assert.rejects(safeBody(d, async () => {}), /E2E_SAFE_FAILURE/);
    assert.equal(inspections, 2);
    const { withParticipants } = await import('./e2e/support/room-harness.ts');
    const browser = { newContext: async () => ({ ...context, tracing: {}, request: {} }) };
    const body = async participants => { for (const participant of participants) await participant.register([secret]); };
    leak = false;
    await withParticipants(browser, {}, { title: 'synthetic', annotations: [] }, 2, body);
    assert.equal(inspections, 4); assert.equal(closed, 2);
    leak = true;
    await assert.rejects(withParticipants(browser, {}, { title: 'synthetic', annotations: [] }, 2, body), /E2E_SAFE_FAILURE/);
    assert.equal(inspections, 5); assert.equal(closed, 4);
  } finally { await d.close(); await server.close(); registry.clear(); }
  assert.equal(closed, 5); assert.equal(registry.size, 0);
`));

it('explicitly discovers H01–H03, I01–I03 and J01–J03 with fixed safe labels', () => verify(prelude + `
  const { default: config } = await import('./playwright.config.ts');
  const { safeResult } = await import('./e2e/support/safe-reporter.ts');
  const { safeDiagnosticLocation } = await import('./e2e/support/sanitize-diagnostics.ts');
  assert.deepEqual(config.projects.find(p => p.name === 'acceptance').testMatch,
    ['room-session.spec.ts', 'generalized-room-membership-qr.spec.ts', 'participant-filters.spec.ts', 'common-filter-resolution.spec.ts',
      'tmdb-candidate-source.spec.ts', 'swipe-decisions.spec.ts']);
  const titles = ['@filters H01 validates private owned filters and editable saved state',
    '@filters H02 recovers filters through failures and lost acknowledgements',
    '@filters H03 serializes final completion and freezes every filter'];
  for (const title of titles) {
    const result = safeResult({ title, repeatEachIndex: 0 }, { status: 'passed',
      error: { message: 'E2E_SAFE_FAILURE at e2e/participant-filters.spec.ts:12:3' } });
    assert.equal(result.scenario, 'filters'); assert.equal(result.browserCase, title.split(' ')[1]);
    assert.equal(result.location, 'e2e/participant-filters.spec.ts:12:3');
  }
  const resolutionTitles = ['@resolution I01 converges a three-voter compatible room across reload reconnect and re-entry',
    '@resolution I02 converges a non-voting creator and three voters on terminal incompatibility',
    '@resolution I03 recovers pre-commit failure and committed-response loss with two reused identities'];
  for (const title of resolutionTitles) {
    const result = safeResult({ title, repeatEachIndex: 0 }, { status: 'passed',
      error: { message: 'E2E_SAFE_FAILURE at e2e/common-filter-resolution.spec.ts:12:3' } });
    assert.equal(result.scenario, 'resolution'); assert.equal(result.browserCase, title.split(' ')[1]);
    assert.equal(result.location, 'e2e/common-filter-resolution.spec.ts:12:3');
  }
  const candidateTitles = ['@feature006 J01 exact compatible acquisition and lifecycle convergence',
    '@feature006 J02 non-voting parity private traffic and completed empty',
    '@feature006 J03 failure recovery response loss and same identity degradation'];
  for (const title of candidateTitles) {
    const result = safeResult({ title, repeatEachIndex: 0 }, { status: 'passed',
      error: { message: 'E2E_SAFE_FAILURE at e2e/tmdb-candidate-source.spec.ts:12:3' } });
    assert.equal(result.scenario, 'candidate'); assert.equal(result.browserCase, title.split(' ')[1]);
    assert.equal(result.location, 'e2e/tmdb-candidate-source.spec.ts:12:3');
  }
  for (const file of ['participant-filters.spec', 'common-filter-resolution.spec', 'support/filter-harness', 'support/room-harness', 'support/resolution-harness'])
    assert.equal(safeDiagnosticLocation('E2E_SAFE_FAILURE at e2e/' + file + '.ts:12:3'), 'e2e/' + file + '.ts:12:3');
  for (const title of ['@filters H00 future', '@filters H04 future', '@resolution I00 future', '@resolution I04 future',
    '@candidate F01 retired', '@feature006 J04 future', '@filters ' + sentinel(), '@resolution ' + sentinel()]) {
    const result = safeResult({ title }, { status: 'failed' });
    assert.equal(result.scenario, 'unclassified'); assert.equal(result.browserCase, 'none');
  }
  assert.equal(safeDiagnosticLocation('e2e/arbitrary.ts:12:3'), undefined);
  assert.equal(/acceptance[ -]N=106/.test(fs.readFileSync('scripts/run-e2e.mjs', 'utf8')), true);
  assert.equal(/acceptance[ -]N=106/.test(fs.readFileSync('e2e/support/safe-diagnostics.ts', 'utf8')), true);
  const runner = fs.readFileSync('scripts/run-e2e.mjs', 'utf8');
  assert.equal(runner.includes("'H01'"), true);
  assert.equal(runner.includes("'filters'"), true);
  for (const label of ["'@resolution'", "'resolution'", "'I01'", "'I02'", "'I03'"])
    assert.equal(runner.includes(label), true);
  assert.equal(runner.includes("'F01'"), false);
  for (const label of ["'@feature006'", "'candidate'", "'J01'", "'J02'", "'J03'"])
    assert.equal(runner.includes(label), true);
`));

it('second-room selection accepts two owned rooms but rejects reused requests or incorrect returned IDs', () => verify(prelude + `
  const { selectCreatedTrial } = await import('./e2e/support/room-harness.ts');
  const old = { id: randomUUID(), code: 'ABCDEF0123', state: 'ready' };
  const fresh = { id: randomUUID(), code: '012345ABCD', state: 'waiting' };
  const priorRequest = randomUUID(), request = randomUUID();
  const result = [{ outcome: 'created', room_id: fresh.id, room_code: fresh.code }];
  assert.deepEqual(selectCreatedTrial(result, [old, fresh], request, priorRequest, old.id), fresh);
  for (const [rows, rooms, id] of [[result, [old, fresh], priorRequest], [result, [old], request],
    [[{ ...result[0], room_id: old.id }], [old, fresh], request], [result, [fresh, fresh], request]])
    assert.throws(() => selectCreatedTrial(rows, rooms, id, priorRequest, old.id));
`));

it('registers only the nine reviewed membership titles and their exact safe source locations', () => verify(prelude + `
  const { safeResult } = await import('./e2e/support/safe-reporter.ts');
  const { safeDiagnosticLocation } = await import('./e2e/support/sanitize-diagnostics.ts');
  for (const title of ['@membership G01 configured room invitations expose decoded QR',
    '@membership G02 room creation failures preserve configuration',
    '@membership G03 three voting members assemble through link and code',
    '@membership G04 non-voting creator observes voter filter progress',
    '@membership G05 decoded QR admission is idempotent', '@membership G06 non-voting creator and concurrent voters',
    '@membership G07 final slot capacity competition', '@membership G08 authorization and room isolation',
    '@membership G09 join failures and committed response loss']) {
    const result = safeResult({ title }, { status: 'passed' });
    assert.equal(result.scenario, 'membership'); assert.equal(result.browserCase, title.split(' ')[1]);
  }
  for (const title of ['@membership G00 future', '@membership G10 future', '@membership G01 arbitrary', '@membership G04 ' + sentinel()]) {
    const result = safeResult({ title }, { status: 'passed' });
    assert.equal(result.scenario, 'unclassified'); assert.equal(result.browserCase, 'none');
  }
  assert.equal(safeDiagnosticLocation('e2e/generalized-room-membership-qr.spec.ts:15:9'), 'e2e/generalized-room-membership-qr.spec.ts:15:9');
  assert.equal(safeDiagnosticLocation('e2e/support/qr-harness.ts:15:9'), 'e2e/support/qr-harness.ts:15:9');
  const runner = fs.readFileSync('scripts/run-e2e.mjs', 'utf8');
  for (const label of ["'membership'", ...Array.from({ length: 9 }, (_, i) => "'G0" + (i + 1) + "'")]) assert.equal(runner.includes(label), true);
`));

it('Realtime dispatch accounting distinguishes a late prior response from a new refetch', () => verify(prelude + `
  import { EventEmitter } from 'node:events';
  import { realtimeBarrier } from './e2e/support/room-harness.ts';
  let connect, serverMessage, finish;
  const page = Object.assign(new EventEmitter(), { context: () => ({ routeWebSocket: async (_, callback) => { connect = callback; } }) });
  const server = { onClose: () => {}, onMessage: callback => { serverMessage = callback; }, send: () => {}, close: async () => {} };
  const browser = { connectToServer: () => server, onClose: () => {}, onMessage: () => {}, send: () => {}, close: async () => {} };
  const transport = await realtimeBarrier(page), id = randomUUID();
  try {
    await connect(browser);
    serverMessage(JSON.stringify([null, null, 'realtime:room:' + id, 'system',
      { extension: 'postgres_changes', status: 'ok', message: 'Subscribed to PostgreSQL' }]));
    const url = 'http://127.0.0.1:55321/rest/v1/rooms?select=id,code,state,voter_count,required_voter_count,filter_completed_count,filter_resolution_status,candidate_acquisition_status,decision_completed_count&id=eq.' + id;
    const request = { url: () => url }; page.emit('request', request);
    const delayed = new Promise(resolve => { finish = resolve; });
    page.emit('response', { request: () => request, url: () => url, ok: () => true, body: async () => Buffer.from(JSON.stringify(await delayed)) });
    assert.equal(transport.stats.readRequests, 1); assert.equal(transport.stats.reads, 0);
    const before = { ...transport.stats };
    finish([{ id, code: 'ABCDEF0123', state: 'waiting', voter_count: 2, required_voter_count: 3, filter_completed_count: 0,
      filter_resolution_status: 'pending', candidate_acquisition_status: 'pending', decision_completed_count: 0 }]);
    await transport.wait('reads', 1);
    assert.equal(transport.stats.readRequests, before.readRequests);
    assert.notEqual(transport.stats.reads, before.reads);
    page.emit('request', { url: () => url }); await transport.wait('readRequests', 2);
    assert.equal(transport.stats.reads, 1); transport.assertHealthy();
  } finally { await transport.close(); }
  assert.equal(page.eventNames().length, 0);
`));

const realtimePrelude = prelude + `
  import { EventEmitter } from 'node:events';
  import { realtimeBarrier } from './e2e/support/room-harness.ts';
  let connect, serverMessage, browserMessage, browserClosed, sent = 0;
  const page = Object.assign(new EventEmitter(), { context: () => ({ routeWebSocket: async (_, callback) => { connect = callback; } }) });
  const server = { onClose: () => {}, onMessage: callback => { serverMessage = callback; }, send: () => {}, close: async () => {} };
  const browser = { connectToServer: () => server, onClose: callback => { browserClosed = callback; },
    onMessage: callback => { browserMessage = callback; }, send: () => { sent++; }, close: async () => {} };
  const transport = await realtimeBarrier(page), id = randomUUID();
  await connect(browser);
  const system = JSON.stringify([null, null, 'realtime:room:' + id, 'system',
    { extension: 'postgres_changes', status: 'ok', message: 'Subscribed to PostgreSQL' }]);
  serverMessage(system);
  const url = 'http://127.0.0.1:55321/rest/v1/rooms?select=id,code,state,voter_count,required_voter_count,filter_completed_count,filter_resolution_status,candidate_acquisition_status,decision_completed_count&id=eq.' + id;
  const request = { url: () => url };
  const turn = () => new Promise(resolve => setImmediate(resolve));
`;

it('Realtime observation retains the first safe failure through waits and health checks', () => verify(realtimePrelude + `
  const secret = sentinel();
  try {
    page.emit('request', request);
    page.emit('response', { request: () => request, url: () => url, body: async () => { throw Error(secret); } });
    await turn();
    const first = await transport.wait('reads', 1).catch(error => error);
    assert.equal(first.message, 'E2E_SAFE_FAILURE');
    assert.equal(first.stack.includes(secret), false);
    assert.equal(first.stack.includes('at done '), false);
    serverMessage('malformed later frame');
    const later = await transport.wait('readiness', 2).catch(error => error);
    assert.equal(later, first);
    assert.throws(() => transport.assertHealthy(), error => error === first);
  } finally { await transport.close(); }
`));

it('ignores messages belonging to a retired socket but still rejects malformed active frames', () => verify(realtimePrelude + `
  try {
    await browserClosed(); const before = sent;
    serverMessage(system);
    assert.equal(transport.stats.readiness, 1); assert.equal(sent, before);
    browserMessage('malformed retired message');
    transport.assertHealthy();
    assert.equal(transport.stats.readiness, 1);
    await connect(browser); serverMessage('malformed live message');
    assert.throws(() => transport.assertHealthy());
  } finally { await transport.close(); }
`));

it.each(['retired-body', 'active-body', 'retired-malformed', 'retired-valid'])('room response observer contains only unavailable retired-document bodies: %s', trial => verify(realtimePrelude + `
  let finish, reject;
  const bytes = new Promise((resolve, fail) => { finish = resolve; reject = fail; });
  try {
    page.emit('request', request);
    page.emit('response', { request: () => request, url: () => url, ok: () => true,
      body: () => bytes, json: async () => JSON.parse((await bytes).toString()) });
    if ('${trial}'.startsWith('retired')) page.emit('framenavigated', { parentFrame: () => null });
    if ('${trial}'.endsWith('body')) reject(Error('synthetic unavailable body'));
    else finish(Buffer.from('${trial}' === 'retired-malformed' ? '{}' : JSON.stringify([
      { id, code: 'ABCDEF0123', state: 'waiting', voter_count: 2, required_voter_count: 3, filter_completed_count: 0,
        filter_resolution_status: 'pending', candidate_acquisition_status: 'pending', decision_completed_count: 0 }])));
    await turn();
    if (['active-body', 'retired-malformed'].includes('${trial}')) assert.throws(() => transport.assertHealthy());
    else {
      transport.assertHealthy();
      assert.equal(transport.stats.reads, '${trial}' === 'retired-valid' ? 1 : 0);
    }
  } finally { await transport.close(); }
`));

it('scanner rejects Feature 007 private decision artifacts while aggregate receipts remain safe', () => verify(prelude + `
  const { scanArtifacts } = await import('./scripts/check-e2e-artifacts.mjs');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'otteroom-decision-scan-'));
  try {
    fs.writeFileSync(path.join(directory, 'safe.json'), JSON.stringify({ browserCase: 'K01',
      performanceSamples: 20, performancePassing: 19, performanceMaximumMs: 1999,
      performanceRecoverableFailures: 0 }));
    assert.equal(scanArtifacts(directory).ok, true);
    for (const value of ['candidate_decisions', 'submit_room_candidate_decision',
      'room_member_id', 'my_decision=yes', 'tmdb_movie_id=6006']) {
      fs.writeFileSync(path.join(directory, 'unsafe.txt'), value);
      assert.equal(scanArtifacts(directory).ok, false);
      fs.unlinkSync(path.join(directory, 'unsafe.txt'));
    }
  } finally { fs.rmSync(directory, { recursive: true }); }
`));
