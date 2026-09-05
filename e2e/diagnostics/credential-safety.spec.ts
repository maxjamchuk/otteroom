import { expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test, safeBody } from '../support/safe-diagnostics';
import { sanitizeDiagnostic, DiagnosticBuffer } from '../support/sanitize-diagnostics';
import { CredentialRegistry, startRegistryServer, registerCredentials } from '../support/credential-registry';
import { scanArtifacts } from '../../scripts/check-e2e-artifacts.mjs';
import { parseInvocation } from '../../scripts/run-e2e.mjs';

// Ordered A/B only. No C placeholder, no Auth calls and no backend dependency.
test('@diagnostics-static A runtime capture prevention', async ({ page, browser, context, diagnostics }, info) => {
  await safeBody(diagnostics, async () => {
    diagnostics.stage('config');
    const use = info.project.use;
    expect(use.trace === 'off' && use.video === 'off' && use.screenshot === 'off').toBe(true);
    expect(info.config.reporter.length === 1 && info.config.reporter[0][0].endsWith('/e2e/support/safe-reporter.ts')).toBe(true);
    expect(info.project.retries === 0).toBe(true);
    expect(info.project.repeatEach === 1 && info.config.fullyParallel === false && info.config.workers === 1).toBe(true);
    expect(process.env.PLAYWRIGHT_NO_COPY_PROMPT === '1').toBe(true);
    expect(browser.isConnected()).toBe(true);
    expect(Object.hasOwn(process.env, 'LD_LIBRARY_PATH')).toBe(false);
    if (process.env.OTTEROOM_E2E_RUNTIME === 'docker') {
      expect(/^ws:\/\/127\.0\.0\.1:[0-9]+\/$/.test(process.env.PW_TEST_CONNECT_WS_ENDPOINT ?? '')).toBe(true);
      expect(use.baseURL === 'http://127.0.0.1:8081').toBe(true);
    } else {
      expect(process.env.OTTEROOM_E2E_RUNTIME === 'native' && !process.env.PW_TEST_CONNECT_WS_ENDPOINT).toBe(true);
      expect(use.baseURL === 'http://127.0.0.1:8081').toBe(true);
    }
    expect(info.project.outputDir === process.env.OTTEROOM_E2E_ARTIFACT_DIR).toBe(true);
    expect(Object.isFrozen(diagnostics.options)).toBe(true);
    for (const field of ['recordHar', 'recordVideo', 'storageState']) {
      expect(Object.hasOwn(use, field) || Object.hasOwn(diagnostics.options, field)).toBe(false);
    }
    // Call the actual guarded factory/API; rejection happens before recording.
    diagnostics.stage('capture-guards');
    await expect(browser.newContext({ recordHar: { path: 'forbidden.har' } })).rejects.toThrow('E2E_SAFE_FAILURE');
    await expect(browser.newContext({ recordVideo: { dir: 'forbidden-video' } })).rejects.toThrow('E2E_SAFE_FAILURE');
    await expect(browser.newContext({ storageState: { cookies: [], origins: [] } })).rejects.toThrow('E2E_SAFE_FAILURE');
    await expect(context.tracing.start()).rejects.toThrow('E2E_SAFE_FAILURE');
    await expect(context.storageState()).rejects.toThrow('E2E_SAFE_FAILURE');
    await expect(context.request.storageState()).rejects.toThrow('E2E_SAFE_FAILURE');
    await expect(page.screenshot()).rejects.toThrow('E2E_SAFE_FAILURE');
    await expect(browser.newPage()).rejects.toThrow('E2E_SAFE_FAILURE');
    for (const argument of ['--trace=on', '--ui', '--debug', '--reporter=json', '--output=/tmp/unsafe']) {
      expect(() => parseInvocation(['acceptance', argument])).toThrow();
    }
    diagnostics.stage('ui');
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Otteroom', exact: true })).toBeVisible();
    await expect(diagnostics.captureControlledFailure(new Error('controlled synthetic'))).rejects.toThrow('E2E_SAFE_FAILURE');
    expect(diagnostics.signupAttempts).toBe(0);
  });
});

