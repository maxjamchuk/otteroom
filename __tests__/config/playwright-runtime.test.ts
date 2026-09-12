/** @jest-environment node */
import { spawnSync } from 'node:child_process';

function verify(source: string) {
  const result = spawnSync(process.execPath, ['--input-type=module'], {
    input: source, encoding: 'utf8', timeout: 20000, maxBuffer: 131072,
  });
  // Never forward arbitrary child diagnostics, including synthetic secrets.
  expect(result.error === undefined).toBe(true);
  expect(result.status).toBe(0);
}

const prelude = `
  import assert from 'node:assert/strict';
  import { selectRuntime, PLAYWRIGHT_IMAGE, prepareRuntime, withPlaywrightRuntime,
    waitForServer, probeWebSocket, runtimeEnvironment, browserConnection,
    RuntimeError, runtimeDiagnostic } from './scripts/playwright-runtime.mjs';
  function fakeDocker({ fail = '', code = 1 } = {}) {
    const calls = []; let exists = false;
    const docker = async (args, options = {}) => {
      calls.push({ args, options });
      if (args[0] === 'create') exists = true;
      if (args[0] === fail) return { code, output: '' };
      if (args[0] === 'rm') exists = false;
      return { code: 0, output: args[0] === 'inspect' ? '43123\\n' : args[0] === 'ps' && exists ? 'abcdef123456\\n' : '' };
    };
    return { docker, calls, exists: () => exists };
  }
`;

