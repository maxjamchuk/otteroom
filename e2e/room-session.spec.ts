import { expect } from '@playwright/test';
import { test, safeBody } from './support/safe-diagnostics';

test('@baseline routes load and navigate without backend functionality', async ({ page, baseURL, diagnostics }) => {
  await safeBody(diagnostics, async () => {
    const home = await page.goto('/');
    expect(home?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Otteroom', exact: true })).toBeVisible();
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
    expect(diagnostics.signupAttempts).toBe(0);
  });
});
