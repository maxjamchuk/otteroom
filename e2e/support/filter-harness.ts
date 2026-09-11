import { expect, type Page, type Route } from '@playwright/test';
import { PARTICIPANT_GENRE_VALUES, type ParticipantGenre } from '../../src/filters/genres.ts';
import { committedRoomSnapshot, observeCandidateRpcZero, type PublicApi, type RoomProjection } from './room-harness.ts';

const exactFields = ['outcome', 'genres', 'release_year_from', 'release_year_to',
  'filter_completed_count', 'required_voter_count', 'allowed_release_year_max'] as const;
const outcomes = new Set(['not_found', 'not_ready', 'not_voter', 'not_submitted', 'saved', 'locked',
  'invalid_genres', 'invalid_year_range', 'unchanged']);
const genreOrder = new Map(PARTICIPANT_GENRE_VALUES.map((genre, index) => [genre, index]));

export type OwnFilterResult = {
  outcome: string;
  genres: ParticipantGenre[] | null;
  release_year_from: number | null;
  release_year_to: number | null;
  filter_completed_count: number | null;
  required_voter_count: number | null;
  allowed_release_year_max: number | null;
};

export function validateOwnFilterResult(value: unknown): OwnFilterResult {
  if (!Array.isArray(value) || value.length !== 1 || !value[0] || typeof value[0] !== 'object' ||
      Array.isArray(value[0]) || Object.keys(value[0]).sort().join(',') !== [...exactFields].sort().join(',')) {
    throw new Error('E2E_SAFE_FAILURE');
  }
  const row = value[0] as Record<(typeof exactFields)[number], unknown>;
  if (typeof row.outcome !== 'string' || !outcomes.has(row.outcome)) throw new Error('E2E_SAFE_FAILURE');
  if (row.outcome === 'not_found') {
    if (exactFields.slice(1).some(field => row[field] !== null)) throw new Error('E2E_SAFE_FAILURE');
    return row as OwnFilterResult;
  }
  if (!Number.isInteger(row.filter_completed_count) || !Number.isInteger(row.required_voter_count) ||
      !Number.isInteger(row.allowed_release_year_max) || (row.required_voter_count as number) < 2 ||
      (row.filter_completed_count as number) < 0 || (row.filter_completed_count as number) > (row.required_voter_count as number) ||
      (row.allowed_release_year_max as number) < 1900 || (row.allowed_release_year_max as number) > 32767) {
    throw new Error('E2E_SAFE_FAILURE');
  }
  const detail = row.outcome === 'saved' || row.outcome === 'locked' || row.outcome === 'unchanged';
  if (!detail) {
    if (row.genres !== null || row.release_year_from !== null || row.release_year_to !== null ||
      row.outcome === 'not_ready' && row.filter_completed_count !== 0 ||
      (row.outcome === 'not_submitted' || row.outcome === 'invalid_genres' || row.outcome === 'invalid_year_range') &&
        row.filter_completed_count === row.required_voter_count) throw new Error('E2E_SAFE_FAILURE');
    return row as OwnFilterResult;
  }
  if (!Array.isArray(row.genres) || row.genres.some(genre => !genreOrder.has(genre as ParticipantGenre)) ||
      new Set(row.genres).size !== row.genres.length || row.genres.some((genre, index, genres) =>
        index > 0 && genreOrder.get(genres[index - 1] as ParticipantGenre)! >= genreOrder.get(genre as ParticipantGenre)!) ||
      !Number.isInteger(row.release_year_from) || !Number.isInteger(row.release_year_to) ||
      (row.release_year_from as number) < 1900 || (row.release_year_from as number) > (row.release_year_to as number) ||
      (row.release_year_to as number) > (row.allowed_release_year_max as number)) throw new Error('E2E_SAFE_FAILURE');
  if (row.outcome === 'locked' && row.filter_completed_count !== row.required_voter_count) throw new Error('E2E_SAFE_FAILURE');
  return row as OwnFilterResult;
}

async function rpc(page: Page, api: PublicApi, name: 'get_my_participant_filter' | 'submit_my_participant_filter',
  body: Record<string, unknown>): Promise<OwnFilterResult> {
  const rows = await page.evaluate(async ({ origin, publicKey, name, body }) => {
    const key = Object.keys(localStorage).find(item => /^sb-.+-auth-token$/.test(item));
    const session = key ? JSON.parse(localStorage.getItem(key) ?? 'null') : null;
    if (!session?.access_token) throw new Error('E2E_SAFE_FAILURE');
    const response = await fetch(`${origin}/rest/v1/rpc/${name}`, { method: 'POST',
      headers: { apikey: publicKey, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body) });
    if (!response.ok) throw new Error('E2E_SAFE_FAILURE');
    return response.json();
  }, { ...api, name, body });
  return validateOwnFilterResult(rows);
}

