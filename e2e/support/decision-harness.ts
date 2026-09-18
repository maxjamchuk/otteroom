import { expect, type Page, type Route, type TestInfo } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { committedRoomSnapshot, realtimeBarrier, type PublicApi, type RoomProjection } from './room-harness.ts';

export type SafeDecision = 'yes' | 'no';
export type OwnDecisionResult = Readonly<{
  outcome: 'decided' | 'not_decided' | 'observer' | 'accepted' | 'unchanged' | 'conflict' |
    'not_voter' | 'not_found' | 'not_ready' | 'candidate_changed';
  my_decision: SafeDecision | null;
  decision_completed_count: number | null;
  required_voter_count: number | null;
  decision_set_complete: boolean | null;
  two_voter_agreement: boolean | null;
}>;

const fields = ['outcome', 'my_decision', 'decision_completed_count', 'required_voter_count',
  'decision_set_complete', 'two_voter_agreement'] as const;
const projected = new Set(['decided', 'not_decided', 'observer', 'accepted', 'unchanged', 'conflict', 'not_voter']);
const protectedOutcomes = new Set(['not_found', 'not_ready', 'candidate_changed']);
const decisionEndpoint = '**/rest/v1/rpc/submit_room_candidate_decision';

export function validateOwnDecisionResult(value: unknown): OwnDecisionResult {
  if (!Array.isArray(value) || value.length !== 1 || !value[0] || typeof value[0] !== 'object' ||
      Array.isArray(value[0]) || Object.keys(value[0]).sort().join(',') !== [...fields].sort().join(',')) {
    throw new Error('E2E_SAFE_FAILURE');
  }
  const row = value[0] as Record<(typeof fields)[number], unknown>;
  if (typeof row.outcome !== 'string' || !projected.has(row.outcome) && !protectedOutcomes.has(row.outcome))
    throw new Error('E2E_SAFE_FAILURE');
  if (protectedOutcomes.has(row.outcome)) {
    if (fields.slice(1).some(field => row[field] !== null)) throw new Error('E2E_SAFE_FAILURE');
    return row as OwnDecisionResult;
  }
  const completed = row.decision_completed_count, required = row.required_voter_count;
  if (!Number.isInteger(completed) || !Number.isInteger(required) || (completed as number) < 0 ||
      (required as number) < 2 || (completed as number) > (required as number) ||
      row.decision_set_complete !== (completed === required) ||
      ((required as number) === 2 ? typeof row.two_voter_agreement !== 'boolean' : row.two_voter_agreement !== null) ||
      row.two_voter_agreement === true && row.decision_set_complete !== true) throw new Error('E2E_SAFE_FAILURE');
  const owns = ['decided', 'accepted', 'unchanged', 'conflict'].includes(row.outcome);
  if (owns !== (row.my_decision === 'yes' || row.my_decision === 'no') ||
      !owns && row.my_decision !== null) throw new Error('E2E_SAFE_FAILURE');
  return row as OwnDecisionResult;
}