describe('repository-owned Playwright runtime', () => {
  it('selects native only for officially supported systems and Docker for AlmaLinux/other Linux', () => verify(prelude + `
    for (const arch of ['x64', 'arm64']) {
      for (const release of ['ID=ubuntu\\nVERSION_ID="22.04"', 'ID=ubuntu\\nVERSION_ID=24.04', 'ID=ubuntu\\nVERSION_ID=26.04', 'ID=debian\\nVERSION_ID=12', 'ID=debian\\nVERSION_ID=13.1']) {
        assert.equal(selectRuntime({ platform: 'linux', arch, osRelease: release }), 'native');
      }
      for (const release of ['ID=almalinux\\nVERSION_ID=10.1', 'ID=fedora\\nID_LIKE=ubuntu', 'ID=ubuntu\\nVERSION_ID=20.04', 'ID=alpine', '']) {
        assert.equal(selectRuntime({ platform: 'linux', arch, osRelease: release }), 'docker');
      }
      assert.equal(selectRuntime({ platform: 'darwin', arch, release: '23.0.0' }), 'native');
      assert.equal(selectRuntime({ platform: 'win32', arch, release: '10.0.22631', version: 'Windows 11' }), 'native');
      assert.equal(selectRuntime({ platform: 'win32', arch, release: '10.0.17763', version: 'Windows Server 2019' }), 'native');
    }
    assert.throws(() => selectRuntime({ platform: 'darwin', release: '22.0.0' }), /UNSUPPORTED_PLATFORM/);
    assert.throws(() => selectRuntime({ platform: 'win32', release: '10.0.19045', version: 'Windows 10' }), /UNSUPPORTED_PLATFORM/);
    assert.throws(() => selectRuntime({ platform: 'linux', arch: 'ia32' }), /UNSUPPORTED_PLATFORM/);
  `));

  it('prepares only pinned Docker on unsupported Linux, and only native Chromium on supported OS', () => verify(prelude + `
    assert.equal(PLAYWRIGHT_IMAGE, 'mcr.microsoft.com/playwright:v1.63.0-noble');
    const fake = fakeDocker(); let native = 0;
    const nativeInstall = async () => { native++; return 0; };
    assert.equal(await prepareRuntime({ kind: 'docker', docker: fake.docker, nativeInstall }), 0);
    assert.equal(native, 0);
    assert.deepEqual(fake.calls.map(c => c.args[0]), ['version', 'pull']);
    assert.deepEqual(fake.calls[1].args, ['pull', PLAYWRIGHT_IMAGE]);
    fake.calls.length = 0;
    assert.equal(await prepareRuntime({ kind: 'native', docker: fake.docker, nativeInstall }), 0);
    assert.equal(native, 1); assert.equal(fake.calls.length, 0);
  `));

  it('fails actionably without Docker or an image and never falls back to native', () => verify(prelude + `
    const fake = fakeDocker({ fail: 'version' }); let runs = 0;
    await assert.rejects(withPlaywrightRuntime(async () => { runs++; }, { kind: 'docker', docker: fake.docker }), /DOCKER_UNAVAILABLE/);
    await assert.rejects(prepareRuntime({ kind: 'docker', docker: fake.docker }), /DOCKER_UNAVAILABLE/);
    assert.equal(runs, 0);
    assert.equal(runtimeDiagnostic(new RuntimeError('DOCKER_UNAVAILABLE')).includes('npm run playwright:install'), true);
    const missing = fakeDocker({ fail: 'image' });
    await assert.rejects(withPlaywrightRuntime(async () => {}, { kind: 'docker', docker: missing.docker }), /DOCKER_IMAGE_MISSING/);
    assert.equal(missing.calls.some(c => c.args[0] === 'create'), false);
  `));

  it('waits for readiness before tests and preserves exit codes while always stopping/removing only its container', () => verify(prelude + `
    for (const exit of [0, 1, 7]) {
      const fake = fakeDocker(), events = [], logs = [];
      const result = await withPlaywrightRuntime(async runtime => {
        events.push('test'); assert.equal(runtime.endpoint, 'ws://127.0.0.1:43123/'); return exit;
      }, { kind: 'docker', docker: fake.docker, onStatus: message => logs.push(message), ready: async () => { events.push('ready'); } });
      assert.equal(result, exit); assert.deepEqual(events, ['ready', 'test']);
      assert.equal(fake.exists(), false);
      const create = fake.calls.find(c => c.args[0] === 'create').args;
      for (const flag of [PLAYWRIGHT_IMAGE, 'playwright@1.63.0', '--log-driver=none', '--add-host=hostmachine:host-gateway', '127.0.0.1::3000', '--init']) assert.equal(create.includes(flag), true);
      assert.equal(create.includes('--privileged') || create.includes('--volume'), false);
      const stops = fake.calls.filter(c => ['stop', 'rm'].includes(c.args[0]));
      assert.equal(stops.length, 2); assert.equal(stops.every(c => c.args.at(-1) === 'abcdef123456'), true);
      assert.equal(logs.some(s => JSON.parse(s).status === 'removed'), true);
    }
  `));

  it('cleans partial startup, readiness timeout, and thrown test failures', () => verify(prelude + `
    for (const fail of ['create', 'start', 'inspect', 'ready', 'test']) {
      const fake = fakeDocker({ fail }); let testRuns = 0;
      await assert.rejects(withPlaywrightRuntime(async () => { testRuns++; throw Error('test'); }, {
        kind: 'docker', docker: fake.docker, onStatus: () => {},
        ready: async () => { if (fail === 'ready') throw new RuntimeError('DOCKER_NOT_READY'); },
      }));
      assert.equal(fake.exists(), false);
      assert.equal(testRuns, fail === 'test' ? 1 : 0);
      assert.equal(fake.calls.some(c => c.args[0] === 'rm'), true);
    }
  `));

  it.each(['SIGINT', 'SIGTERM'])('cleans and preserves %s during readiness and test execution', signal => verify(prelude + `
    for (const stage of ['ready', 'test']) {
      const fake = fakeDocker(), abort = new AbortController();
      const result = await withPlaywrightRuntime(async () => { abort.abort('${signal}'); return 0; }, {
        kind: 'docker', docker: fake.docker, signal: abort.signal, onStatus: () => {},
        ready: async () => { if (stage === 'ready') abort.abort('${signal}'); },
      });
      assert.equal(result, ${signal === 'SIGINT' ? 130 : 143}); assert.equal(fake.exists(), false);
      assert.equal(fake.calls.filter(c => ['stop', 'rm'].includes(c.args[0])).every(c => !c.options.signal), true);
    }
  `));

  it('fails cleanup explicitly and preserves unrelated-container ownership boundaries', () => verify(prelude + `
    const fake = fakeDocker({ fail: 'rm' });
    await assert.rejects(withPlaywrightRuntime(async () => 0, { kind: 'docker', docker: fake.docker, ready: async () => {}, onStatus: () => {} }), /DOCKER_CLEANUP_FAILED/);
    const queries = fake.calls.filter(c => c.args[0] === 'ps');
    assert.equal(queries.every(c => /^label=com.otteroom.playwright.owner=[a-f0-9-]+$/.test(c.args.at(-1))), true);
    assert.equal(fake.calls.some(c => c.args.includes('prune')), false);
  `));

  it('uses an actual WebSocket upgrade probe and bounded retry/timeout/abort readiness', () => verify(prelude + `
    const { createServer } = await import('node:http');
    const { createHash } = await import('node:crypto');
    const server = createServer(); const sockets = new Set();
    server.on('upgrade', (request, socket) => {
      sockets.add(socket); socket.on('close', () => sockets.delete(socket));
      const accept = createHash('sha1').update(request.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
      socket.write('HTTP/1.1 101 Switching Protocols\\r\\nUpgrade: websocket\\r\\nConnection: Upgrade\\r\\nSec-WebSocket-Accept: ' + accept + '\\r\\n\\r\\n');
      socket.on('data', () => socket.end());
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try { assert.equal(await probeWebSocket('ws://127.0.0.1:' + server.address().port + '/'), true); }
    finally { for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); }
    let probes = 0;
    await waitForServer('ws://127.0.0.1:1/', { probe: async () => ++probes === 3, intervalMs: 1, timeoutMs: 100 });
    assert.equal(probes, 3);
    await assert.rejects(waitForServer('ws://127.0.0.1:1/', { probe: async () => false, intervalMs: 1, timeoutMs: 5 }), /DOCKER_NOT_READY/);
    const abort = new AbortController(); abort.abort('SIGTERM');
    await assert.rejects(waitForServer('ws://127.0.0.1:1/', { signal: abort.signal }), /DOCKER_NOT_READY/);
  `));

  it('does not inject library or temporary browser paths, and owns the endpoint and base URL', () => verify(prelude + `
    const source = { PATH: '/usr/bin', LD_LIBRARY_PATH: 'synthetic-unsafe', LD_PRELOAD: 'synthetic-unsafe', NODE_OPTIONS: 'synthetic-unsafe',
      PLAYWRIGHT_BROWSERS_PATH: 'synthetic-unsafe', PW_TEST_CONNECT_WS_ENDPOINT: 'ws://untrusted/', DEBUG: '*', OTTEROOM_E2E_BASE_URL: 'http://untrusted/' };
    const native = runtimeEnvironment({ kind: 'native' }, source);
    const docker = runtimeEnvironment({ kind: 'docker', endpoint: 'ws://127.0.0.1:43123/' }, source);
    for (const env of [native, docker]) {
      assert.equal(Object.hasOwn(env, 'LD_LIBRARY_PATH'), false);
      assert.equal(Object.hasOwn(env, 'PLAYWRIGHT_BROWSERS_PATH'), false);
      assert.equal(JSON.stringify(env).includes('/tmp/'), false);
      assert.equal(JSON.stringify(env).includes('synthetic-unsafe'), false);
      assert.equal(env.PATH, '/usr/bin');
    }
    assert.equal(browserConnection(native), undefined);
    assert.deepEqual(browserConnection(docker), { wsEndpoint: 'ws://127.0.0.1:43123/', exposeNetwork: '<loopback>', timeout: 30000 });
    assert.equal(docker.OTTEROOM_E2E_BASE_URL, 'http://127.0.0.1:8081');
    for (const endpoint of ['ws://untrusted/', 'ws://127.0.0.1:99999/', 'ws://127.0.0.1:43123/raw']) assert.throws(() => runtimeEnvironment({ kind: 'docker', endpoint }, {}));
  `));

  it('bounds in-memory process metadata, suppresses raw stderr, and applies process timeout', () => verify(prelude + `
    const { runManagedProcess } = await import('./scripts/safe-process.mjs');
    const result = await runManagedProcess({ command: process.execPath, args: ['--input-type=module'], input: 'process.stdout.write("43123");process.stderr.write("synthetic-unsafe");', label: 'docker-metadata', metadata: true });
    assert.deepEqual(result, { code: 0, output: '43123' });
    const large = await runManagedProcess({ command: process.execPath, args: ['--input-type=module'], input: 'process.stdout.write("x".repeat(2048));', label: 'docker-metadata', metadata: true });
    assert.equal(large.code !== 0, true); assert.equal(large.output, '');
    await assert.rejects(runManagedProcess({ metadata: true, label: 'unrestricted' }));
    const timed = await runManagedProcess({ command: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'], label: 'fixture', timeoutMs: 50 });
    assert.equal(timed, 124);
  `));
});