test('@diagnostics-static B synthetic safety and finalized artifacts', async ({ page, diagnostics }, info) => {
  await safeBody(diagnostics, async () => {
    diagnostics.stage('sanitizer');
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'otteroom-browser-safety-'));
    const registry = new CredentialRegistry();
    const server = await startRegistryServer(registry);
    const secret = 'synthetic-' + randomUUID();
    const jwt = [randomUUID(), randomUUID(), randomUUID()].map(value => value.replaceAll('-', '')).join('.');
    try {
      await registerCredentials(server.endpoint, 'synthetic-context', [secret, jwt]);
      await diagnostics.register([secret, jwt]);
      diagnostics.stage('ui');
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Otteroom', exact: true })).toBeVisible();
      // SSR text is not proof of hydration. Exercise Router before mutating a
      // synthetic UI fixture, so it cannot introduce a hydration mismatch.
      await page.getByRole('link', { name: 'Open route preview' }).click();
      await expect(page.getByRole('heading', { name: 'Room route preview' })).toBeVisible();
      await page.getByRole('link', { name: 'Back to home' }).click();
      await expect(page.getByRole('heading', { name: 'Otteroom', exact: true })).toBeVisible();
      await page.evaluate(value => {
        const input = document.createElement('input'); input.id = 'synthetic-guard-input'; input.value = value;
        input.style.cssText = 'position:fixed;left:0;top:0;width:250px;height:40px;z-index:9999';
        document.body.append(input);
      }, secret);
      let uiRejected = false;
      try { await diagnostics.assertNoCredentialUi(); } catch { uiRejected = true; }
      const credentialDetected = [...info.annotations].reverse().find(item => item.type === 'safe-ui-result')?.description === 'credential';
      await page.evaluate(() => document.getElementById('synthetic-guard-input')?.remove());
      expect(uiRejected && credentialDetected).toBe(true);
      await diagnostics.assertNoCredentialUi();
      expect(registry.hasCredential(secret) && registry.hasCredential(jwt)).toBe(true);
      const fields = ['access_token', 'ReFrEsH_ToKeN', 'Authorization', 'Cookie', 'Set-Cookie', 'service-role', 'secret_key'];
      for (const field of fields) {
        const text = sanitizeDiagnostic({ message: { [field]: secret, outcome: 'safe' } }, registry.values());
        expect(text.includes(secret)).toBe(false);
      }
      const sanitized = sanitizeDiagnostic('Bearer ' + secret + ' ' + jwt, registry.values());
      expect(sanitized.includes(secret) || sanitized.includes(jwt)).toBe(false);
      const buffer = new DiagnosticBuffer();
      for (let i = 0; i < 30; i++) buffer.add('x'.repeat(4080) + secret, registry.values());
      expect(Buffer.byteLength(buffer.text()) <= 65536 && buffer.overflowed).toBe(true);
      expect(buffer.text().includes(secret)).toBe(false);
      diagnostics.stage('scanner');
      fs.writeFileSync(path.join(directory, 'safe.json'), JSON.stringify({ outcome: 'passed' }));
      expect(scanArtifacts(directory, { registry }).ok).toBe(true);
      // Synthetic-only negative files are isolated from the retained invocation.
      fs.writeFileSync(path.join(directory, 'leak.json'), JSON.stringify({ message: secret, outcome: jwt }));
      const scan = scanArtifacts(directory, { registry });
      expect(!scan.ok && !JSON.stringify(scan).includes(secret) && !JSON.stringify(scan).includes(jwt)).toBe(true);
      const child = spawnSync(process.execPath, ['scripts/check-e2e-artifacts.mjs', directory], { encoding: 'utf8', timeout: 10000, maxBuffer: 65536 });
      expect(!child.error && child.status !== 0 && !(child.stdout + child.stderr).includes(jwt)).toBe(true);
      fs.unlinkSync(path.join(directory, 'leak.json'));
      for (const name of ['trace.zip', 'network.har', 'storage-state.json', 'cookies.json', 'session.json', 'video.webm']) {
        fs.writeFileSync(path.join(directory, name), 'synthetic');
        expect(scanArtifacts(directory, { registry }).ok).toBe(false);
        fs.unlinkSync(path.join(directory, name));
      }
      // A finalized late write is included, not skipped behind an earlier scan.
      await fs.promises.writeFile(path.join(directory, 'late.txt'), secret);
      expect(scanArtifacts(directory, { registry }).ok).toBe(false);
    } finally {
      try { await server.close(); } finally { registry.clear(); fs.rmSync(directory, { recursive: true }); }
    }
    diagnostics.stage('cleanup');
    expect(registry.size === 0 && !fs.existsSync(path.dirname(server.endpoint)) && !fs.existsSync(directory)).toBe(true);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Otteroom', exact: true })).toBeVisible();
    expect(diagnostics.signupAttempts).toBe(0);
  });
});
