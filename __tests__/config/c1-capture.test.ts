/** @jest-environment node */
import { spawnSync } from 'node:child_process';

function verify(body: string) {
  const child = spawnSync(process.execPath, ['--input-type=module'], {
    input: `
      import assert from 'node:assert/strict';
      import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
      import { randomUUID, createHash } from 'node:crypto';
      import { deflateSync } from 'node:zlib';
      import { captureStablePng, inspectUiValues } from './e2e/support/safe-diagnostics.ts';
      import { CredentialRegistry, startRegistryServer, registerCredentials, registerPng } from './e2e/support/credential-registry.ts';
      import { scanArtifacts } from './scripts/check-e2e-artifacts.mjs';
      const stable = { safe: true, epoch: 1, viewport: 'fixed', digest: 'safe-fingerprint' };
      function png() {
        const chunk = (name, body) => {
          const bytes = Buffer.concat([Buffer.from(name), body]); let crc = 0xffffffff;
          for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
          const size = Buffer.alloc(4), sum = Buffer.alloc(4); size.writeUInt32BE(body.length); sum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
          return Buffer.concat([size, bytes, sum]);
        };
        const header = Buffer.alloc(13); header.writeUInt32BE(1, 0); header.writeUInt32BE(1, 4); header[8] = 8; header[9] = 6;
        return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.from([0,255,255,255,255]))), chunk('IEND', Buffer.alloc(0))]);
      }
      ${body}
    `,
    encoding: 'utf8', timeout: 20000, maxBuffer: 65536,
  });
  // Never forward a child assertion diff or a credential-bearing stream.
  expect(child.error === undefined && child.status === 0).toBe(true);
}

describe('bounded credential-safe PNG capture', () => {
  it('accepts stable DOM only after stabilization and two independent pre-capture safety checks', () => verify(`
    const order = [];
    const result = await captureStablePng({
      stabilize: async () => { order.push('quiet'); return true; },
      inspect: async () => { order.push('check'); return stable; },
      screenshot: async () => { order.push('png'); return png(); },
    });
    assert.deepEqual(order, ['quiet','check','check','png','check']);
    assert.equal(result.attempts, 1); assert.equal(result.png.length > 0, true); result.png.fill(0);
  `));

  it('discards every image mutated during capture and fails after exactly three attempts', () => verify(`
    const images = []; let checks = 0, quiet = 0;
    await assert.rejects(captureStablePng({
      stabilize: async () => { quiet++; return true; },
      inspect: async () => ({ ...stable, epoch: ++checks % 3 === 0 ? 2 : 1 }),
      screenshot: async () => { const bytes = png(); images.push(bytes); return bytes; },
    }), /E2E_SAFE_FAILURE/);
    assert.equal(quiet, 3); assert.equal(checks, 9); assert.equal(images.length, 3);
    assert.equal(images.every(bytes => bytes.every(value => value === 0)), true);
  `));

  it('rechecks safety from scratch and succeeds after a rejected image stabilizes', () => verify(`
    let checks = 0, quiet = 0; const images = [];
    const result = await captureStablePng({
      stabilize: async () => { quiet++; return true; },
      inspect: async () => ({ ...stable, epoch: ++checks === 3 ? 2 : 1 }),
      screenshot: async () => { const bytes = png(); images.push(bytes); return bytes; },
    });
    assert.equal(result.attempts, 2); assert.equal(quiet, 2); assert.equal(checks, 6);
    assert.equal(images[0].every(value => value === 0), true);
    assert.equal(result.png === images[1], true); result.png.fill(0);
  `));

  it('continuously mutating DOM exhausts three quiet windows without taking a screenshot', () => verify(`
    let quiet = 0, captured = 0, inspected = 0;
    await assert.rejects(captureStablePng({
      stabilize: async () => { quiet++; return false; },
      inspect: async () => { inspected++; return stable; },
      screenshot: async () => { captured++; return png(); },
    }), /E2E_SAFE_FAILURE/);
    assert.equal(quiet, 3); assert.equal(captured, 0); assert.equal(inspected, 0);
  `));

  it.each([1, 2, 3])('credential at safety check %i aborts without retry or an accepted image', check => verify(`
    const secret = 'synthetic-' + randomUUID(); let checks = 0, quiet = 0; const images = [];
    let error;
    try { await captureStablePng({
      stabilize: async () => { quiet++; return true; },
      inspect: async () => ({ ...stable, safe: inspectUiValues([++checks === ${check} ? secret : 'safe'], [secret]) }),
      screenshot: async () => { const bytes = png(); images.push(bytes); return bytes; },
    }); } catch (failure) { error = failure; }
    assert.equal(error instanceof Error, true); assert.equal(String(error.stack).includes(secret), false);
    assert.equal(quiet, 1); assert.equal(checks, ${check});
    assert.equal(images.every(bytes => bytes.every(value => value === 0)), true);
  `));

  it('a retry persists exactly one authorized PNG; scanner and memory-only registry cleanup still fail closed', () => verify(`
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'otteroom-capture-test-'));
    const registry = new CredentialRegistry(); const server = await startRegistryServer(registry);
    const secret = 'synthetic-' + randomUUID(); let checks = 0; let result;
    try {
      await registerCredentials(server.endpoint, 'test', [secret]);
      result = await captureStablePng({ stabilize: async () => true,
        inspect: async () => ({ ...stable, epoch: ++checks === 3 ? 2 : 1 }), screenshot: async () => png() });
      assert.equal(result.attempts, 2);
      await registerPng(server.endpoint, 'safe-failure.png', createHash('sha256').update(result.png).digest('hex'));
      fs.writeFileSync(path.join(directory, 'safe-failure.png'), result.png, { flag: 'wx' });
      assert.equal(fs.readdirSync(directory).filter(name => name.endsWith('.png')).length, 1);
      assert.equal(scanArtifacts(directory, { registry }).ok, true);
      fs.writeFileSync(path.join(directory, 'synthetic-leak.json'), JSON.stringify({ message: secret }));
      const scan = scanArtifacts(directory, { registry });
      assert.equal(scan.ok, false); assert.equal(JSON.stringify(scan).includes(secret), false);
    } finally { result?.png.fill(0); await server.close(); registry.clear(); fs.rmSync(directory, { recursive: true }); }
    assert.equal(registry.size, 0); assert.equal(fs.existsSync(path.dirname(server.endpoint)), false);
  `));
});