async function rpc(page: Page, api: PublicApi, room: RoomProjection,
  name: 'get_room_candidate_decision' | 'submit_room_candidate_decision', value?: SafeDecision) {
  const tmdbMovieId = committedRoomSnapshot(room).row.tmdb_movie_id;
  if (!Number.isSafeInteger(tmdbMovieId) || (tmdbMovieId as number) <= 0) throw new Error('E2E_SAFE_FAILURE');
  const rows = await page.evaluate(async ({ origin, publicKey, name, roomId, tmdbMovieId, value }) => {
    const key = Object.keys(localStorage).find(item => /^sb-.+-auth-token$/.test(item));
    const token = key ? JSON.parse(localStorage.getItem(key) ?? 'null')?.access_token : null;
    if (!token) throw new Error('E2E_SAFE_FAILURE');
    const body = name === 'submit_room_candidate_decision'
      ? { p_room_id: roomId, p_expected_tmdb_movie_id: tmdbMovieId, p_decision: value }
      : { p_room_id: roomId, p_expected_tmdb_movie_id: tmdbMovieId };
    const response = await fetch(`${origin}/rest/v1/rpc/${name}`, { method: 'POST',
      headers: { apikey: publicKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('E2E_SAFE_FAILURE');
    return response.json();
  }, { ...api, name, roomId: room.id, tmdbMovieId, value });
  return validateOwnDecisionResult(rows);
}

export function recoverOwnDecision(page: Page, api: PublicApi, room: RoomProjection) {
  return rpc(page, api, room, 'get_room_candidate_decision');
}

export function submitOwnDecision(page: Page, api: PublicApi, room: RoomProjection, value: SafeDecision) {
  return rpc(page, api, room, 'submit_room_candidate_decision', value);
}

export function boundedCandidateIdentity(room: RoomProjection): number {
  const value = committedRoomSnapshot(room).row.tmdb_movie_id;
  if (!Number.isSafeInteger(value) || (value as number) <= 0) throw new Error('E2E_SAFE_FAILURE');
  return value as number;
}

// Feature 007 acceptance begins from an already assigned candidate. This
// bounded local fixture operation is test-only, emits the normal rooms UPDATE,
// and never returns or persists the room/candidate identifiers it consumes.
export function preassembleAssignedCandidate(room: RoomProjection, tmdbMovieId: number) {
  if (!/^[0-9a-f-]{36}$/.test(room.id) || !Number.isSafeInteger(tmdbMovieId) || tmdbMovieId <= 0)
    throw new Error('E2E_SAFE_FAILURE');
  const result = spawnSync('docker', ['exec', 'supabase_db_otteroom-room-session', 'psql', '-X',
    '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAt', '-c',
    `update public.rooms set candidate_acquisition_status='assigned',tmdb_movie_id=${tmdbMovieId},
      movie_candidate_id=null,updated_at=clock_timestamp()
      where id='${room.id}'::uuid and state='ready' and filter_resolution_status='compatible'
        and candidate_acquisition_status='pending' and decision_completed_count=0;
     select count(*) from public.rooms where id='${room.id}'::uuid
       and candidate_acquisition_status='assigned' and tmdb_movie_id=${tmdbMovieId};`],
  { encoding: 'utf8', timeout: 10000, maxBuffer: 1024 });
  if (result.status !== 0 || result.error || result.stdout.trim() !== '1') throw new Error('E2E_SAFE_FAILURE');
}

export function preassembleDecisionRooms(template: RoomProjection, count: number,
  tmdbMovieId: number): RoomProjection[] {
  if (!/^[0-9a-f-]{36}$/.test(template.id) || count !== 10 ||
      !Number.isSafeInteger(tmdbMovieId) || tmdbMovieId <= 0) throw new Error('E2E_SAFE_FAILURE');
  const sql = `begin;
    create temporary table feature007_room_seed on commit drop as
      select extensions.gen_random_uuid() id,extensions.gen_random_uuid() request_id
      from generate_series(1,${count});
    alter table feature007_room_seed add column code text;
    update feature007_room_seed set code=upper(substr(md5(id::text),1,10));
    insert into public.rooms(id,code,creation_request_id,creator_user_id,created_at,updated_at,
      movie_candidate_id,required_voter_count,voter_count,filter_completed_count,
      filter_resolution_status,candidate_acquisition_status,tmdb_movie_id,decision_completed_count)
    select seed.id,seed.code,seed.request_id,source.creator_user_id,clock_timestamp(),clock_timestamp(),
      null,2,2,2,'compatible','assigned',${tmdbMovieId},0
    from feature007_room_seed seed cross join public.rooms source where source.id='${template.id}'::uuid;
    create temporary table feature007_member_seed on commit drop as
      select extensions.gen_random_uuid() id,seed.id room_id,member.user_id,member.is_voter,member.id source_member_id
      from feature007_room_seed seed cross join public.room_members member
      where member.room_id='${template.id}'::uuid and member.is_voter;
    insert into public.room_members(id,room_id,user_id,is_voter,joined_at)
      select id,room_id,user_id,is_voter,clock_timestamp() from feature007_member_seed;
    insert into public.participant_filters(room_member_id,genres,release_year_from,release_year_to)
      select target.id,source.genres,source.release_year_from,source.release_year_to
      from feature007_member_seed target join public.participant_filters source
        on source.room_member_id=target.source_member_id;
    insert into private.room_filter_resolutions(room_id,release_year_from,release_year_to)
      select seed.id,source.release_year_from,source.release_year_to
      from feature007_room_seed seed cross join private.room_filter_resolutions source
      where source.room_id='${template.id}'::uuid;
    insert into private.room_filter_resolution_genre_clauses(room_id,clause_ordinal,genres)
      select seed.id,source.clause_ordinal,source.genres
      from feature007_room_seed seed cross join private.room_filter_resolution_genre_clauses source
      where source.room_id='${template.id}'::uuid;
    select json_agg(json_build_object('id',id,'code',code,'state','ready','voter_count',2,
      'required_voter_count',2,'filter_completed_count',2,'filter_resolution_status','compatible',
      'candidate_acquisition_status','assigned','decision_completed_count',0) order by code)
      from feature007_room_seed;
    commit;`;
  const result = spawnSync('docker', ['exec', 'supabase_db_otteroom-room-session', 'psql', '-X',
    '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', sql],
  { encoding: 'utf8', timeout: 15000, maxBuffer: 16384 });
  if (result.status !== 0 || result.error) throw new Error('E2E_SAFE_FAILURE');
  try {
    const rooms = JSON.parse(result.stdout) as RoomProjection[];
    if (!Array.isArray(rooms) || rooms.length !== count || new Set(rooms.map(room => room.id)).size !== count ||
        rooms.some(room => !/^[0-9a-f-]{36}$/.test(room.id) || !/^[0-9A-F]{10}$/.test(room.code) ||
          room.state !== 'ready' || room.voter_count !== 2 || room.required_voter_count !== 2 ||
          room.filter_completed_count !== 2 || room.filter_resolution_status !== 'compatible' ||
          room.candidate_acquisition_status !== 'assigned' || room.decision_completed_count !== 0))
      throw new Error();
    return rooms;
  } catch { throw new Error('E2E_SAFE_FAILURE'); }
}

export async function installAssignedCandidatePresentation(pages: Page[], candidate: {
  tmdbMovieId: number; title: string; releaseYear: number; posterUrl?: string | null;
}) {
  if (pages.length < 2 || pages.length > 4 || new Set(pages).size !== pages.length ||
      !Number.isSafeInteger(candidate.tmdbMovieId) || candidate.tmdbMovieId <= 0 ||
      !candidate.title || !Number.isInteger(candidate.releaseYear) ||
      candidate.posterUrl !== undefined && candidate.posterUrl !== null &&
        !/^https:\/\/image\.tmdb\.org\/t\/p\/w\d+\/controlled\.png$/.test(candidate.posterUrl))
    throw new Error('E2E_SAFE_FAILURE');
  let roomId: string | null = null, failed = false;
  const entries = pages.map(page => ({ page, handler: async (route: Route) => {
    try {
      const body = route.request().postDataJSON();
      if (!roomId || route.request().method() !== 'POST' ||
          Object.keys(body ?? {}).join(',') !== 'room_id' || body.room_id !== roomId) throw new Error();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        outcome: 'available', candidate: { tmdb_movie_id: candidate.tmdbMovieId,
          title: candidate.title, release_year: candidate.releaseYear,
          poster_url: candidate.posterUrl === undefined
            ? 'https://image.tmdb.org/t/p/w500/controlled.png' : candidate.posterUrl },
      }) });
    } catch { failed = true; await route.abort('failed').catch(() => {}); }
  }}));
  for (const entry of entries) await entry.page.route('**/functions/v1/room-candidate', entry.handler);
  return {
    bind(room: RoomProjection) {
      if (!/^[0-9a-f-]{36}$/.test(room.id) || room.id === roomId) throw new Error('E2E_SAFE_FAILURE');
      roomId = room.id;
    },
    assertHealthy() { if (failed || !roomId) throw new Error('E2E_SAFE_FAILURE'); },
    async close() {
      await Promise.all(entries.map(entry => entry.page.unroute('**/functions/v1/room-candidate', entry.handler)));
      roomId = null;
    },
  };
}

