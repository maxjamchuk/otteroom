import { expect } from '@playwright/test';
import { test, safeBody, SafeDiagnostics } from './support/safe-diagnostics';

// Binding allocation from quickstart; later cases consume these trials, not
// additional fixture/bootstrap identities. Phase 5 executes only the Auth row.
export const anonymousBudget = Object.freeze({
  E01: 3, E02: 2, E03: 4, E04: 4, E05: 3, E06: 3,
  E07: 5, E08: 4, E09: 2, E10: 2, E11: 1, E12: 11, auth: 3,
});

async function ownParticipant(page: import('@playwright/test').Page): Promise<string> {
  // Own-session inspection stays in memory, never an application/debug endpoint.
  const id = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(name => /^sb-.+-auth-token$/.test(name));
    if (!key) return null;
    const value = JSON.parse(localStorage.getItem(key) ?? 'null');
    return typeof value?.user?.id === 'string' && value.user.is_anonymous === true ? value.user.id : null;
  });
  if (!id) throw new Error('E2E_SAFE_FAILURE');
  return id;
}

test('@auth persisted participant and isolated identity; baseline routes remain inert', async ({ page, browser, baseURL, viewport, diagnostics }, info) => {
  await safeBody(diagnostics, async () => {
    expect(Object.values(anonymousBudget).reduce((sum, cap) => sum + cap, 0) === 47).toBe(true);
    diagnostics.allowAnonymousSignups(anonymousBudget.auth - 1);
    const home = await page.goto('/');
    expect(home?.status()).toBe(200);
    await expect(page.getByRole('link', { name: 'Open route preview' })).toBeVisible();
    await diagnostics.assertAuthAccounting(1, 1);
    const original = await ownParticipant(page);
    await page.reload();
    await expect(page.getByRole('link', { name: 'Open route preview' })).toBeVisible();
    expect((await ownParticipant(page)) === original).toBe(true);
    await diagnostics.assertAuthAccounting(1, 1);
    await diagnostics.assertNoCredentialUi();
    await page.getByRole('link', { name: 'Open route preview' }).click();
    await expect(page).toHaveURL(/\/room\/0A1B2C3D4E$/);
    await expect(page.getByRole('heading', { name: 'Room route preview' })).toBeVisible();
    await diagnostics.assertNoCredentialUi();
    await page.getByRole('link', { name: 'Back to home' }).click();
    await expect(page).toHaveURL(baseURL + '/');
    const direct = await page.goto('/room/ABCDEF0123');
    expect(direct?.status()).toBe(200);
    await expect(page.getByRole('link', { name: 'Back to home' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Room route preview' })).toBeVisible();
    expect((await ownParticipant(page)) === original).toBe(true);
    await diagnostics.assertAuthAccounting(1, 1);

    const options = { baseURL, viewport, serviceWorkers: 'block' as const };
    const context = await browser.newContext(options);
    let fresh: SafeDiagnostics | undefined;
    try {
      fresh = await SafeDiagnostics.create(context, options, info);
      fresh.allowAnonymousSignups(1);
      await safeBody(fresh, async () => {
        await fresh!.page.goto('/');
        await expect(fresh!.page.getByRole('link', { name: 'Open route preview' })).toBeVisible();
        await fresh!.assertAuthAccounting(1, 1);
        const separate = await ownParticipant(fresh!.page);
        expect(separate !== original).toBe(true);
        await fresh!.assertNoCredentialUi();

        // Explicit user/test storage clearing, never recovery or quota evasion.
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await expect(page.getByRole('link', { name: 'Back to home' })).toBeVisible();
        const cleared = await ownParticipant(page);
        expect(cleared !== original && cleared !== separate).toBe(true);
        await diagnostics.assertAuthAccounting(2, 2);
        expect(diagnostics.signupAttempts + fresh!.signupAttempts === 3).toBe(true);
        await diagnostics.assertNoCredentialUi();
      });
    } finally {
      if (fresh) await fresh.close(); else await context.close();
    }
  });
});