it('Feature 005 discovery retains serial default acceptance and bounded runtime invocation options', () => verify(prelude + `
  const { default: config } = await import('./playwright.config.ts');
  const { parseInvocation } = await import('./scripts/run-e2e.mjs');
  assert.deepEqual(config.projects.find(p => p.name === 'acceptance').testMatch,
    ['room-session.spec.ts', 'generalized-room-membership-qr.spec.ts', 'participant-filters.spec.ts', 'common-filter-resolution.spec.ts']);
  assert.equal(config.workers, 1); assert.equal(config.repeatEach, 1); assert.equal(config.retries, 0);
  assert.equal(config.reporter[0][0], './e2e/support/safe-reporter.ts');
  for (const field of ['trace', 'video', 'screenshot']) assert.equal(config.use[field], 'off');
  assert.equal(config.globalTimeout, 600000);
  for (const selector of ['@membership', 'G01', 'G02', 'G03', 'G04', 'G05', 'G06', 'G07', 'G08', 'G09',
    '@filters', 'H01', 'H02', 'H03', '@resolution', 'I01', 'I02', 'I03'])
    assert.deepEqual(parseInvocation(['acceptance', '--grep', selector]).forwarded, ['--grep', selector]);
  assert.equal(parseInvocation(['acceptance', '--grep', '@resolution']).profile, 'resolution');
  assert.equal(parseInvocation(['acceptance', '--grep', 'H03']).profile, 'h03');
  assert.deepEqual(parseInvocation(['smoke']), { mode: 'acceptance', profile: 'smoke', staticOnly: false,
    forwarded: ['--grep', 'G03|G04|G05|G08|H01'] });
  assert.deepEqual(parseInvocation(['acceptance', '--workers=2', '--repeat-each=2']).forwarded,
    ['--workers', '2', '--repeat-each', '2']);
  for (const args of [['acceptance', 'first-movie-candidate.spec.ts'], ['acceptance', '--workers=5'],
    ['acceptance', '--repeat-each=4'], ['acceptance', '--retries=1'], ['security', '--grep', 'H01'], ['acceptance', '--grep', 'F01'],
    ['acceptance', '--grep', 'I04'], ['acceptance', '--grep', '@resolution arbitrary'],
    ['smoke', '--workers=2'], ['smoke', '--grep', 'H01']])
    assert.throws(() => parseInvocation(args));
`));