export function assertSameCandidate(rooms: RoomProjection[]) {
  if (rooms.length < 1 || rooms.length > 12) throw new Error('E2E_SAFE_FAILURE');
  const identities = rooms.map(boundedCandidateIdentity);
  expect(new Set(identities).size).toBe(1);
}

export async function assertOwnDecision(page: Page, api: PublicApi, room: RoomProjection,
  value: SafeDecision | null, count: number) {
  const result = await recoverOwnDecision(page, api, room);
  expect(result.my_decision).toBe(value);
  expect(result.decision_completed_count).toBe(count);
  return result;
}

export async function assertDecisionReady(pages: Page[]) {
  if (pages.length < 1 || pages.length > 4 || new Set(pages).size !== pages.length)
    throw new Error('E2E_SAFE_FAILURE');
  await Promise.all(pages.map(async page => {
    await expect(page.getByText('Choose Yes or No for this candidate.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Yes — want to watch', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: "No — don't want to watch", exact: true })).toBeEnabled();
  }));
}

export async function keyboardDecision(page: Page, value: SafeDecision) {
  const label = value === 'yes' ? 'Yes — want to watch' : "No — don't want to watch";
  const button = page.getByRole('button', { name: label, exact: true });
  // A peer's accepted decision advances the room count and deliberately sends
  // every still-undecided voter through private recovery. Wait for that real
  // authority boundary before emitting the next keyboard action. Keep focus
  // acquisition and Enter delivery in one locator-scoped Playwright action so
  // a recovery render cannot move focus between separate focus and key calls.
  await expect(button).toBeEnabled();
  await button.press('Enter');
  await expect(page.getByText(`You chose ${value === 'yes' ? 'Yes' : 'No'}`, { exact: true })).toBeVisible();
}

