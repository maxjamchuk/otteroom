import http, { type IncomingMessage, type ServerResponse } from 'node:http';

export const TMDB_STUB_SCENARIOS = Object.freeze([
  'candidate', 'empty', 'timeout', 'rate-limit', 'server-error', 'malformed',
  'limit', 'details-error', 'configuration-error', 'no-poster',
] as const);
export type TmdbStubScenario = typeof TMDB_STUB_SCENARIOS[number];

type State = {
  scenario: TmdbStubScenario;
  hold: boolean;
  released: boolean;
  calls: { discover: number; details: number; configuration: number; poster: number };
  provider: { requests: number; completed: number; active: number };
  held: number;
  invalid: number;
  release: Set<() => void>;
};

const candidate = Object.freeze({ id: 6006, adult: false, genre_ids: [18, 28],
  title: 'Controlled Constellation', release_date: '2005-06-07', poster_path: '/controlled.png' });
const successor = Object.freeze({ ...candidate, id: 6007, title: 'Controlled Aurora',
  release_date: '2006-07-08', poster_path: '/controlled-successor.png' });
const decoys = Object.freeze([
  { ...candidate, id: 6001, adult: true },
  { ...candidate, id: 6002, genre_ids: [28] },
  { ...candidate, id: 6003, release_date: '1888-01-01' },
]);

function json(response: ServerResponse, status: number, body: unknown, headers: Record<string,string> = {}) {
  const bytes = Buffer.from(JSON.stringify(body));
  response.writeHead(status, { 'content-type': 'application/json', 'content-length': String(bytes.length), ...headers });
  response.end(bytes);
}

async function body(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []; let length = 0;
  for await (const value of request) {
    const chunk = Buffer.from(value); length += chunk.length;
    if (length > 4096) throw new Error('bound'); chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function validDiscover(url: URL): boolean {
  const allowed = new Set(['language','include_adult','include_video','sort_by',
    'primary_release_date.gte','primary_release_date.lte','page','with_genres']);
  return [...url.searchParams.keys()].every(key => allowed.has(key)) &&
    url.searchParams.get('language') === 'en-US' && url.searchParams.get('include_adult') === 'false' &&
    url.searchParams.get('include_video') === 'false' && url.searchParams.get('sort_by') === 'primary_release_date.asc' &&
    /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('primary_release_date.gte') ?? '') &&
    /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('primary_release_date.lte') ?? '') &&
    /^[1-9]\d*$/.test(url.searchParams.get('page') ?? '') &&
    (!url.searchParams.has('with_genres') || /^\d+(?:\|\d+)*$/.test(url.searchParams.get('with_genres') ?? ''));
}

function fresh(scenario: TmdbStubScenario, hold = false): State {
  return { scenario, hold, released: !hold, calls: { discover: 0, details: 0, configuration: 0, poster: 0 },
    provider: { requests: 0, completed: 0, active: 0 }, held: 0, invalid: 0, release: new Set() };
}

