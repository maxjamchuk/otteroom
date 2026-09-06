import fs from 'node:fs';
import path from 'node:path';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { sanitizeDiagnostic } from './sanitize-diagnostics.ts';

type SafeInput = {
  status?: unknown;
  error?: { message?: unknown };
  annotations?: { type: string; description?: string }[];
  errorCount?: number;
  [key: string]: unknown;
};

function scenarioFor(title: unknown): string {
  if (typeof title !== 'string') return 'unclassified';
  if (title.startsWith('@baseline ')) return 'baseline';
  if (title.startsWith('@auth ')) return 'auth';
  if (title.startsWith('@us1 E01 ')) return 'us1';
  if (/^@us2-join E(?:02|04|10|11) /.test(title)) return 'us2-join';
  if (/^@capacity-smoke E(?:05|12) /.test(title)) return 'capacity-smoke';
  if (title.startsWith('@diagnostics-static A ')) return 'A';
  if (title.startsWith('@diagnostics-static B ')) return 'B';
  if (title.startsWith('@credential-probe C ')) return 'C';
  return 'unclassified';
}

export function safeResult(test: { title?: unknown; expectedStatus?: unknown }, result: SafeInput) {
  const errorMessage = typeof result.error?.message === 'string'
    ? result.error.message.replace(/\u001b\[[0-9;]*m/g, '') : '';
  const controlled = test.expectedStatus === 'passed' && result.errorCount === 1 &&
    /^(?:Error: )?CONTROLLED_AUTH_DIAGNOSTIC_FAILURE$/.test(errorMessage);
  const status = ['passed', 'failed', 'timedOut', 'interrupted', 'skipped'].includes(String(result.status))
    ? String(result.status) : 'failed';
  const receipt = (name: string, expected: string) =>
    result.annotations?.some(item => item.type === name && item.description === expected) === true;
  const count = (name: string) => (result.annotations ?? []).filter(item => item.type === name && /^[0-9]{1,2}$/.test(item.description ?? ''))
    .reduce((sum, item) => sum + Number(item.description), 0);
  return {
    scenario: scenarioFor(test.title),
    context: receipt('safe-context-label', 'primary') ? 'primary' : 'none',
    status,
    category: controlled
      ? 'CONTROLLED_AUTH_DIAGNOSTIC_FAILURE' : status === 'passed' ? 'PASS' : 'E2E_FAILURE',
    cleanup: receipt('safe-context-cleanup', 'complete'),
    authSuccess: receipt('safe-auth-success', 'confirmed'),
    signups: count('safe-signups'),
    identities: count('safe-identities'),
    budgetFailure: receipt('safe-auth-budget', 'exhausted'),
    capture: [...(result.annotations ?? [])].reverse().find(item => item.type === 'safe-capture-result' &&
      ['stabilizing', 'unstable-dom', 'unsafe-ui', 'changed-dom', 'changed-viewport', 'changed-values', 'invalid-png', 'verified'].includes(item.description ?? ''))?.description ?? 'none',
    captureAttempts: Math.max(0, ...(result.annotations ?? []).filter(item => item.type === 'safe-capture-attempt' && /^[1-3]$/.test(item.description ?? '')).map(item => Number(item.description))),
    artifactsComplete: receipt('safe-artifacts', 'complete'),
    stage: ['cleanup', 'scanner', 'sanitizer', 'ui', 'capture-guards', 'config'].find(value => receipt('safe-stage', value)) ?? 'none',
    ui: [...(result.annotations ?? [])].reverse().find(item => item.type === 'safe-ui-result' && ['safe', 'incomplete', 'credential'].includes(item.description ?? ''))?.description ?? 'none',
    uiReason: [...(result.annotations ?? [])].reverse().find(item => item.type === 'safe-ui-reason' && ['safe', 'inspection-bound', 'nontext-visual', 'canvas', 'iframe', 'img', 'svg', 'object', 'embed', 'background-image', 'animation'].includes(item.description ?? ''))?.description ?? 'none',
    location: typeof result.error?.message === 'string' ?
      result.error.message.match(/E2E_SAFE_FAILURE at (e2e\/(?:diagnostics\/credential-safety\.spec|room-session\.spec|support\/safe-diagnostics)\.ts:\d{1,5}:\d{1,5})/)?.[1] ?? 'none' : 'none',
  };
}

export default class SafeReporter implements Reporter {
  #results: ReturnType<typeof safeResult>[] = [];
  #runnerFailed = false;
  #directory: string | undefined;

  onBegin(): void {
    const directory = process.env.OTTEROOM_E2E_ARTIFACT_DIR;
    if (!directory || !path.isAbsolute(directory)) {
      throw new Error('SAFE_CONTROLLER_REQUIRED');
    }
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.#directory = directory;
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    if (this.#results.length >= 256) { this.#runnerFailed = true; return; }
    this.#results.push(safeResult(test, {
      status: result.status,
      error: result.error ? { message: result.error.message } : undefined,
      errorCount: result.errors.length,
      annotations: result.annotations,
    }));
  }
  onStdOut(): void { /* Unclassified process/test output is intentionally suppressed. */ }
  onStdErr(): void { /* No raw worker streams are forwarded or attached. */ }
  onError(): void { this.#runnerFailed = true; }

  onEnd(): void {
    // A loader/config error may prevent onBegin. Never fall back to repository CWD.
    if (!this.#directory) return;
    if (this.#runnerFailed) this.#results.push({
      scenario: 'runner', context: 'none', status: 'failed', category: 'E2E_FAILURE',
      cleanup: false, authSuccess: false, signups: 0, identities: 0, budgetFailure: false, capture: 'none', captureAttempts: 0, artifactsComplete: false, location: 'none', stage: 'none', ui: 'none', uiReason: 'none',
    });
    // Every field was projected to fixed vocabulary above; never serialize TestResult.
    const summary = JSON.stringify(this.#results);
    if (Buffer.byteLength(summary) > 65536) throw new Error('SAFE_REPORT_BOUND');
    fs.mkdirSync(this.#directory, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(this.#directory, 'summary.json'), summary + '\n', { flag: 'wx', mode: 0o600 });
    process.stdout.write(sanitizeDiagnostic({ component: 'playwright', status: this.#runnerFailed ? 'failed' : 'finished' }) + '\n');
  }
}