export async function touchSwipeDecision(page: Page, value: SafeDecision) {
  const surface = page.getByTestId('candidate-decision-surface');
  const card = page.getByTestId('candidate-card');
  await card.scrollIntoViewIfNeeded();
  const [surfaceBox, cardBox] = await Promise.all([surface.boundingBox(), card.boundingBox()]);
  if (!surfaceBox || !cardBox) throw new Error('E2E_SAFE_FAILURE');
  const delta = Math.min(180, Math.max(130, cardBox.width * 0.5)) * (value === 'yes' ? 1 : -1);
  const target = page.getByText(`You chose ${value === 'yes' ? 'Yes' : 'No'}`, { exact: true });
  const points = [
    { x: cardBox.x + cardBox.width / 2, y: cardBox.y + Math.min(24, cardBox.height / 4) },
    { x: value === 'yes' ? cardBox.x + Math.min(40, cardBox.width / 4)
      : cardBox.x + cardBox.width - Math.min(40, cardBox.width / 4),
    y: cardBox.y + Math.min(24, cardBox.height / 4) },
    { x: surfaceBox.x + surfaceBox.width / 2, y: surfaceBox.y + Math.min(180, surfaceBox.height / 3) },
  ];
  for (const point of points) {
    await page.mouse.move(2, 2);
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(point.x + delta, point.y, { steps: 8 });
    await page.mouse.up();
    if (await target.isVisible()) return;
    if (!await page.getByText('Choose Yes or No for this candidate.', { exact: true }).isVisible()) break;
  }
  await expect(target).toBeVisible();
}