function loopback(address: string | undefined): boolean {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

export async function startTmdbStub(providerToken: string) {
  if (typeof providerToken !== 'string' || providerToken.length < 16 || providerToken.length > 256 ||
      /[\r\n]/.test(providerToken)) throw new Error('TMDB_STUB_TOKEN_INVALID');
  let state = fresh('candidate');
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://stub.invalid');
      const control = url.pathname === '/__control';
      if (control && !loopback(request.socket.remoteAddress)) {
        json(response, 404, { status_code: 34 }); return;
      }
      if (control && request.method === 'POST') {
        const value = await body(request) as Record<string, unknown>;
        if (!value || Object.keys(value).some(key => !['scenario','hold','release'].includes(key))) throw new Error('control');
        if (value.release === true) {
          state.released = true; for (const resume of state.release) resume(); state.release.clear();
        } else {
          if (typeof value.scenario !== 'string' || !TMDB_STUB_SCENARIOS.includes(value.scenario as TmdbStubScenario) ||
              !(value.hold === undefined || typeof value.hold === 'boolean')) throw new Error('control');
          for (const resume of state.release) resume();
          state = fresh(value.scenario as TmdbStubScenario, value.hold === true);
        }
        json(response, 200, { ok: true }); return;
      }
      if (control && request.method === 'GET') {
        json(response, 200, { scenario: state.scenario, calls: state.calls, held: state.held,
          released: state.released, invalid: state.invalid, provider: state.provider }); return;
      }
      const providerState = state;
      providerState.provider.requests++;
      providerState.provider.active++;
      let providerSettled = false;
      const settleProvider = (completed: boolean) => {
        if (providerSettled) return;
        providerSettled = true;
        providerState.provider.active--;
        if (completed) providerState.provider.completed++;
      };
      response.once('finish', () => settleProvider(true));
      response.once('close', () => settleProvider(false));
      if (request.headers.authorization !== `Bearer ${providerToken}`) {
        state.invalid++; json(response, 401, { status_code: 7 }); return;
      }
      if (url.pathname === '/3/discover/movie' && request.method === 'GET') {
        state.calls.discover++;
        if (!validDiscover(url)) { state.invalid++; json(response, 422, { status_code: 5 }); return; }
        if (state.hold && !state.released) {
          state.held++;
          await new Promise<void>(resolve => {
            const done = () => { state.release.delete(done); resolve(); };
            state.release.add(done); request.once('close', done);
          });
          if (request.destroyed || response.destroyed) return;
        }
        if (state.scenario === 'timeout') return;
        if (state.scenario === 'rate-limit') { json(response, 429, { status_code: 25 }, { 'retry-after': '0' }); return; }
        if (state.scenario === 'server-error') { json(response, 503, { status_code: 9 }); return; }
        if (state.scenario === 'malformed') { response.writeHead(200, { 'content-type': 'application/json' }); response.end('{'); return; }
        const page = Number(url.searchParams.get('page'));
        if (state.scenario === 'limit') { json(response, 200, { page, total_pages: 101, total_results: 2020, results: [] }); return; }
        // Returning the prior and successor identities in stable order lets the
        // Edge search prove that server-derived exclusions skip history.
        const results = state.scenario === 'empty' ? [] : [...decoys, candidate, successor];
        json(response, 200, { page, total_pages: 1, total_results: results.length, results }); return;
      }
      if (/^\/3\/movie\/\d+$/.test(url.pathname) && request.method === 'GET') {
        state.calls.details++;
        if (url.searchParams.get('language') !== 'en-US') { state.invalid++; json(response, 422, {}); return; }
        if (state.scenario === 'details-error') { json(response, 503, { status_code: 9 }); return; }
        const id = Number(url.pathname.split('/').at(-1));
        const selected = id === successor.id ? successor : id === candidate.id ? candidate : null;
        if (!selected) { state.invalid++; json(response, 404, { status_code: 34 }); return; }
        json(response, 200, { id: selected.id, title: selected.title, release_date: selected.release_date,
          poster_path: state.scenario === 'no-poster' ? null : selected.poster_path }); return;
      }
      if (url.pathname === '/3/configuration' && request.method === 'GET') {
        state.calls.configuration++;
        if (state.scenario === 'configuration-error') { json(response, 503, { status_code: 9 }); return; }
        json(response, 200, { images: { secure_base_url: 'https://image.tmdb.org/t/p/',
          poster_sizes: ['w92','w500','original'] } }); return;
      }
      state.invalid++; json(response, 404, { status_code: 34 });
    } catch { state.invalid++; json(response, 400, { status_code: 5 }); }
  });
  await new Promise<void>((resolve, reject) => {
    // The Supabase Edge runtime is a container and reaches the host through
    // host.docker.internal. A loopback-only listener refuses that connection on
    // native Linux Docker, so the provider endpoint must bind the host gateway.
    // Control remains loopback-only and provider traffic requires the exact
    // invocation-scoped random bearer token.
    server.once('error', reject); server.listen(0, '0.0.0.0', () => { server.removeListener('error', reject); resolve(); });
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('TMDB_STUB_START_FAILED');
  return Object.freeze({
    controlUrl: `http://127.0.0.1:${address.port}/__control`,
    edgeBaseUrl: `http://host.docker.internal:${address.port}/3`,
    providerAddress: address.address,
    close: async () => {
      for (const resume of state.release) resume(); state.release.clear();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    },
  });
}
