import { expect, type Page, type Route } from '@playwright/test';
import { committedRoomSnapshot, navigateAfterResponseValidation,
  type DocumentReplacementLifecycle, type RoomProjection } from './room-harness.ts';

const decisionEndpoint = '**/rest/v1/rpc/submit_room_candidate_decision';
const candidateEndpoint = '**/functions/v1/room-candidate';

export type SafeProgression = 'collecting' | 'advancing' | 'agreed' | 'exhausted';

export async function navigateInvitationAfterCandidateResponses(
  candidateResponses: DocumentReplacementLifecycle, page: Pick<Page, 'goto'>,
  invitation: string) {
  return navigateAfterResponseValidation(candidateResponses, [page as Page], () => page.goto(invitation));
}

export async function reloadPagesAfterCandidateResponses(
  candidateResponses: DocumentReplacementLifecycle, pages: Pick<Page, 'reload'>[]) {
  if (pages.length < 2 || pages.length > 4 || new Set(pages).size !== pages.length)
    throw new Error('E2E_SAFE_FAILURE');
  return navigateAfterResponseValidation(candidateResponses, pages as Page[], () =>
    Promise.all(pages.map(page => page.reload({ waitUntil: 'domcontentloaded' }))));
}

export function progressionSnapshot(room: RoomProjection) {
  const row = committedRoomSnapshot(room).row;
  if (!Number.isInteger(row.candidate_sequence) || row.candidate_sequence < 0 ||
      !['inactive','collecting','advancing','agreed','exhausted'].includes(row.candidate_progression_status))
    throw new Error('E2E_SAFE_FAILURE');
  return Object.freeze({ sequence: row.candidate_sequence,
    progression: row.candidate_progression_status, completed: row.decision_completed_count,
    required: row.required_voter_count, candidate: row.tmdb_movie_id });
}

// Candidate identifiers are held only long enough to compare authority. They
// are never annotated, logged, written to artifacts, or returned in receipts.
export function assertCandidateChanged(before: ReturnType<typeof progressionSnapshot>,
  after: ReturnType<typeof progressionSnapshot>) {
  expect(before.candidate !== null && after.candidate !== null && before.candidate !== after.candidate).toBe(true);
  expect(after.sequence).toBe(before.sequence + 1);
}

export function assertCandidateRetained(before: ReturnType<typeof progressionSnapshot>,
  after: ReturnType<typeof progressionSnapshot>) {
  expect(after.sequence).toBe(before.sequence);
  expect(after.candidate).toBe(before.candidate);
}

export async function assertProgressionConverged(pages: Page[], expected: SafeProgression,
  completed?: number, required?: number, timeout = 5000) {
  if (pages.length < 2 || pages.length > 4 || new Set(pages).size !== pages.length || timeout > 5000)
    throw new Error('E2E_SAFE_FAILURE');
  if (expected === 'collecting' && (!Number.isInteger(completed) || !Number.isInteger(required) ||
      completed! < 0 || required! < 2 || completed! >= required!) ||
      expected !== 'collecting' && (completed !== undefined || required !== undefined))
    throw new Error('E2E_SAFE_FAILURE');
  const text = expected === 'collecting' ? `${completed} of ${required} decisions collected.` : expected === 'advancing'
    ? 'The group did not agree. Finding another movie.' : expected === 'agreed'
      ? 'Group agreement reached. Candidate selection has stopped.'
      : 'No further eligible movies were found for this selection.';
  await Promise.all(pages.map(page =>
    expect(page.getByTestId('candidate-progression-status')).toHaveText(text, { timeout })));
}

export async function installFinalDecisionHold(pages: Page[]) {
  if (pages.length < 2 || pages.length > 4 || new Set(pages).size !== pages.length)
    throw new Error('E2E_SAFE_FAILURE');
  let arrived = 0, released = false, failed = false;
  let release!: () => void, ready!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const all = new Promise<void>(resolve => { ready = resolve; });
  const entries = pages.map(page => ({ page, handler: async (route: Route) => {
    try {
      const body = route.request().postDataJSON();
      if (Object.keys(body ?? {}).sort().join(',') !==
          'p_decision,p_expected_candidate_sequence,p_expected_tmdb_movie_id,p_room_id') throw new Error();
      arrived++; if (arrived === pages.length) ready(); await gate; await route.continue();
    } catch { failed = true; ready(); release(); await route.abort('failed').catch(() => {}); }
  }}));
  for (const entry of entries) await entry.page.route(decisionEndpoint, entry.handler, { times: 1 });
  return {
    wait: async () => {
      await Promise.race([all, new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('E2E_SAFE_FAILURE')), 5000))]);
      if (failed || arrived !== pages.length) throw new Error('E2E_SAFE_FAILURE');
    },
    release() { released = true; release(); },
    async close() {
      if (!released) release();
      await Promise.all(entries.map(entry => entry.page.unroute(decisionEndpoint, entry.handler)));
    },
  };
}

export async function discardCommittedCandidateResponse(page: Page) {
  let calls = 0, committed = false;
  const handler = async (route: Route) => {
    calls++;
    const response = await route.fetch({ maxRetries: 0, maxRedirects: 0, timeout: 30000 });
    try {
      const value = response.ok() ? await response.json() : null;
      committed = value?.outcome === 'available' || value?.outcome === 'exhausted';
    } finally { await response.dispose(); }
    await route.abort('failed');
  };
  await page.route(candidateEndpoint, handler, { times: 1 });
  return { calls: () => calls, committed: () => committed,
    close: () => page.unroute(candidateEndpoint, handler) };
}

export function assertIdentityReceipt(actual: number, expected: 2 | 4) {
  if (!Number.isInteger(actual) || actual !== expected) throw new Error('E2E_SAFE_FAILURE');
}
