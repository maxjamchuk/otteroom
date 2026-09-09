import { expect, type Request, type Response, type Route, type WebSocket } from '@playwright/test';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { parseEnv } from 'node:util';
import { narrowCandidateResult, type CandidateResult } from '../../src/candidates/contracts.ts';
import { type SafeDiagnostics, safeError } from './safe-diagnostics.ts';
import { committedRoomSnapshot, type PublicApi, type RoomProjection } from './room-harness.ts';

// Acceptance expectation only; selection remains entirely in the real RPC.
export const firstCandidate = Object.freeze({ outcome: 'available' as const,
  candidate_id: 'fixture-cardboard-comet', title: 'The Cardboard Comet', release_year: 2020, poster_key: 'cardboard-comet' });
// Expo's installed Metro serves development assets via this path parameter;
// exported assets use ordinary hash-bearing PNG pathnames.
const assetPath = (url: URL) => url.searchParams.get('unstable_path') ?? url.pathname;
const endpoint = (url: URL) => url.pathname === '/rest/v1/rpc/ensure_room_candidate';
type Action = 'continue' | 'abort' | 'commit-loss' | null;
type Snapshot = ReturnType<typeof committedRoomSnapshot>;
const probeLabel = 'otteroom-f01-contract-probe';
const sameResult = (a: CandidateResult, b: CandidateResult) =>
  (['outcome', 'candidate_id', 'title', 'release_year', 'poster_key'] as const).every(key => a[key] === b[key]);

function httpOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol === 'ws:') url.protocol = 'http:';
  if (url.protocol === 'wss:') url.protocol = 'https:';
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw safeError();
  return url.origin;
}

