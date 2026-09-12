import { expect, type Page, type Route } from '@playwright/test';
import { PARTICIPANT_GENRES, PARTICIPANT_GENRE_VALUES, type ParticipantGenre } from '../src/filters/genres';
import { test, safeBody } from './support/safe-diagnostics';
import { assertReady, committedRoomSnapshot, createWaiting, createWaitingWithSession, observeCandidateRpcZero,
  ownParticipant, realtimeBarrier, startHost, withParticipants, type PublicApi, type RoomProjection } from './support/room-harness';
import { assertFilterProgress, boundedFilterSnapshot, installCommittedResponseLoss, installPreCommitFailure,
  installSubmitHold, installSubmitOverlap, recoverOwnFilter, submitOwnFilter } from './support/filter-harness';
import { verifyInvitationQr } from './support/qr-harness';
import { assertResolutionTrafficZero, assertResolutionView, assertStoredResolution,
  observeResolutionTraffic } from './support/resolution-harness';

export const filterAnonymousBudget = Object.freeze({ H01: 3, H02: 3, H03: 3 });

async function directJoin(page: Page, api: PublicApi, room: RoomProjection) {
  const row = await page.evaluate(async ({ api, room }) => {
    const key = Object.keys(localStorage).find(name => /^sb-.+-auth-token$/.test(name));
    const token = key ? JSON.parse(localStorage.getItem(key) ?? 'null')?.access_token : null;
    if (!token) throw new Error('E2E_SAFE_FAILURE');
    const response = await fetch(`${api.origin}/rest/v1/rpc/join_room`, { method: 'POST',
      headers: { apikey: api.publicKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_room_code: room.code }) });
    const rows = await response.json(); if (!response.ok || !Array.isArray(rows) || rows.length !== 1) throw new Error('E2E_SAFE_FAILURE');
    return rows[0];
  }, { api, room });
  expect(['joined', 'already_member']).toContain(row.outcome); return row;
}

async function assemble(pages: Page[], api: PublicApi, room: RoomProjection, invitation: string) {
  for (const page of pages) { await directJoin(page, api, room); expect((await page.goto(invitation))?.status() === 200).toBe(true); }
}