it('defines a fail-closed five-case cross-feature smoke profile with 16 identities', () => verify(prelude + `
  import fs from 'node:fs';
  const { parseInvocation, verifyAcceptanceProfile } = await import('./scripts/run-e2e.mjs');
  const invocation = parseInvocation(['smoke']);
  const budgets = { G03:3, G04:4, G05:2, G08:4, H01:3 };
  const results = Object.entries(budgets).map(([browserCase, identities]) => ({ browserCase, signups: identities, identities }));
  assert.equal(verifyAcceptanceProfile(invocation.profile, results), true);
  assert.equal(results.reduce((sum, result) => sum + result.identities, 0), 16);
  assert.equal(verifyAcceptanceProfile(invocation.profile, results.slice(1)), false);
  assert.equal(verifyAcceptanceProfile(invocation.profile, results.map((result, index) => index ? result : { ...result, identities: 2 })), false);
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.equal(pkg.scripts['test:e2e:smoke'], 'node scripts/run-e2e.mjs smoke');
`));

it('defines fail-closed resolution and H03 profiles with approved 9 and 3 identity costs', () => verify(prelude + `
  const { parseInvocation, verifyAcceptanceProfile } = await import('./scripts/run-e2e.mjs');
  const owner = parseInvocation(['acceptance', '--grep', '@resolution']);
  const ownerResults = [['I01',3],['I02',4],['I03',2]].map(([browserCase, identities]) =>
    ({ browserCase, signups: identities, identities }));
  assert.equal(owner.profile, 'resolution'); assert.equal(verifyAcceptanceProfile(owner.profile, ownerResults), true);
  assert.equal(ownerResults.reduce((sum, result) => sum + result.identities, 0), 9);
  assert.equal(verifyAcceptanceProfile(owner.profile, ownerResults.slice(1)), false);
  assert.equal(verifyAcceptanceProfile(owner.profile, ownerResults.map((result, index) => index ? result : { ...result, identities: 4 })), false);
  const targeted = parseInvocation(['acceptance', '--grep', 'H03']);
  assert.equal(targeted.profile, 'h03');
  assert.equal(verifyAcceptanceProfile(targeted.profile, [{ browserCase: 'H03', signups: 3, identities: 3 }]), true);
  assert.equal(verifyAcceptanceProfile(targeted.profile, [{ browserCase: 'H03', signups: 4, identities: 4 }]), false);
`));


