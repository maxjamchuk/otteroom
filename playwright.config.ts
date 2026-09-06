import { defineConfig } from '@playwright/test';

// Pinned runner snapshot guard; safe exceptions and the finalized scan are also required.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';

export default defineConfig({
  testDir: './e2e',
  outputDir: process.env.OTTEROOM_E2E_ARTIFACT_DIR,
  reporter: [['./e2e/support/safe-reporter.ts']],
  forbidOnly: true,
  retries: 0,
  repeatEach: 1,
  workers: 1,
  fullyParallel: false,
  timeout: 30000,
  globalTimeout: 180000,
  expect: { timeout: 10000 },
  use: {
    browserName: 'chromium',
    baseURL: process.env.OTTEROOM_E2E_BASE_URL,
    viewport: { width: 1100, height: 800 },
    trace: 'off',
    video: 'off',
    screenshot: 'off',
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'acceptance', testMatch: 'room-session.spec.ts', fullyParallel: true },
    {
      name: 'credential-safety',
      testMatch: 'diagnostics/credential-safety.spec.ts',
      workers: 1,
      fullyParallel: false,
    },
  ],
  webServer: {
    command: 'npm run web:e2e',
    url: 'http://127.0.0.1:8081',
    reuseExistingServer: false,
    timeout: 120000,
    stdout: 'ignore',
    stderr: 'ignore',
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
  },
});