export async function cancelledTouchSwipe(page: Page) {
  const before = await page.getByTestId('decision-status').innerText();
  const surface = page.getByTestId('candidate-card');
  await surface.scrollIntoViewIfNeeded();
  const box = await surface.boundingBox();
  if (!box) throw new Error('E2E_SAFE_FAILURE');
  const x = box.x + box.width / 2, y = box.y + 100;
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart',
      touchPoints: [{ x, y, radiusX: 1, radiusY: 1, force: 1, id: 2 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove',
      touchPoints: [{ x: x + 100, y, radiusX: 1, radiusY: 1, force: 1, id: 2 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  } finally { await session.detach(); }
  await expect(page.getByTestId('decision-status')).toHaveText(before);
}

export async function installDecisionPrecommitFailure(page: Page) {
  let calls = 0;
  const handler = async (route: Route) => { calls++; await route.abort('failed'); };
  await page.route(decisionEndpoint, handler, { times: 1 });
  return { calls: () => calls, close: () => page.unroute(decisionEndpoint, handler) };
}

export async function installDecisionResponseLoss(page: Page) {
  let result: OwnDecisionResult | null = null, calls = 0;
  const handler = async (route: Route) => {
    calls++;
    const response = await route.fetch({ maxRetries: 0, maxRedirects: 0, timeout: 15000 });
    try { if (!response.ok()) throw new Error('E2E_SAFE_FAILURE'); result = validateOwnDecisionResult(await response.json()); }
    finally { await response.dispose(); }
    await route.abort('failed');
  };
  await page.route(decisionEndpoint, handler, { times: 1 });
  return { calls: () => calls, result: () => result, close: () => page.unroute(decisionEndpoint, handler) };
}

export async function installDecisionOverlap(pages: Page[]) {
  if (pages.length < 2 || pages.length > 3 || new Set(pages).size !== pages.length) throw new Error('E2E_SAFE_FAILURE');
  let held = 0, failed = false, release!: () => void, arrived!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const ready = new Promise<void>(resolve => { arrived = resolve; });
  const entries = pages.map(page => ({ page, handler: async (route: Route) => {
    try {
      if (Object.keys(route.request().postDataJSON() ?? {}).sort().join(',') !==
          'p_decision,p_expected_tmdb_movie_id,p_room_id') throw new Error();
      held++; if (held === pages.length) arrived(); await gate; await route.continue();
    } catch { failed = true; arrived(); release(); await route.abort('failed').catch(() => {}); }
  }}));
  for (const entry of entries) await entry.page.route(decisionEndpoint, entry.handler, { times: 1 });
  return {
    wait: () => Promise.race([ready, new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('E2E_SAFE_FAILURE')), 10000))]).then(() => {
      if (failed || held !== pages.length) throw new Error('E2E_SAFE_FAILURE');
    }),
    release: () => release(),
    close: async () => { failed = true; release(); await Promise.all(entries.map(entry =>
      entry.page.unroute(decisionEndpoint, entry.handler))); },
  };
}

export function decisionRealtimeBarrier(page: Page) { return realtimeBarrier(page); }

export class ControlledDecisionPerformance {
  #samples = 0;
  #passing = 0;
  #maximum = 0;
  #recoverableFailures = 0;
  #annotations: Record<'samples' | 'passing' | 'maximum' | 'recoverableFailures',
    { type: string; description: string }>;

  constructor(info: TestInfo) {
    this.#annotations = {
      samples: { type: 'safe-performance-samples', description: '0' },
      passing: { type: 'safe-performance-passing', description: '0' },
      maximum: { type: 'safe-performance-maximum-ms', description: '0' },
      recoverableFailures: { type: 'safe-performance-recoverable-failures', description: '0' },
    };
    info.annotations.push(...Object.values(this.#annotations));
  }

  record(durationMs: number, authoritative: boolean) {
    if (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > 600000) throw new Error('E2E_SAFE_FAILURE');
    this.#samples++;
    if (!authoritative) this.#recoverableFailures++;
    else if (durationMs <= 2000) this.#passing++;
    this.#maximum = Math.max(this.#maximum, Math.ceil(durationMs));
    this.#annotations.samples.description = String(this.#samples);
    this.#annotations.passing.description = String(this.#passing);
    this.#annotations.maximum.description = String(this.#maximum);
    this.#annotations.recoverableFailures.description = String(this.#recoverableFailures);
  }

  receipt() {
    if (this.#samples !== 20 || this.#passing < 19 || this.#recoverableFailures !== 0) throw new Error('E2E_SAFE_FAILURE');
    return Object.freeze({ samples: this.#samples, passing: this.#passing,
      maximumMs: this.#maximum, recoverableFailures: this.#recoverableFailures });
  }
}