it('discovers exactly three filter cases and the approved 9-identity allocation without starting browsers', () => verify(prelude + `
  import fs from 'node:fs';
  import ts from 'typescript';
  const source = fs.readFileSync('e2e/participant-filters.spec.ts', 'utf8');
  const ast = ts.createSourceFile('filters.ts', source, ts.ScriptTarget.Latest, true);
  const titles = [], budgets = {}, timeouts = [];
  function walk(node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'test' && ts.isStringLiteral(node.arguments[0]))
      titles.push(node.arguments[0].text);
    if (ts.isPropertyAssignment(node) && /^H0[1-3]$/.test(node.name.getText(ast)))
      budgets[node.name.getText(ast)] = Number(node.initializer.getText(ast));
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'test.setTimeout') timeouts.push(Number(node.arguments[0].getText(ast)));
    ts.forEachChild(node, walk);
  }
  walk(ast);
  assert.deepEqual(titles.map(title => title.split(' ')[1]), ['H01','H02','H03']);
  assert.deepEqual(budgets, { H01:3, H02:3, H03:3 }); assert.deepEqual(timeouts, [90000,90000,120000]);
  assert.equal(Object.values(budgets).reduce((a,b) => a+b, 0), 9);
`));


it('discovers E/G/H/I with 91 identities and the 39-case final inventory', () => verify(prelude + `
  import fs from 'node:fs';
  import ts from 'typescript';
  const source = fs.readFileSync('e2e/generalized-room-membership-qr.spec.ts', 'utf8');
  const ast = ts.createSourceFile('membership.ts', source, ts.ScriptTarget.Latest, true);
  const titles = [], budgets = {}, timeouts = [];
  function walk(node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'test' && ts.isStringLiteral(node.arguments[0])) titles.push(node.arguments[0].text);
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'test.setTimeout') timeouts.push(Number(node.arguments[0].getText(ast)));
    if (ts.isPropertyAssignment(node) && /^G0[1-9]$/.test(node.name.getText(ast))) budgets[node.name.getText(ast)] = Number(node.initializer.getText(ast));
    ts.forEachChild(node, walk);
  }
  walk(ast);
  assert.deepEqual(titles.map(title => title.split(' ')[1]), ['G01','G02','G03','G04','G05','G06','G07','G08','G09']);
  assert.deepEqual(budgets, { G01:1,G02:1,G03:3,G04:4,G05:2,G06:4,G07:4,G08:4,G09:3 }); assert.deepEqual(timeouts, Array(9).fill(90000));
  assert.equal(47 + 9 + Object.values(budgets).reduce((a, b) => a + b, 0), 82);
  const existing = fs.readFileSync('e2e/room-session.spec.ts', 'utf8');
  // Existing parameterized Auth and recovery trials expand to 24; keep their inventory fixed.
  const existingAst = ts.createSourceFile('room.ts', existing, ts.ScriptTarget.Latest, true);
  let identities = 0, trials = 0;
  function existingWalk(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(existingAst) === 'anonymousBudget')
      for (const prop of node.initializer.arguments[0].properties) identities += Number(prop.initializer.getText(existingAst));
    if (ts.isCallExpression(node) && node.expression.getText(existingAst) === 'test') {
      let multiplier = 1;
      for (let parent = node.parent; parent; parent = parent.parent) {
        if (ts.isForOfStatement(parent)) {
          const expr = ts.isAsExpression(parent.expression) ? parent.expression.expression : parent.expression;
          assert.equal(ts.isArrayLiteralExpression(expr), true); multiplier *= expr.elements.length;
        }
      }
      trials += multiplier;
    }
    ts.forEachChild(node, existingWalk);
  }
  existingWalk(existingAst); assert.equal(identities, 47); assert.equal(trials, 24);
  const resolution = fs.readFileSync('e2e/common-filter-resolution.spec.ts', 'utf8');
  const resolutionAst = ts.createSourceFile('resolution.ts', resolution, ts.ScriptTarget.Latest, true);
  const resolutionTitles = [], resolutionBudgets = {}, resolutionTimeouts = [];
  function resolutionWalk(node) {
    if (ts.isCallExpression(node) && node.expression.getText(resolutionAst) === 'test' && ts.isStringLiteral(node.arguments[0]))
      resolutionTitles.push(node.arguments[0].text);
    if (ts.isPropertyAssignment(node) && /^I0[1-3]$/.test(node.name.getText(resolutionAst)))
      resolutionBudgets[node.name.getText(resolutionAst)] = Number(node.initializer.getText(resolutionAst));
    if (ts.isCallExpression(node) && node.expression.getText(resolutionAst) === 'test.setTimeout')
      resolutionTimeouts.push(Number(node.arguments[0].getText(resolutionAst)));
    ts.forEachChild(node, resolutionWalk);
  }
  resolutionWalk(resolutionAst);
  assert.deepEqual(resolutionTitles.map(title => title.split(' ')[1]), ['I01','I02','I03']);
  assert.deepEqual(resolutionBudgets, { I01:3,I02:4,I03:2 });
  assert.deepEqual(resolutionTimeouts, [120000,120000,120000]);
  assert.equal(Object.values(resolutionBudgets).reduce((sum, value) => sum + value, 0), 9);
  assert.equal(47 + 9 + Object.values(budgets).reduce((a, b) => a + b, 0) + 9, 91);
  assert.equal(24 + 3 + titles.length + resolutionTitles.length, 39);
  const C1 = 1, smoke = 16, owner = 9, H03 = 3;
  assert.deepEqual({ normal: C1 + smoke + owner + H03,
    repeatability: C1 + 2 * (smoke + owner) + H03,
    fresh: C1 + smoke,
    total: C1 + 2 * (smoke + owner) + H03 + C1 + smoke },
  { normal: 29, repeatability: 54, fresh: 17, total: 71 });
`));