it('ordinary image-bearing UI never grants screenshot eligibility for img, CSS backgrounds or SVG', () => verify(`
  const { SafeDiagnostics } = await import('./e2e/support/safe-diagnostics.ts');
  const registry = new CredentialRegistry(); const server = await startRegistryServer(registry);
  process.env.OTTEROOM_CREDENTIAL_SOCKET = server.endpoint;
  globalThis.window = { __otteroomMutationEpoch: 1 };
  Object.assign(globalThis, { innerWidth: 800, innerHeight: 600, scrollX: 0, scrollY: 0, devicePixelRatio: 1 });
  globalThis.HTMLInputElement = class {}; globalThis.HTMLTextAreaElement = class {}; globalThis.HTMLSelectElement = class {};
  let visual = 'img', secret = 'synthetic-' + randomUUID(), leaked = false;
  const element = { localName: 'img', attributes: [{ value: '/assets/local.png' }],
    matches: () => visual !== 'background', getAnimations: () => [], checkVisibility: () => true,
    getBoundingClientRect: () => ({ width: 240, height: 360, left: 0, top: 0, right: 240, bottom: 360 }) };
  globalThis.getComputedStyle = () => ({ backgroundImage: visual === 'background' ? 'url(/assets/local.png)' : 'none' });
  globalThis.document = { title: 'Ready', body: { get innerText() { return leaked ? secret : 'The Cardboard Comet 2020'; } }, querySelectorAll: () => [element] };
  let captured = 0, closed = 0;
  const page = { evaluate: async fn => fn(), screenshot: async () => { captured++; return png(); } };
  const context = { tracing: {}, request: {}, addInitScript: async () => {}, newPage: async () => page,
    on: () => {}, removeListener: () => {}, route: async () => {}, unrouteAll: async () => {}, close: async () => { closed++; } };
  const d = await SafeDiagnostics.create(context, {}, { title: 'synthetic', annotations: [] });
  try {
    await d.register([secret]);
    for (visual of ['img', 'background', 'svg']) {
      element.localName = visual;
      await d.assertNoCredentialTextUi();
      await assert.rejects(d.assertNoCredentialUi(), /E2E_SAFE_FAILURE/);
      await assert.rejects(page.screenshot(), /E2E_SAFE_FAILURE/);
    }
    leaked = true;
    await assert.rejects(d.assertNoCredentialTextUi(), /E2E_SAFE_FAILURE/);
    leaked = false; element.attributes = [{ value: secret }];
    await assert.rejects(d.assertNoCredentialTextUi(), /E2E_SAFE_FAILURE/);
    element.attributes = [{ value: '€'.repeat(400000) }];
    await assert.rejects(d.assertNoCredentialTextUi(), /E2E_SAFE_FAILURE/);
    element.attributes = Array(20001).fill({ value: 'safe' });
    await assert.rejects(d.assertNoCredentialTextUi(), /E2E_SAFE_FAILURE/);
    element.attributes = []; document.querySelectorAll = () => Array(5001).fill(element);
    await assert.rejects(d.assertNoCredentialTextUi(), /E2E_SAFE_FAILURE/);
    assert.equal(captured, 0);
  } finally { await d.close(); await server.close(); registry.clear(); }
  assert.equal(closed, 1); assert.equal(registry.size, 0);
`));
