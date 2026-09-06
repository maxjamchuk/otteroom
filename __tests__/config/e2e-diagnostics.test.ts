/** @jest-environment node */
import { spawnSync } from 'node:child_process';

// Exercise the very same native-TypeScript/ESM modules as the Node controller.
// Only runtime synthetic values enter the isolated child; never print its raw output.
function verify(source: string) {
  const result = spawnSync(process.execPath, ['--input-type=module'], {
    cwd: process.cwd(),
    input: source,
    encoding: 'utf8',
    timeout: 20000,
    maxBuffer: 131072,
  });
  expect(result.error === undefined).toBe(true);
  expect(result.status).toBe(0);
}

const prelude = `
  import assert from 'node:assert/strict';
  import { randomUUID } from 'node:crypto';
  import fs from 'node:fs';
  import os from 'node:os';
  import path from 'node:path';
  const sentinel = () => 'synthetic-' + randomUUID();
`;

describe('credential-safe diagnostics boundaries', () => {
  it('registers real-shape Auth responses before delivery, counts only signups and fails closed on 429 or excess attempts', () => verify(prelude + `
    const { SafeDiagnostics } = await import('./e2e/support/safe-diagnostics.ts');
    const { CredentialRegistry, startRegistryServer } = await import('./e2e/support/credential-registry.ts');
    for (const status of [200, 429]) {
      const registry = new CredentialRegistry(); const server = await startRegistryServer(registry);
      process.env.OTTEROOM_CREDENTIAL_SOCKET = server.endpoint;
      const events = new Map(); let intercept, delivered = 0, aborted = 0, closed = 0;
      const page = { screenshot: async () => Buffer.alloc(0), pdf: async () => Buffer.alloc(0) };
      const context = { tracing: {}, request: {}, addInitScript: async () => {}, newPage: async () => page,
        on: (name, callback) => events.set(name, callback), removeListener: name => events.delete(name),
        route: async (_, handler) => { intercept = handler; }, unrouteAll: async () => {}, close: async () => { closed++; } };
      const info = { title: 'synthetic', annotations: [] };
      const d = await SafeDiagnostics.create(context, {}, info); d.allowAnonymousSignups(1);
      const access = sentinel(), refresh = sentinel();
      const request = { url: () => 'http://127.0.0.1:55321/auth/v1/signup', allHeaders: async () => ({}) };
      const response = { status: () => status, ok: () => status === 200, dispose: async () => {},
        body: async () => Buffer.from(JSON.stringify({ access_token: access, refresh_token: refresh, user: { id: 'synthetic', is_anonymous: true } })) };
      const route = { request: () => request, fetch: async options => { assert.equal(options.maxRetries, 0); return response; },
        fulfill: async () => { assert.equal(registry.hasCredential(access) && registry.hasCredential(refresh), true); delivered++; },
        abort: async () => { aborted++; } };
      try {
        events.get('request')(request); await intercept(route);
        if (status === 200) {
          await d.assertAuthAccounting(1, 1); assert.equal(delivered, 1);
          events.get('request')(request); await intercept(route);
          await assert.rejects(d.flush()); assert.equal(delivered, 1);
        } else {
          await assert.rejects(d.flush()); assert.equal(delivered, 0);
          assert.equal(info.annotations.some(x => x.type === 'safe-auth-budget'), true);
        }
        assert.equal(aborted, 1); assert.equal(JSON.stringify(info).includes(access), false);
      } finally {
        await d.close().catch(() => {}); await server.close(); registry.clear();
      }
      assert.equal(closed, 1); assert.equal(events.size, 0);
    }
  `));

  it('requires actual finalized probe artifact categories, not merely a success receipt', () => verify(prelude + `
    const { verifyProbeArtifacts } = await import('./scripts/run-e2e.mjs');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'otteroom-probe-artifacts-'));
    try {
      assert.equal(verifyProbeArtifacts(dir), false);
      for (const name of ['summary.json', 'safe-failure.png', 'safe-diagnostics.txt', 'error-context.md', 'safe-process.txt']) fs.writeFileSync(path.join(dir, name), 'synthetic');
      assert.equal(verifyProbeArtifacts(dir), true);
      fs.unlinkSync(path.join(dir, 'error-context.md'));
      assert.equal(verifyProbeArtifacts(dir), false);
    } finally { fs.rmSync(dir, { recursive: true }); }
  `));

  it('redacts known values, case-insensitive fields, bearer/JWT and secret-key shapes', () => verify(prelude + `
    const { sanitizeDiagnostic, containsCredential } = await import('./e2e/support/sanitize-diagnostics.ts');
    const values = Array.from({ length: 10 }, sentinel);
    const jwt = ['eyJ' + randomUUID().replaceAll('-', ''), randomUUID().replaceAll('-', ''), randomUUID().replaceAll('-', '')].join('.');
    const fields = ['access_token', 'ReFrEsH_ToKeN', 'Authorization', 'Cookie', 'Set-Cookie', 'service-role', 'secret_key', 'database_password'];
    for (const [i, field] of fields.entries()) {
      const structured = sanitizeDiagnostic({ message: { [field]: values[i], outcome: 'ok' } });
      const text = sanitizeDiagnostic(field + ': ' + values[i]);
      assert.equal(structured.includes(values[i]), false);
      assert.equal(text.includes(values[i]), false);
    }
    const input = 'Bearer ' + values[8] + ' ' + jwt + ' sb_secret_' + values[9].replaceAll('-', '');
    const output = sanitizeDiagnostic(input, values);
    assert.equal(values.some(v => output.includes(v)), false);
    assert.equal(output.includes(jwt), false);
    assert.equal(containsCredential(jwt), true);
    assert.equal(containsCredential(output, values), false);
    assert.equal(sanitizeDiagnostic('route ready').includes('route ready'), true);
    assert.equal(sanitizeDiagnostic({ unknown: values[0], status: 200 }).includes(values[0]), false);
    const known = (function* () { yield values[0]; })();
    assert.equal(sanitizeDiagnostic({ message: values[0], outcome: values[0] }, known).includes(values[0]), false);
  `));

  it('bounds and fails closed on oversized, cyclic and unsupported diagnostic objects', () => verify(prelude + `
    const { sanitizeDiagnostic, DiagnosticBuffer } = await import('./e2e/support/sanitize-diagnostics.ts');
    const secret = sentinel();
    const output = sanitizeDiagnostic('x'.repeat(4090) + secret, [secret]);
    assert.equal(Buffer.byteLength(output) <= 4096, true);
    assert.equal(output.includes(secret.slice(0, 4)), false);
    const cycle = {}; cycle.message = cycle;
    for (const value of [cycle, { message: () => secret }, { message: 'x'.repeat(1048577) }]) {
      const safe = sanitizeDiagnostic(value);
      assert.equal(safe.includes(secret), false);
      assert.equal(safe.includes('REDACTED'), true);
    }
    const buffer = new DiagnosticBuffer();
    for (let i = 0; i < 100; i++) buffer.add('x'.repeat(4096));
    assert.equal(Buffer.byteLength(buffer.text()) <= 65536, true);
    assert.equal(buffer.overflowed, true);
  `));

  it('uses private acknowledged memory-only registration and retains values through context close', () => verify(prelude + `
    const { CredentialRegistry, startRegistryServer, registerCredentials } = await import('./e2e/support/credential-registry.ts');
    const registry = new CredentialRegistry();
    const server = await startRegistryServer(registry);
    const a = sentinel(), b = sentinel();
    try {
      assert.equal(fs.statSync(path.dirname(server.endpoint)).mode & 511, 448);
      await Promise.all([registerCredentials(server.endpoint, 'context-a', [a]), registerCredentials(server.endpoint, 'context-b', [b])]);
      assert.equal(registry.hasCredential(a), true);
      assert.equal(registry.hasCredential(b), true);
      registry.closeContext('context-a');
      assert.equal(registry.hasCredential(a), true);
      assert.throws(() => JSON.stringify(registry));
    } finally { await server.close(); registry.clear(); }
    assert.equal(registry.size, 0);
    assert.equal(fs.existsSync(path.dirname(server.endpoint)), false);
    await assert.rejects(registerCredentials(server.endpoint, 'context-a', [a]));
  `));

  it('recursively scans decoded JSON, rejects forbidden artifacts and never prints detected values', () => verify(prelude + `
    const { CredentialRegistry } = await import('./e2e/support/credential-registry.ts');
    const { scanArtifacts } = await import('./scripts/check-e2e-artifacts.mjs');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'otteroom-scanner-test-'));
    const registry = new CredentialRegistry(); const secret = sentinel(); registry.register('test', [secret]);
    try {
      fs.mkdirSync(path.join(dir, 'nested'));
      fs.writeFileSync(path.join(dir, 'nested/safe.json'), JSON.stringify({ outcome: 'passed' }));
      assert.equal(scanArtifacts(dir, { registry }).ok, true);
      fs.writeFileSync(path.join(dir, 'nested/leak.json'), JSON.stringify(secret).replaceAll('-', '\\u002d'));
      let result = scanArtifacts(dir, { registry });
      assert.equal(result.ok, false);
      assert.equal(JSON.stringify(result).includes(secret), false);
      fs.unlinkSync(path.join(dir, 'nested/leak.json'));
      for (const filename of ['trace.zip', 'network.har', 'storage-state.json', 'cookies.json', 'session.json', 'video.webm', 'unknown.bin']) {
        const file = path.join(dir, filename); fs.writeFileSync(file, 'safe');
        assert.equal(scanArtifacts(dir, { registry }).ok, false); fs.unlinkSync(file);
      }
      fs.writeFileSync(path.join(dir, 'large.txt'), 'x'.repeat(1100000) + secret);
      assert.equal(scanArtifacts(dir, { registry }).ok, false);
    } finally { registry.clear(); fs.rmSync(dir, { recursive: true }); }
  `));

  it('fails scanner CLI safely for missing, unreadable, escaping and synthetic-leaking inputs', () => verify(prelude + `
    const { scanArtifacts } = await import('./scripts/check-e2e-artifacts.mjs');
    const { spawnSync } = await import('node:child_process');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'otteroom-scanner-negative-'));
    const jwt = ['eyJ' + randomUUID().replaceAll('-', ''), randomUUID().replaceAll('-', ''), randomUUID().replaceAll('-', '')].join('.');
    try {
      assert.equal(scanArtifacts(path.join(dir, 'absent')).ok, false);
      fs.symlinkSync('/etc/hosts', path.join(dir, 'escape.txt'));
      assert.equal(scanArtifacts(dir).ok, false); fs.unlinkSync(path.join(dir, 'escape.txt'));
      fs.writeFileSync(path.join(dir, 'unreadable.txt'), 'safe', { mode: 0 });
      assert.equal(scanArtifacts(dir).ok, false); fs.chmodSync(path.join(dir, 'unreadable.txt'), 384); fs.unlinkSync(path.join(dir, 'unreadable.txt'));
      fs.writeFileSync(path.join(dir, 'leak.json'), JSON.stringify({ message: jwt }));
      const result = spawnSync(process.execPath, ['scripts/check-e2e-artifacts.mjs', dir], { encoding: 'utf8' });
      assert.equal(result.status !== 0, true);
      assert.equal((result.stdout + result.stderr).includes(jwt), false);
    } finally { fs.rmSync(dir, { recursive: true }); }
  `));

  it('safe reporter drops raw fields, stdout, attachments and error causes', () => verify(prelude + `
    const { safeResult } = await import('./e2e/support/safe-reporter.ts');
    for (const [title, expected] of [['@us2-join E02 link', 'us2-join'], ['@us2-realtime E03 binding', 'us2-realtime'], ['@us4 E07 reload', 'us4'], ['@capacity-smoke E12 isolation', 'capacity-smoke'], ['@us3 E05 capacity', 'us3'], ['@us3 E06 race', 'us3'], ['@us3 E12 isolation', 'us3'], ['@us3 E13 unknown', 'unclassified']]) {
      assert.equal(safeResult({ title }, { status: 'passed' }).scenario, expected);
    }
    const secret = sentinel();
    const result = safeResult({ title: secret }, { status: 'failed', error: { message: secret, cause: secret }, stdout: [secret], attachments: [{ body: secret }] });
    for (const [title, label] of [['@us3 E05 capacity', 'E05'], ['@us3 E06 race', 'E06'], ['@us3 E12 known-ID read', 'E12-read'], ['@us3 E12 live subscription', 'E12-subscription'], ['@us3 E12 delayed response', 'E12-navigation'], ['@us3 E12 direct write', 'E12-mutation']]) {
      for (let repeatEachIndex = 0; repeatEachIndex < 3; repeatEachIndex++) {
        const projected = safeResult({ title, repeatEachIndex }, { status: 'passed' });
        assert.equal(projected.browserCase, label); assert.equal(projected.repetition, repeatEachIndex + 1);
      }
    }
    assert.equal(safeResult({ title: secret, repeatEachIndex: secret }, {}).browserCase, 'none');
    assert.equal(safeResult({ repeatEachIndex: 3 }, {}).repetition, 0);
    assert.equal(JSON.stringify(result).includes(secret), false);
    assert.equal(result.status, 'failed');
    assert.equal(Object.hasOwn(result, 'attachments'), false);
    const controlled = { status: 'failed', error: { message: 'Error: CONTROLLED_AUTH_DIAGNOSTIC_FAILURE' }, errorCount: 1 };
    const probe = { title: '@credential-probe C synthetic classification only', expectedStatus: 'passed' };
    assert.equal(safeResult(probe, controlled).category, 'CONTROLLED_AUTH_DIAGNOSTIC_FAILURE');
    assert.equal(safeResult(probe, { ...controlled, errorCount: 2 }).category, 'E2E_FAILURE');
    assert.equal(safeResult({ ...probe, expectedStatus: 'failed' }, controlled).category, 'E2E_FAILURE');
  `));

  it('safe process drains split secret output and preserves child failures and shutdown', () => verify(prelude + `
    const { runManagedProcess, operationSpec } = await import('./scripts/safe-process.mjs');
    const secret = sentinel(), logs = [];
    const code = 'process.stdout.write(' + JSON.stringify(secret.slice(0, 12)) + '); process.stderr.write(' + JSON.stringify(secret.slice(12)) + '); process.exitCode=7;';
    const result = await runManagedProcess({ command: process.execPath, args: ['--input-type=module'], input: code, label: 'fixture', onStatus: value => logs.push(value) });
    assert.equal(result, 7);
    assert.equal(JSON.stringify(logs).includes(secret), false);
    const abort = new AbortController();
    const pending = runManagedProcess({ command: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'], label: 'fixture', signal: abort.signal });
    abort.abort(); assert.equal(await pending !== 0, true);
    assert.deepEqual(operationSpec('web:e2e').args, ['start', '--web', '--port', '8081']);
    assert.throws(() => operationSpec('arbitrary-command'));
  `));

  it('safe context options and exception/UI boundaries reject capture before it happens', () => verify(prelude + `
    const { validateContextOptions, safeError, inspectUiValues, requireStableCapture } = await import('./e2e/support/safe-diagnostics.ts');
    const secret = sentinel();
    validateContextOptions({ baseURL: 'http://127.0.0.1:8081' });
    for (const options of [{ recordHar: { path: 'a.har' } }, { recordVideo: { dir: 'video' } }, { storageState: {} }]) assert.throws(() => validateContextOptions(options));
    const error = safeError(new Error(secret, { cause: secret }));
    assert.equal(String(error.stack).includes(secret), false);
    assert.equal(Object.hasOwn(error, 'cause'), false);
    assert.equal(inspectUiValues(['safe', secret], [secret]), false);
    assert.equal(inspectUiValues(['safe'], [secret]), true);
    assert.throws(() => requireStableCapture(false, true));
    assert.throws(() => requireStableCapture(true, false));
  `));

  it('safe fixture closes its context and observers even when registration fails', () => verify(prelude + `
    const { SafeDiagnostics } = await import('./e2e/support/safe-diagnostics.ts');
    let closes = 0; const events = new Set();
    const page = { screenshot: async () => Buffer.alloc(0), pdf: async () => Buffer.alloc(0) };
    const context = {
      tracing: {}, request: {}, storageState: async () => ({}), addInitScript: async () => {}, newPage: async () => page,
      route: async () => {}, unrouteAll: async () => {},
      on: name => events.add(name), removeListener: name => events.delete(name), close: async () => { closes++; },
    };
    const diagnostics = await SafeDiagnostics.create(context, {}, { title: 'synthetic', annotations: [] });
    await assert.rejects(diagnostics.register([sentinel()]));
    await assert.rejects(diagnostics.close());
    assert.equal(closes, 1); assert.equal(events.size, 0);
    await diagnostics.close(); assert.equal(closes, 1);
    await assert.rejects(page.screenshot());
  `));

  it('controller rejects unsafe overrides and distinguishes exact controlled failure from unexpected exits', () => verify(prelude + `
    const { parseInvocation, assessRun } = await import('./scripts/run-e2e.mjs');
    assert.equal(parseInvocation(['security', '--grep', '@diagnostics-static']).staticOnly, true);
    for (const args of [['acceptance', '--trace', 'on'], ['acceptance', '--ui'], ['acceptance', '--reporter=json'], ['acceptance', '--output=/tmp/raw'], ['security', '--workers=2'], ['security', '--repeat-each=2']]) assert.throws(() => parseInvocation(args));
    const checks = [{ scenario: 'A', status: 'passed' }, { scenario: 'B', status: 'passed' }];
    const c = { scenario: 'C', status: 'failed', category: 'CONTROLLED_AUTH_DIAGNOSTIC_FAILURE', authSuccess: true, signups: 1, cleanup: true, artifactsComplete: true };
    assert.equal(assessRun('security', false, 1, [...checks, c], true), true);
    for (const changed of [{ category: 'UNEXPECTED_FAILURE' }, { signups: 2 }, { authSuccess: false }, { cleanup: false }, { artifactsComplete: false }]) assert.equal(assessRun('security', false, 1, [...checks, { ...c, ...changed }], true), false);
    assert.equal(assessRun('security', false, 0, checks, true), false);
    assert.equal(assessRun('security', false, 1, [...checks, c], false), false);
    assert.equal(assessRun('acceptance', false, 1, checks, true), false);
    assert.equal(assessRun('security', true, 0, checks, true), true);
  `));

  it('controller scans finalized late output and always clears credentials and private IPC', () => verify(prelude + `
    const { parseInvocation, executeInvocation } = await import('./scripts/run-e2e.mjs');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'otteroom-controller-test-'));
    let endpoint, liveRegistry;
    const checks = [{ scenario: 'A', status: 'passed' }, { scenario: 'B', status: 'passed' }];
    try {
      const outcome = await executeInvocation(parseInvocation(['security', '--grep', '@diagnostics-static']), {
        artifactRoot: root, runtime: run => run({ kind: 'native' }),
        launch: async ({ directory, registry, socket }) => {
          endpoint = socket; liveRegistry = registry;
          const secret = sentinel(); registry.register('synthetic', [secret]);
          fs.writeFileSync(path.join(directory, 'summary.json'), JSON.stringify(checks));
          await new Promise(resolve => setTimeout(resolve, 10));
          fs.writeFileSync(path.join(directory, 'late.txt'), secret);
          return 0;
        },
      });
      assert.equal(outcome, 1);
      assert.equal(liveRegistry.size, 0);
      assert.equal(fs.existsSync(path.dirname(endpoint)), false);
      const failure = await executeInvocation(parseInvocation(['acceptance']), {
        artifactRoot: root, runtime: run => run({ kind: 'native' }), launch: async ({ socket, registry }) => { endpoint = socket; liveRegistry = registry; throw Error('fixture failure'); },
      });
      assert.equal(failure, 1);
      assert.equal(liveRegistry.size, 0);
      assert.equal(fs.existsSync(path.dirname(endpoint)), false);
    } finally { fs.rmSync(root, { recursive: true }); }
  `));
});
