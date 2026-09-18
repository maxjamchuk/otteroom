import { expect, type Page, type Request, type Response, type Route } from '@playwright/test';
import fs from 'node:fs';
import { parseEnv } from 'node:util';
import { type SafeDiagnostics, safeError } from './safe-diagnostics.ts';
import { committedRoomSnapshot, type PublicApi, type RoomProjection } from './room-harness.ts';
import { candidateOverlapDiagnostic, type CandidateRequestDiagnostic } from './harness-observability.ts';
import type { TmdbStubScenario } from './tmdb-stub.ts';

export const controlledCandidate = Object.freeze({ tmdbMovieId: 6006,
  title: 'Controlled Constellation', releaseYear: 2005 });
const posterPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const endpoint = (value: string) => new URL(value).pathname === '/functions/v1/room-candidate';

type StubSnapshot = Readonly<{ scenario: TmdbStubScenario; calls: Readonly<{
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

export async function configureTmdb(scenario: TmdbStubScenario, hold = false) {
  await control({ scenario, hold });
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
      Object.keys(value).sort().join(',') !== 'candidate,outcome') return false;
  const row = value as Record<string, any>;
  return row.outcome === 'available' && row.candidate && !Array.isArray(row.candidate) &&
    Object.keys(row.candidate).sort().join(',') === 'poster_url,release_year,title,tmdb_movie_id' &&
    row.candidate.tmdb_movie_id === controlledCandidate.tmdbMovieId &&
    row.candidate.title === controlledCandidate.title && row.candidate.release_year === controlledCandidate.releaseYear &&
    (row.candidate.poster_url === null || /^https:\/\/image\.tmdb\.org\/t\/p\/w\d+\/controlled\.png$/.test(row.candidate.poster_url));
}

export async function candidateHarness(participants: SafeDiagnostics[], baseURL: string) {
  if (participants.length < 2 || participants.length > 4 || new Set(participants).size !== participants.length) throw safeError();
  const local = process.env.EXPO_PUBLIC_SUPABASE_URL ? process.env : parseEnv(fs.readFileSync('.env.local','utf8'));
  const apiOrigin = new URL(local.EXPO_PUBLIC_SUPABASE_URL ?? '').origin;
  const appOrigin = new URL(baseURL).origin;
  if (![apiOrigin,appOrigin].every(origin => ['127.0.0.1','localhost','[::1]'].includes(new URL(origin).hostname))) throw safeError();
  let binding: { room: RoomProjection; ids: string[]; api: PublicApi } | null = null;
  let failed = false, disposed = false;
  const stats = participants.map(() => ({ requests: 0, responses: 0, errors: 0, posters: 0,
    directTmdbApi: 0, fixture: 0, invalid: 0 }));
  const pending = new Set<Promise<void>>();
  const listeners = participants.map((participant,index) => {
    const onRequest = (request: Request) => {
      if (disposed) return;
      const url = new URL(request.url());
      if (url.hostname === 'api.themoviedb.org') stats[index].directTmdbApi++;
      if (/cardboard-comet|pebble-bay-lanterns|cloud-tram-four|clockwork-orchard|movie_candidates|ensure_room_candidate/i.test(request.url())) stats[index].fixture++;
      if (!endpoint(request.url())) return;
      stats[index].requests++;
      try {
        if (!binding || url.origin !== apiOrigin || request.method() !== 'POST' ||
            Object.keys(request.postDataJSON() ?? {}).join(',') !== 'room_id' ||
            request.postDataJSON().room_id !== binding.room.id) throw safeError();
        const bearer = request.headers().authorization?.match(/^Bearer (.+)$/)?.[1];
        const subject = bearer ? JSON.parse(Buffer.from(bearer.split('.')[1], 'base64url').toString()).sub : null;
        if (subject !== binding.ids[index]) throw safeError();
      } catch { stats[index].invalid++; failed = true; }
    };
    const onResponse = (response: Response) => {
      if (!endpoint(response.url())) return;
      const work = (async () => {
        try {
          const bytes = await response.body();
          if (bytes.length > 4096) throw safeError();
          const value = JSON.parse(bytes.toString('utf8'));
          if (response.ok()) {
            if (!(strictAvailable(value) || value?.outcome === 'no_candidates' && Object.keys(value).length === 1 ||
                value?.outcome === 'metadata_unavailable' && Object.keys(value).length === 1 ||
                value?.outcome === 'not_ready' && Object.keys(value).length === 1)) throw safeError();
          } else if (!(response.status() === 503 && JSON.stringify(value) === '{"error":"candidate_acquisition_unavailable"}')) throw safeError();
          stats[index][response.ok() ? 'responses' : 'errors']++;
        } catch { if (!disposed) { stats[index].invalid++; failed = true; } }
      })().finally(() => pending.delete(work));
      pending.add(work);
    };
    const posterRoute = async (route: Route) => {
      stats[index].posters++;
      await route.fulfill({ status: 200, contentType: 'image/png', body: posterPng });
    };
    participant.page.on('request',onRequest); participant.page.on('response',onResponse);
    return { participant, onRequest, onResponse, posterRoute };
  });
  for (const item of listeners) await item.participant.page.route('https://image.tmdb.org/**', item.posterRoute);
  return {
    stats,
    bind(room: RoomProjection, ids: string[], api: PublicApi) {
      if (binding || ids.length !== participants.length || new Set(ids).size !== ids.length || api.origin !== apiOrigin) throw safeError();
      binding = { room, ids: [...ids], api };
    },
    rebind(room: RoomProjection) { if (!binding || binding.room.id === room.id) throw safeError(); binding = { ...binding, room }; },
    async available(pages: Page[] = participants.map(item => item.page)) {
      for (const page of pages) {
        await expect(page.getByRole('heading',{name:controlledCandidate.title,exact:true}))
          .toBeVisible({timeout:30000});
        await expect(page.getByTestId('candidate-year')).toHaveText(String(controlledCandidate.releaseYear));
        const poster=page.getByTestId('candidate-poster');
        await expect(poster).toBeVisible();
        await expect(poster).toHaveAttribute('aria-label',`Poster for ${controlledCandidate.title}`);
        expect(await page.evaluate(id => !document.body.innerText.includes(String(id)) &&
          !/Cardboard Comet|Pebble Bay Lanterns|Cloud Tram Four|Clockwork Orchard/.test(document.body.innerText),
          controlledCandidate.tmdbMovieId)).toBe(true);
      }
    },
    async noCandidates(pages: Page[] = participants.map(item => item.page)) {
      for (const page of pages) {
        await expect(page.getByText('No eligible movie was observed during the completed search.',{exact:true})).toBeVisible();
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
      const route=async(value:Route)=>{calls++;try{const response=await value.fetch({maxRetries:0,maxRedirects:0,timeout:30000});
        try{const bytes=await response.body();committed=response.ok()&&strictAvailable(JSON.parse(bytes.toString('utf8')));}
        finally{await response.dispose();}await value.abort('failed');}finally{settled=true;}};
      await participants[index].page.route('**/functions/v1/room-candidate',route,{times:1});
      return { calls:()=>calls, committed:()=>committed, settled:()=>settled,
        close:()=>participants[index].page.unroute('**/functions/v1/room-candidate',route) };
    },
    assertHealthy() {
      if (failed || disposed || !binding || stats.some(value => value.invalid || value.directTmdbApi || value.fixture)) throw safeError();
    },
    async close() {
      if (disposed) return; disposed=true;
      await Promise.allSettled([...pending]);
      for(const item of listeners){item.participant.page.removeListener('request',item.onRequest);
        item.participant.page.removeListener('response',item.onResponse);
        await item.participant.page.unroute('https://image.tmdb.org/**',item.posterRoute);}
      pending.clear(); binding=null;
    },
  };
}