export function recoverOwnFilter(page: Page, api: PublicApi, room: RoomProjection) {
  return rpc(page, api, 'get_my_participant_filter', { p_room_id: room.id });
}

export function submitOwnFilter(page: Page, api: PublicApi, room: RoomProjection,
  genres: readonly ParticipantGenre[], from: number, to: number) {
  return rpc(page, api, 'submit_my_participant_filter', {
    p_room_id: room.id, p_genres: [...genres], p_release_year_from: from, p_release_year_to: to,
  });
}

export function boundedFilterSnapshot(room: RoomProjection) {
  const snapshot = committedRoomSnapshot(room);
  return { roomXmin: snapshot.xmin, count: snapshot.row.filter_completed_count,
    filters: snapshot.filters.map(filter => ({ ...filter, genres: [...filter.genres] })) };
}

export async function assertFilterProgress(page: Page, room: RoomProjection, count: number) {
  await expect(page.getByText(`${count} of ${room.required_voter_count} filters collected`, { exact: true })).toBeVisible();
  expect(observeCandidateRpcZero(page).count()).toBe(0);
  await expect(page.getByTestId('candidate-card')).toHaveCount(0);
}

export async function installPreCommitFailure(page: Page) {
  let calls = 0;
  const handler = async (route: Route) => { calls++; await route.abort('failed'); };
  await page.route('**/rest/v1/rpc/submit_my_participant_filter', handler, { times: 1 });
  return { calls: () => calls, close: () => page.unroute('**/rest/v1/rpc/submit_my_participant_filter', handler) };
}

export async function installCommittedResponseLoss(page: Page) {
  let result: OwnFilterResult | null = null, calls = 0;
  const handler = async (route: Route) => {
    calls++;
    const response = await route.fetch({ maxRetries: 0, maxRedirects: 0, timeout: 15000 });
    try { if (!response.ok()) throw new Error('E2E_SAFE_FAILURE'); result = validateOwnFilterResult(await response.json()); }
    finally { await response.dispose(); }
    await route.abort('failed');
  };
  await page.route('**/rest/v1/rpc/submit_my_participant_filter', handler, { times: 1 });
  return { calls: () => calls, result: () => result, close: () => page.unroute('**/rest/v1/rpc/submit_my_participant_filter', handler) };
}

export async function installSubmitOverlap(pages: Page[]) {
  if (pages.length < 2 || pages.length > 3 || new Set(pages).size !== pages.length) throw new Error('E2E_SAFE_FAILURE');
  let held = 0, release!: () => void, arrived!: () => void, failed = false;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const ready = new Promise<void>(resolve => { arrived = resolve; });
  const entries = pages.map(page => ({ page, handler: async (route: Route) => {
    try {
      if (Object.keys(route.request().postDataJSON() ?? {}).sort().join(',') !==
          'p_genres,p_release_year_from,p_release_year_to,p_room_id') throw new Error();
      held++; if (held === pages.length) arrived(); await gate;
      if (failed) await route.abort('failed'); else await route.continue();
    } catch { failed = true; arrived(); release(); await route.abort('failed').catch(() => {}); }
  }}));
  for (const entry of entries) await entry.page.route('**/rest/v1/rpc/submit_my_participant_filter', entry.handler, { times: 1 });
  return { wait: async () => { await Promise.race([ready, new Promise((_, reject) => setTimeout(() => reject(new Error('E2E_SAFE_FAILURE')), 10000))]);
      if (failed || held !== pages.length) throw new Error('E2E_SAFE_FAILURE'); },
    release: () => release(),
    close: async () => { failed = true; release(); await Promise.all(entries.map(entry =>
      entry.page.unroute('**/rest/v1/rpc/submit_my_participant_filter', entry.handler))); } };
}

export async function installSubmitHold(page: Page) {
  let calls = 0, release!: () => void, arrived!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const ready = new Promise<void>(resolve => { arrived = resolve; });
  const handler = async (route: Route) => { calls++; arrived(); await gate; await route.continue(); };
  await page.route('**/rest/v1/rpc/submit_my_participant_filter', handler, { times: 1 });
  return {
    wait: () => Promise.race([ready, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('E2E_SAFE_FAILURE')), 10000))]),
    release: () => release(), calls: () => calls,
    close: async () => { release(); await page.unroute('**/rest/v1/rpc/submit_my_participant_filter', handler); },
  };
}