// Observe from before navigation. No global blocking or provider allowlist, no
// raw request/response data in diagnostics. Only the configured local origins.
export async function candidateHarness(participants: [SafeDiagnostics, SafeDiagnostics], baseURL: string) {
  const appOrigin = httpOrigin(baseURL);
  const env = process.env.EXPO_PUBLIC_SUPABASE_URL ? process.env : parseEnv(fs.readFileSync('.env.local', 'utf8'));
  const apiOrigin = httpOrigin(env.EXPO_PUBLIC_SUPABASE_URL ?? '');
  expect([appOrigin, apiOrigin].every(value => ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(value).hostname))).toBe(true);
  const expectedHash = createHash('sha256').update(fs.readFileSync('assets/candidates/cardboard-comet.png')).digest('hex');
  let binding: { room: RoomProjection; ids: [string, string]; api: PublicApi } | undefined;
  let failed = false, disposed = false;
  let limits = [1, 1];
  const roundFor = (actions: [Action, Action]) => {
    return { actions, arrived: [false, false], released: false, finished: [false, false],
      rows: [null, null] as (CandidateResult | null)[], proof: false,
      // Waiting is event-driven through waitFor/notify; no timing guess.
    };
  };
  let round = roundFor(['continue', 'continue']);
  const rounds = [round];
  const posterRoutes: { index: 0 | 1; match: (url: URL) => boolean; route: (route: Route) => Promise<void> }[] = [];
  const waiting = new Set<() => void>(), pending = new Set<Promise<void>>();
  const stats = participants.map(() => ({ automatic: 0, probes: 0, held: 0, forwarded: 0, fetched: 0, aborted: 0, auth: 0, http: 0, sockets: 0, external: 0 }));
  const automaticResults: CandidateResult[][] = [[], []], probeResults: CandidateResult[][] = [[], []];
  const images = participants.map(() => new Map<string, { ok: boolean; hash: string }>());
  const notify = () => { for (const callback of waiting) callback(); };
  const waitFor = (condition: () => boolean) => new Promise<void>((resolve, reject) => {
    const done = () => {
      if (!failed && !disposed && !condition()) return;
      clearTimeout(deadline); waiting.delete(done);
      if (failed || disposed) reject(safeError()); else resolve();
    };
    const deadline = setTimeout(() => { waiting.delete(done); reject(safeError()); }, 15000);
    waiting.add(done); done();
  });
  const track = (work: Promise<void>) => {
    const guarded = work.catch(() => { if (!disposed) failed = true; }).finally(() => { pending.delete(guarded); notify(); });
    pending.add(guarded);
  };
  const isCandidate = (request: Request) => endpoint(new URL(request.url())) && request.method() === 'POST';
  const observers = participants.map((participant, index) => {
    const traffic = (url: string, socket = false) => {
      try {
        httpOrigin(url);
        stats[index][socket ? 'sockets' : 'http']++;
        // Candidate data/image resources are classified in request(), separately
        // from unrelated document, runtime-script and socket traffic.
        if (stats[index].http > 1000 || stats[index].sockets > 20) failed = true;
      } catch { failed = true; }
    };
    const request = (value: Request) => {
      if (disposed) return;
      traffic(value.url());
      const url = new URL(value.url());
      if (url.pathname.startsWith('/auth/v1/')) stats[index].auth++;
      const poster = value.resourceType() === 'image' &&
        /(?:cardboard-comet|pebble-bay-lanterns|cloud-tram-four|clockwork-orchard)(?:[./?]|$)/.test(assetPath(url));
      const catalog = url.pathname === '/rest/v1/movie_candidates';
      if ((isCandidate(value) || catalog) && httpOrigin(value.url()) !== apiOrigin ||
        poster && httpOrigin(value.url()) !== appOrigin) stats[index].external++;
      // Other runtime data/scripts/fonts/sockets are merely observed. The
      // actual displayed poster is independently checked against appOrigin and
      // original fixture bytes, including any URL not recognizable by filename.
      // Count observations independently of routing, including late calls and
      // query strings; unrelated Data API reads cannot affect these counters.
      if (isCandidate(value)) {
        const probe = value.headers()['x-client-info'] === probeLabel;
        stats[index][probe ? 'probes' : 'automatic']++;
        if (httpOrigin(value.url()) !== apiOrigin || (probe ? stats[index].probes > 40 : stats[index].automatic > limits[index])) failed = true;
        notify();
      }
    };
    const socket = (value: WebSocket) => traffic(value.url(), true);
    const response = (value: Response) => track((async () => {
      if (disposed) return;
      if (isCandidate(value.request())) {
        const probe = await value.request().headerValue('x-client-info') === probeLabel;
        if (!value.ok()) throw safeError();
        const bytes = await value.body();
        if (disposed) return;
        if (bytes.length > 4096) throw safeError();
        const row = narrowCandidateResult(JSON.parse(bytes.toString('utf8')));
        (probe ? probeResults : automaticResults)[index].push(row);
        if (!probe && !sameResult(row, firstCandidate)) throw safeError();
      } else if (value.request().resourceType() === 'image') {
        if (images[index].size >= 32) throw safeError();
        const bytes = await value.body();
        if (disposed) return;
        images[index].set(value.url(), { ok: value.ok() && bytes.length <= 65536,
          hash: bytes.length <= 65536 ? createHash('sha256').update(bytes).digest('hex') : '' });
      }
    })());
    const route = async (value: Route) => {
      const current = round;
      let response: Awaited<ReturnType<Route['fetch']>> | undefined;
      try {
        if (!isCandidate(value.request())) { await value.continue(); return; }
        if (!binding || httpOrigin(value.request().url()) !== apiOrigin) throw safeError();
        const body = value.request().postDataJSON(), headers = await value.request().allHeaders();
        const probe = headers['x-client-info'] === probeLabel;
        if (!body || Object.keys(body).join(',') !== 'p_room_id' ||
          (!probe && body.p_room_id !== binding.room.id) || !/^[0-9a-f-]{36}$/.test(body.p_room_id)) throw safeError();
        const bearer = headers.authorization?.match(/^Bearer (.+)$/)?.[1];
        // Memory only; the real server verifies the JWT signature.
        if (!bearer || JSON.parse(Buffer.from(bearer.split('.')[1], 'base64url').toString('utf8')).sub !== binding.ids[index]) throw safeError();
        if (failed || disposed) throw safeError();
        if (probe) { await value.continue(); return; }
        const action = current.actions[index];
        if (action !== null && !current.released) {
          if (current.arrived[index]) throw safeError();
          current.arrived[index] = true; stats[index].held++; notify();
          await waitFor(() => current.released);
          if (action === 'abort') { stats[index].aborted++; await value.abort(); return; }
          stats[index].forwarded++;
          if (action === 'commit-loss') {
            stats[index].fetched++;
            response = await value.fetch({ maxRetries: 0, maxRedirects: 0, timeout: 15000 });
            if (disposed || failed || !response.ok()) throw safeError();
            const bytes = await response.body();
            try {
              if (disposed || failed || bytes.length > 4096) throw safeError();
              const row = narrowCandidateResult(JSON.parse(bytes.toString('utf8')));
              if (!sameResult(row, firstCandidate)) throw safeError();
              current.rows[index] = row; notify();
            } finally { bytes.fill(0); }
            await waitFor(() => current.proof);
            stats[index].aborted++; await value.abort(); return;
          }
        } else stats[index].forwarded++;
        await value.continue();
      } catch { if (!disposed) failed = true; notify(); await value.abort().catch(() => {}); }
      finally {
        try { await response?.dispose(); } catch { if (!disposed) failed = true; }
        finally { current.finished[index] = true; notify(); }
      }
    };
    participant.page.on('request', request); participant.page.on('websocket', socket); participant.page.on('response', response);
    return { participant, request, socket, response, route };
  });
  try {
    for (const { participant, route } of observers) {
      await participant.page.route(endpoint, route);
      await participant.page.addInitScript(expected => {
        const view = window as typeof window & { __candidateObservation?: { seen: boolean; conflict: boolean } };
        const state = { seen: false, conflict: false }; view.__candidateObservation = state;
        new MutationObserver(() => {
          const card = document.querySelector('[data-testid="candidate-card"]');
          const title = card?.querySelector('[data-testid="candidate-title"]')?.textContent;
          const year = card?.querySelector('[data-testid="candidate-year"]')?.textContent;
          if (title !== undefined && title !== null && year !== undefined && year !== null) {
            state.conflict ||= title !== expected.title || year !== String(expected.release_year);
            state.conflict ||= document.body.innerText.includes(expected.candidate_id);
            if (!card?.querySelector('[data-testid="candidate-status"]') && card?.getAttribute('aria-busy') !== 'true') state.seen = true;
          }
        }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
      }, firstCandidate);
    }
  } catch { await close(); throw safeError(); }

  async function close() {
    if (disposed) return;
    disposed = true; notify();
    const results = await Promise.allSettled(observers.map(async ({ participant, route, request, socket, response }) => {
      participant.page.removeListener('request', request); participant.page.removeListener('websocket', socket); participant.page.removeListener('response', response);
      await participant.page.unroute(endpoint, route);
    }));
    await Promise.all(posterRoutes.map(({ index, match, route }) => participants[index].page.unroute(match, route)));
    // Response.body() has no cancellation API. Do not wait on a stalled body
    // before the owning SafeDiagnostics finally can close its browser context.
    // Late completions are disposed-guarded and already rejection-observed.
    pending.clear();
    images.forEach(map => map.clear()); automaticResults.forEach(rows => { rows.length = 0; }); probeResults.forEach(rows => { rows.length = 0; }); binding = undefined;
    if (results.some(result => result.status === 'rejected')) throw safeError();
  }

  return {
    stats,
    bind(room: RoomProjection, ids: [string, string], api: PublicApi) {
      expect(!binding && new Set(ids).size === 2 && api.origin === apiOrigin).toBe(true);
      binding = { room, ids, api };
    },
    // Configuration is bounded and must precede the first automatic request.
    limitAutomatic(value: [number, number]) {
      expect(stats.every(v => v.automatic === 0) && value.every(n => Number.isInteger(n) && n >= 1 && n <= 4)).toBe(true);
      limits = value;
    },
    configureInitial(actions: [Action, Action]) {
      expect(stats.every(v => v.automatic === 0)).toBe(true); round.actions = actions;
    },
    arm(actions: [Action, Action]) {
      expect(!failed && !disposed && round.actions.every((action, i) => action === null || round.finished[i])).toBe(true);
      round = roundFor(actions); rounds.push(round);
      expect(rounds.length <= 4).toBe(true);
    },
    rebind(room: RoomProjection) {
      expect(!!binding && room.id !== binding!.room.id && round.finished.every(Boolean)).toBe(true);
      binding = { ...binding!, room };
    },
    async held() {
      await waitFor(() => round.actions.every((action, i) => action === null || round.arrived[i]));
      expect(!round.released).toBe(true);
    },
    release() {
      expect(!round.released && !failed && round.actions.every((action, i) => action === null || round.arrived[i])).toBe(true);
      round.released = true; notify();
    },
    async available(counts: [number, number] = [1, 1]) {
      await waitFor(() => automaticResults.every((rows, i) => rows.length === counts[i]));
      expect(automaticResults.every(rows => rows.every(row => sameResult(row, firstCandidate)))).toBe(true);
    },
    async upstreamsHeld() {
      await waitFor(() => round.rows.every(Boolean));
      expect(!round.proof && stats.every(value => value.aborted === 0) && automaticResults.every(rows => rows.length === 0)).toBe(true);
    },
    async loseCommittedResponses(before: Snapshot) {
      expect(round.actions.every(action => action === 'commit-loss') && round.released && !round.proof && !!binding).toBe(true);
      await waitFor(() => round.rows.every(Boolean));
      // The independent committed read happens while BOTH browser routes remain
      // paused. Upstream success alone is insufficient evidence of this ordering.
      const snapshot = committedRoomSnapshot(binding!.room);
      expect(snapshot.row.state === 'ready' && before.row.movie_candidate_id === null &&
        snapshot.xmin !== before.xmin && round.rows.every(row => row?.candidate_id === snapshot.row.movie_candidate_id)).toBe(true);
      const unchanged = ({ movie_candidate_id: _candidate, updated_at: _updated, ...rest }: Snapshot['row']) => rest;
      expect(JSON.stringify(unchanged(snapshot.row)) === JSON.stringify(unchanged(before.row))).toBe(true);
      round.proof = true; notify();
      await waitFor(() => round.finished.every(Boolean));
      return snapshot;
    },
    async failPosterOnce(index: 0 | 1, source: string) {
      const url = new URL(source);
      expect(url.origin === appOrigin && url.protocol === 'http:' && assetPath(url).endsWith('.png') && url.searchParams.getAll('unstable_path').length <= 1 && !images[index].has(source)).toBe(true);
      const evidence = { failed: 0, retried: 0, source };
      // Resolve from the other participant's actual bundled image, then compare
      // exact origin/path AND Metro asset-path parameter. Cache/platform query
      // changes cannot evade the fault or make it target another image.
      const match = (value: URL) => value.origin === url.origin && value.pathname === url.pathname &&
        value.searchParams.getAll('unstable_path').length <= 1 && value.searchParams.get('unstable_path') === url.searchParams.get('unstable_path');
      const route = async (value: Route) => {
        if (disposed) { await value.abort().catch(() => {}); return; }
        if (value.request().resourceType() !== 'image') { await value.continue(); return; }
        if (evidence.failed === 0) { evidence.failed++; await value.abort(); }
        else { evidence.retried++; await value.continue(); }
      };
      posterRoutes.push({ index, match, route });
      await participants[index].page.route(match, route);
      return evidence;
    },
    // Intentional contract probes are explicitly marked and separately counted.
    // Own credentials stay inside their originating context; no new Auth call.
    async probe(index: 0 | 1, outcome: 'not_ready' | 'available' | 'not_found', overlap = false, targetId?: string) {
      if (!binding) throw safeError();
      const before = stats[index].probes, count = overlap ? 2 : 1;
      const valid = await participants[index].page.evaluate(async ({ api, room, expected, label, overlap }) => {
        const key = Object.keys(localStorage).find(name => /^sb-.+-auth-token$/.test(name));
        const session = key ? JSON.parse(localStorage.getItem(key) ?? 'null') : null;
        if (!session?.access_token) return false;
        const send = () => fetch(`${api.origin}/rest/v1/rpc/ensure_room_candidate`, {
          method: 'POST', headers: { apikey: api.publicKey, Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json', 'x-client-info': label }, body: JSON.stringify({ p_room_id: room.id }),
        });
        const responses = await Promise.all(overlap ? [send(), send()] : [send()]);
        return (await Promise.all(responses.map(async response => {
          const rows = await response.json();
          return response.ok && Array.isArray(rows) && rows.length === 1 && rows[0] &&
            Object.keys(rows[0]).sort().join(',') === 'candidate_id,outcome,poster_key,release_year,title' &&
            Object.entries(expected).every(([key, value]) => rows[0][key] === value);
        }))).every(Boolean);
      }, { ...binding, room: targetId ? { ...binding.room, id: targetId } : binding.room, label: probeLabel, overlap, expected: outcome === 'available' ? firstCandidate :
        { outcome, candidate_id: null, title: null, release_year: null, poster_key: null } });
      expect(valid && stats[index].probes === before + count).toBe(true);
      await waitFor(() => probeResults[index].length === stats[index].probes);
    },
    async assertDisplay(index: 0 | 1) {
      const page = participants[index].page;
      await expect(page.getByTestId('candidate-title')).toHaveText(firstCandidate.title);
      await expect(page.getByTestId('candidate-year')).toHaveText(String(firstCandidate.release_year));
      await expect(page.getByTestId('candidate-title')).toBeVisible();
      await expect(page.getByTestId('candidate-year')).toBeVisible();
      await expect(page.getByTestId('candidate-status')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Retry candidate', exact: true })).toHaveCount(0);
      const poster = page.getByTestId('candidate-poster');
      await poster.scrollIntoViewIfNeeded(); await expect(poster).toBeVisible();
      const rendered = await poster.evaluate(async element => {
        const bounds = element.getBoundingClientRect();
        const painted = [element, ...element.querySelectorAll('*')].find(node => getComputedStyle(node).backgroundImage !== 'none');
        const source = painted && getComputedStyle(painted).backgroundImage.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
        const image = element.querySelector('img');
        if (!source || !image || !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) return { valid: false, source: '' };
        await image.decode();
        const paintBounds = painted!.getBoundingClientRect();
        return { source: new URL(source, location.href).href,
          valid: bounds.width > 0 && bounds.height > 0 && bounds.top < innerHeight && bounds.bottom > 0 &&
            bounds.left < innerWidth && bounds.right > 0 && paintBounds.width > 0 && paintBounds.height > 0 &&
            painted!.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) &&
            image.naturalWidth === 240 && image.naturalHeight === 360 && image.currentSrc === new URL(source, location.href).href };
      });
      expect(rendered.valid && httpOrigin(rendered.source) === appOrigin).toBe(true);
      await waitFor(() => images[index].has(rendered.source));
      const loaded = images[index].get(rendered.source)!;
      expect(loaded.ok && loaded.hash === expectedHash).toBe(true);
      expect(await page.getByTestId('candidate-card').getAttribute('aria-busy') !== 'true').toBe(true);
      expect(await page.evaluate(id => !document.body.innerText.includes(id), firstCandidate.candidate_id)).toBe(true);
      await participants[index].assertNoCredentialTextUi();
      return rendered.source;
    },
    async assertHealthy(expected: [number, number] = [1, 1]) {
      await waitFor(() => pending.size === 0);
      expect(!failed && !disposed && stats.every(value => value.external === 0 && value.http > 0 && value.sockets > 0)).toBe(true);
      expect(stats.every((value, index) => value.automatic === expected[index] && automaticResults[index].length + value.aborted === value.automatic &&
        probeResults[index].length === value.probes)).toBe(true);
      for (const participant of participants) {
        expect(await participant.page.evaluate(() => {
          const state = (window as typeof window & { __candidateObservation?: { seen: boolean; conflict: boolean } }).__candidateObservation;
          return state?.seen === true && state.conflict === false;
        })).toBe(true);
        await participant.assertAuthAccounting(1, 1);
      }
    },
    close,
  };
}