async function rawSubmit(page: Page, api: PublicApi, body: Record<string, unknown>) {
  return page.evaluate(async ({ api, body }) => {
    const key = Object.keys(localStorage).find(name => /^sb-.+-auth-token$/.test(name));
    const token = key ? JSON.parse(localStorage.getItem(key) ?? 'null')?.access_token : null;
    const response = await fetch(`${api.origin}/rest/v1/rpc/submit_my_participant_filter`, { method: 'POST',
      headers: { apikey: api.publicKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { ok: response.ok, rows: await response.json() };
  }, { api, body });
}

async function createNext(page: Page, diagnostics: Parameters<typeof createWaitingWithSession>[1], api: PublicApi,
  previous: ReturnType<typeof committedRoomSnapshot>, creatorIsVoter = true, requiredVoterCount = 3) {
  return createWaitingWithSession(page, diagnostics, api, previous, { requiredVoterCount, creatorIsVoter });
}

function candidateZero(pages: Page[], room: RoomProjection) {
  expect(pages.every(page => observeCandidateRpcZero(page).count() === 0)).toBe(true);
  const stored = committedRoomSnapshot(room);
  expect(stored.row.movie_candidate_id === null).toBe(true);
  return stored;
}

test('@filters H01 validates private owned filters and editable saved state', async ({ diagnostics, browser, baseURL, viewport }, info) => {
  test.setTimeout(90000);
  await safeBody(diagnostics, () => withParticipants(browser, { baseURL, viewport }, info, 2, async ([second, third]) => {
    const pages = [diagnostics.page, second.page, third.page];
    pages.forEach(observeResolutionTraffic);
    const transport = await realtimeBarrier(diagnostics.page);
    try {
    const readiness = transport.stats.readiness, reads = transport.stats.reads;
    const { api, room, invitation } = await createWaiting(diagnostics.page, diagnostics, { requiredVoterCount: 3, creatorIsVoter: true });
    for (const voter of [second, third]) await startHost(voter.page, voter);
    await assemble([second.page, third.page], api, room, invitation);
    await transport.wait('readiness', readiness + 1); await transport.wait('reads', reads + 1);
    for (const [index, voter] of [diagnostics, second, third].entries()) {
      await assertReady(voter.page, voter, room);
      const recovered = await recoverOwnFilter(voter.page, api, room);
      expect(recovered.outcome === 'not_submitted' && recovered.genres === null && recovered.release_year_from === null &&
        recovered.release_year_to === null && recovered.filter_completed_count === 0).toBe(true);
      if (index === 0) {
        await expect(voter.page.getByText('Any genre', { exact: true })).toBeVisible();
        await expect(voter.page.getByLabel('Release year from', { exact: true })).toHaveValue('1900');
        await expect(voter.page.getByLabel('Release year to', { exact: true })).toHaveValue('2026');
        for (const genre of PARTICIPANT_GENRES) await expect(voter.page.getByRole('checkbox', { name: genre.label, exact: true })).toBeVisible();
      }
    }
    expect(PARTICIPANT_GENRE_VALUES.length).toBe(19);
    const all = await submitOwnFilter(pages[0], api, room, [...PARTICIPANT_GENRE_VALUES].reverse(), 1900, 2026);
    expect(all.outcome).toBe('saved');
    if (all.outcome !== 'saved') throw new Error('E2E_SAFE_FAILURE');
    expect(JSON.stringify(all.genres) === JSON.stringify(PARTICIPANT_GENRE_VALUES) && all.filter_completed_count === 1).toBe(true);
    const any = await submitOwnFilter(pages[1], api, room, [], 1900, 1900);
    expect(any.outcome).toBe('saved');
    if (any.outcome !== 'saved') throw new Error('E2E_SAFE_FAILURE');
    expect(any.genres?.length === 0 && any.release_year_from === 1900 && any.release_year_to === 1900).toBe(true);
    const beforeInvalid = boundedFilterSnapshot(room);
    for (const input of [
      { p_room_id: room.id, p_genres: ['not-a-genre'], p_release_year_from: 1900, p_release_year_to: 2026 },
      { p_room_id: room.id, p_genres: ['action'], p_release_year_from: 1899, p_release_year_to: 2026 },
      { p_room_id: room.id, p_genres: ['action'], p_release_year_from: 2026, p_release_year_to: 1900 },
      { p_room_id: room.id, p_genres: ['action'], p_release_year_from: 1900, p_release_year_to: 32767 },
    ]) {
      const invalid = await rawSubmit(pages[0], api, input);
      if (input.p_genres[0] === 'not-a-genre') expect(invalid.ok).toBe(false);
      else expect(invalid.ok && invalid.rows?.[0]?.outcome === 'invalid_year_range').toBe(true);
      expect(JSON.stringify(boundedFilterSnapshot(room)) === JSON.stringify(beforeInvalid)).toBe(true);
    }
    const spoof = await rawSubmit(pages[1], api, { p_room_id: room.id, p_genres: ['comedy'], p_release_year_from: 1900,
      p_release_year_to: 2026, p_room_member_id: (await ownParticipant(pages[0])) });
    expect(spoof.ok).toBe(false);
    const edited = await submitOwnFilter(pages[0], api, room, ['western'], 2000, 2020);
    expect(edited.outcome).toBe('saved');
    if (edited.outcome !== 'saved') throw new Error('E2E_SAFE_FAILURE');
    expect(edited.filter_completed_count === 2 && edited.genres?.[0] === 'western').toBe(true);
    const final = await submitOwnFilter(pages[2], api, room, ['animation', 'family'], 1990, 2010);
    expect(final.outcome === 'saved' && final.filter_completed_count === 3).toBe(true);
    for(const page of pages)await assertResolutionView(page,'incompatible');
    expect((await assertStoredResolution(diagnostics.page,api,room,'incompatible')).filter_completed_count===3).toBe(true);
    const completed = candidateZero(pages, room);
    assertResolutionTrafficZero(pages);
    expect(completed.filters.length === 3 && new Set(completed.filters.map(filter => JSON.stringify(filter.genres))).size === 3).toBe(true);
    for (const page of pages) await assertFilterProgress(page, room, 3);
    expect([diagnostics, second, third].reduce((sum, item) => sum + item.signupAttempts, 0) === filterAnonymousBudget.H01).toBe(true);
    await diagnostics.record({ scenario: 'H01', outcome: 'defaults; genres19/Any; boundary years; invalid and spoofed writes preserved; distinct private values; valid pre-lock edit; N/N frozen incompatible continuation; candidate/TMDB0; identities3' });
    } finally { await transport.close(); }
  }));
});

test('@filters H02 recovers filters through failures and lost acknowledgements', async ({ diagnostics, browser, baseURL, viewport }, info) => {
  test.setTimeout(90000);
  await safeBody(diagnostics, () => withParticipants(browser, { baseURL, viewport }, info, 2, async ([first, second]) => {
    const pages = [diagnostics.page, first.page, second.page];
    const transport = await realtimeBarrier(first.page);
    try {
      const initial = await createWaiting(diagnostics.page, diagnostics, { requiredVoterCount: 2, creatorIsVoter: false });
      for (const voter of [first, second]) await startHost(voter.page, voter);
      await assemble([first.page, second.page], initial.api, initial.room, initial.invitation);
      await transport.wait('readiness', 1); await transport.wait('reads', 1);
      await assertReady(diagnostics.page, diagnostics, initial.room);
      expect((await recoverOwnFilter(diagnostics.page, initial.api, initial.room)).outcome === 'not_voter').toBe(true);
      await expect(diagnostics.page.getByRole('heading', { name: 'Choose your filters', exact: true })).toHaveCount(0);
      expect(await verifyInvitationQr(diagnostics.page, initial.invitation) === initial.invitation).toBe(true);
      const abort = await installPreCommitFailure(first.page);
      await expect(submitOwnFilter(first.page, initial.api, initial.room, ['crime'], 1990, 2000)).rejects.toThrow();
      expect(abort.calls() === 1 && boundedFilterSnapshot(initial.room).count === 0).toBe(true); await abort.close();
      await transport.disconnect();
      const saved = await submitOwnFilter(second.page, initial.api, initial.room, ['documentary'], 2001, 2026);
      expect(saved.outcome === 'saved' && saved.filter_completed_count === 1).toBe(true);
      transport.resume(); await first.page.reload(); await assertFilterProgress(first.page, initial.room, 1);
      expect((await recoverOwnFilter(first.page, initial.api, initial.room)).outcome === 'not_submitted').toBe(true);
      const final = await submitOwnFilter(first.page, initial.api, initial.room, ['crime'], 1990, 2000);
      expect(final.outcome === 'saved' && final.filter_completed_count === 2).toBe(true);
      await transport.disconnect(); transport.resume(); await first.page.reload();
      await assertFilterProgress(first.page, initial.room, 2);
      expect((await recoverOwnFilter(first.page, initial.api, initial.room)).outcome === 'locked').toBe(true);
      await assertFilterProgress(diagnostics.page, initial.room, 2);
      expect((await directJoin(first.page, initial.api, initial.room)).outcome === 'already_member').toBe(true);

      const next = await createNext(diagnostics.page, diagnostics, initial.api, committedRoomSnapshot(initial.room), false, 2);
      await assemble([first.page, second.page], initial.api, next.room, next.invitation);
      const overlap = await installSubmitOverlap([first.page, second.page]);
      const submissions = [submitOwnFilter(first.page, initial.api, next.room, ['action'], 1900, 2026),
        submitOwnFilter(second.page, initial.api, next.room, ['comedy'], 1900, 2026)];
      await overlap.wait(); overlap.release(); const results = await Promise.all(submissions); await overlap.close();
      expect(results.every(result => result.outcome === 'saved') && boundedFilterSnapshot(next.room).count === 2).toBe(true);

      const third = await createNext(diagnostics.page, diagnostics, initial.api, committedRoomSnapshot(next.room), false, 2);
      await assemble([first.page, second.page], initial.api, third.room, third.invitation);
      const loss = await installCommittedResponseLoss(first.page);
      await expect(submitOwnFilter(first.page, initial.api, third.room, ['music'], 1950, 2000)).rejects.toThrow();
      expect(loss.calls() === 1 && loss.result()?.outcome === 'saved' && boundedFilterSnapshot(third.room).count === 1).toBe(true);
      await loss.close(); expect((await recoverOwnFilter(first.page, initial.api, third.room)).outcome === 'saved').toBe(true);
      expect((await submitOwnFilter(second.page, initial.api, third.room, ['mystery'], 2000, 2026)).filter_completed_count === 2).toBe(true);
      for (const room of [initial.room, next.room, third.room]) candidateZero(pages, room);
      expect([diagnostics, first, second].reduce((sum, item) => sum + item.signupAttempts, 0) === filterAnonymousBudget.H02).toBe(true);
      await diagnostics.record({ scenario: 'H02', outcome: 'non-voter aggregate only; QR/link/code/reload/socket recovery; disconnected incomplete/completed voters; abort/retry; duplicate overlap; committed-response-loss recovery; candidate0; identities3' });
    } finally { await transport.close(); }
  }));
});

test('@filters H03 serializes final completion and freezes every filter', async ({ diagnostics, browser, baseURL, viewport }, info) => {
  test.setTimeout(120000);
  await safeBody(diagnostics, () => withParticipants(browser, { baseURL, viewport }, info, 2, async ([second, third]) => {
    const pages = [diagnostics.page, second.page, third.page];
    pages.forEach(observeResolutionTraffic);
    const transport = await realtimeBarrier(diagnostics.page);
    try {
    let readiness = transport.stats.readiness, reads = transport.stats.reads;
    const first = await createWaiting(diagnostics.page, diagnostics, { requiredVoterCount: 3, creatorIsVoter: true });
    for (const voter of [second, third]) await startHost(voter.page, voter);
    await assemble([second.page, third.page], first.api, first.room, first.invitation);
    await transport.wait('readiness', readiness + 1); await transport.wait('reads', reads + 1);
    expect((await submitOwnFilter(pages[0], first.api, first.room, ['action'], 1900, 2026)).filter_completed_count === 1).toBe(true);
    const finalTwo = await installSubmitOverlap([pages[1], pages[2]]);
    const raced = [submitOwnFilter(pages[1], first.api, first.room, ['comedy'], 1900, 2026),
      submitOwnFilter(pages[2], first.api, first.room, ['drama'], 1900, 2026)];
    await finalTwo.wait(); finalTwo.release(); const raceResults = await Promise.all(raced); await finalTwo.close();
    expect(raceResults.every(result => result.outcome === 'saved') && raceResults.map(result => result.filter_completed_count).sort().join(',') === '2,3').toBe(true);
    for(const page of pages)await assertResolutionView(page,'compatible');
    expect((await assertStoredResolution(diagnostics.page,first.api,first.room,'compatible')).filter_completed_count===3).toBe(true);
    const frozen = boundedFilterSnapshot(first.room);
    expect((await submitOwnFilter(pages[0], first.api, first.room, ['action'], 1900, 2026)).outcome === 'unchanged').toBe(true);
    for (const [page, genres] of [[pages[0], ['war']], [pages[1], []], [pages[2], ['western']]] as const)
      expect((await submitOwnFilter(page, first.api, first.room, genres, 1900, 2026)).outcome === 'locked').toBe(true);
    expect(JSON.stringify(boundedFilterSnapshot(first.room)) === JSON.stringify(frozen)).toBe(true);

    readiness = transport.stats.readiness; reads = transport.stats.reads;
    const editFirst = await createNext(diagnostics.page, diagnostics, first.api, committedRoomSnapshot(first.room));
    await assemble([second.page, third.page], first.api, editFirst.room, editFirst.invitation);
    await transport.wait('readiness', readiness + 1); await transport.wait('reads', reads + 1);
    await submitOwnFilter(pages[0], first.api, editFirst.room, ['action'], 1900, 2026);
    await submitOwnFilter(pages[1], first.api, editFirst.room, ['comedy'], 1900, 2026);
    expect((await submitOwnFilter(pages[0], first.api, editFirst.room, ['adventure'], 1950, 2000)).outcome === 'saved').toBe(true);
    expect((await submitOwnFilter(pages[2], first.api, editFirst.room, ['drama'], 1900, 2026)).filter_completed_count === 3).toBe(true);
    for(const page of pages)await assertResolutionView(page,'compatible');
    await assertStoredResolution(diagnostics.page,first.api,editFirst.room,'compatible');
    expect((await recoverOwnFilter(pages[0], first.api, editFirst.room)).outcome === 'locked').toBe(true);

    readiness = transport.stats.readiness; reads = transport.stats.reads;
    const finalFirst = await createNext(diagnostics.page, diagnostics, first.api, committedRoomSnapshot(editFirst.room));
    await assemble([second.page, third.page], first.api, finalFirst.room, finalFirst.invitation);
    await transport.wait('readiness', readiness + 1); await transport.wait('reads', reads + 1);
    await Promise.all([submitOwnFilter(pages[0], first.api, finalFirst.room, ['action'], 1900, 2026),
      submitOwnFilter(pages[1], first.api, finalFirst.room, ['comedy'], 1900, 2026)]);
    const loss = await installCommittedResponseLoss(pages[2]);
    await expect(submitOwnFilter(pages[2], first.api, finalFirst.room, ['drama'], 1900, 2026)).rejects.toThrow();
    expect(loss.result()?.filter_completed_count === 3).toBe(true); await loss.close();
    expect((await recoverOwnFilter(pages[2], first.api, finalFirst.room)).outcome === 'locked').toBe(true);
    for(const page of pages)await assertResolutionView(page,'compatible');
    await assertStoredResolution(diagnostics.page,first.api,finalFirst.room,'compatible');
    const beforeLocked = boundedFilterSnapshot(finalFirst.room);
    expect((await submitOwnFilter(pages[0], first.api, finalFirst.room, ['western'], 1900, 2026)).outcome === 'locked').toBe(true);
    expect(JSON.stringify(boundedFilterSnapshot(finalFirst.room)) === JSON.stringify(beforeLocked)).toBe(true);

    readiness = transport.stats.readiness; reads = transport.stats.reads;
    const active = await createNext(diagnostics.page, diagnostics, first.api, committedRoomSnapshot(finalFirst.room));
    await assemble([second.page, third.page], first.api, active.room, active.invitation);
    await transport.wait('readiness', readiness + 1); await transport.wait('reads', reads + 1);
    const repeats = await Promise.all([submitOwnFilter(pages[0], first.api, active.room, ['history'], 1900, 2026),
      submitOwnFilter(pages[0], first.api, active.room, ['history'], 1900, 2026)]);
    expect(repeats.map(result => result.outcome).sort().join(',') === 'saved,unchanged' && boundedFilterSnapshot(active.room).count === 1).toBe(true);
    await submitOwnFilter(pages[1], first.api, active.room, ['music'], 1900, 2026);
    const held = await installSubmitHold(pages[0]);
    const activeEdit = submitOwnFilter(pages[0], first.api, active.room, ['horror'], 1900, 2026);
    await held.wait(); expect(held.calls() === 1).toBe(true);
    expect((await submitOwnFilter(pages[2], first.api, active.room, ['western'], 1900, 2026)).filter_completed_count === 3).toBe(true);
    held.release(); expect((await activeEdit).outcome === 'locked').toBe(true); await held.close();
    for(const page of pages)await assertResolutionView(page,'compatible');
    await assertStoredResolution(diagnostics.page,first.api,active.room,'compatible');
    const activeFrozen = boundedFilterSnapshot(active.room);
    expect(activeFrozen.filters.some(filter => filter.genres.includes('history')) &&
      !activeFrozen.filters.some(filter => filter.genres.includes('horror'))).toBe(true);
    for (const room of [first.room, editFirst.room, finalFirst.room, active.room]) {
      const complete = candidateZero(pages, room); expect(complete.row.filter_completed_count === 3 && complete.filters.length === 3).toBe(true);
    }
    assertResolutionTrafficZero(pages);
    expect([diagnostics, second, third].reduce((sum, item) => sum + item.signupAttempts, 0) === filterAnonymousBudget.H03).toBe(true);
    await diagnostics.record({ scenario: 'H03', outcome: 'distinct final-two race coexists with automatic compatible resolution; concurrent same-voter saved/unchanged; edit-first and final-first orders; lost final acknowledgement; active save returns locked after observed N/N; all castable locked/no-write; candidate/TMDB0; identities3' });
    } finally { await transport.close(); }
  }));
});
