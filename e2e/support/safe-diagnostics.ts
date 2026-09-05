import { test as base, type BrowserContext, type BrowserContextOptions, type Page, type TestInfo } from '@playwright/test';
import { randomUUID, createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CredentialRegistry, registerCredentials, registerPng } from './credential-registry.ts';
import { containsCredential, DiagnosticBuffer } from './sanitize-diagnostics.ts';
import { validPng } from '../../scripts/check-e2e-artifacts.mjs';

export function validateContextOptions(options: BrowserContextOptions): void {
  if (options.recordHar !== undefined || options.recordVideo !== undefined || options.storageState !== undefined) {
    throw safeError();
  }
}

export function safeError(error?: unknown): Error {
  const controlled = error instanceof Error && error.message === 'CONTROLLED_AUTH_DIAGNOSTIC_FAILURE';
  // Retain only a checked source filename plus numeric location, never raw stack text.
  const location = error instanceof Error ?
    (error.message + '\n' + error.stack).match(/e2e\/(?:diagnostics\/credential-safety\.spec|room-session\.spec|support\/safe-diagnostics)\.ts:\d{1,5}:\d{1,5}/)?.[0] : undefined;
  const result = new Error(controlled ? 'CONTROLLED_AUTH_DIAGNOSTIC_FAILURE' : 'E2E_SAFE_FAILURE' + (location ? ' at ' + location : ''));
  // Never retain original matcherResult, cause, stack, DOM or source location.
  result.stack = `Error: ${result.message}\n    at safeError (e2e/support/safe-diagnostics.ts:18:1)`;
  return result;
}

export function inspectUiValues(values: string[], known: Iterable<string>): boolean {
  const credentials = [...known];
  return values.length <= 20000 && values.reduce((size, value) => size + Buffer.byteLength(value), 0) <= 1048576 &&
    values.every(value => !containsCredential(value, credentials));
}

export function requireStableCapture(checked: boolean, unchanged: boolean): void {
  if (!checked || !unchanged) throw safeError();
}

function blockCapture(context: BrowserContext): void {
  const reject = async (): Promise<never> => { throw safeError(); };
  context.tracing.start = reject;
  context.tracing.startChunk = reject;
  context.tracing.stop = reject;
  context.tracing.stopChunk = reject;
  context.storageState = reject;
  context.request.storageState = reject;
}

export class SafeDiagnostics {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly options: Readonly<BrowserContextOptions>;
  #registry = new CredentialRegistry();
  #label = randomUUID();
  #pending: Promise<void>[] = [];
  #failed = false;
  #signups = 0;
  #logs = new DiagnosticBuffer();
  #info: TestInfo;
  #closed = false;
  #screenshot: Page['screenshot'];

  private constructor(context: BrowserContext, page: Page, options: BrowserContextOptions, info: TestInfo) {
    this.context = context; this.page = page; this.options = Object.freeze({ ...options }); this.#info = info;
    this.#screenshot = page.screenshot.bind(page);
    page.screenshot = async () => { throw safeError(); };
    page.pdf = async () => { throw safeError(); };
  }

  static async create(context: BrowserContext, options: BrowserContextOptions, info: TestInfo): Promise<SafeDiagnostics> {
    validateContextOptions(options);
    blockCapture(context);
    // Installed before any application navigation; no DOM or network data is persisted.
    await context.addInitScript(() => {
      const view = window as typeof window & { __otteroomMutationEpoch?: number };
      view.__otteroomMutationEpoch = 0;
      new MutationObserver(() => { view.__otteroomMutationEpoch = (view.__otteroomMutationEpoch ?? 0) + 1; })
        .observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
    });
    const page = await context.newPage();
    const diagnostics = new SafeDiagnostics(context, page, options, info);
    info.annotations.push({ type: 'safe-context-label', description: 'primary' });
    context.on('request', diagnostics.#observeRequest);
    // Drop unclassified browser output entirely, including console arguments and page errors.
    context.on('console', diagnostics.#drop);
    context.on('weberror', diagnostics.#drop);
    return diagnostics;
  }

  #drop = () => {};
  #observeRequest = (request: import('@playwright/test').Request) => {
    if (/\/auth\/v1\/signup(?:\?|$)/.test(request.url())) this.#signups++;
  };
  get signupAttempts(): number { return this.#signups; }

  stage(value: 'config' | 'capture-guards' | 'ui' | 'sanitizer' | 'scanner' | 'cleanup'): void {
    this.#info.annotations.push({ type: 'safe-stage', description: value });
  }

  async register(values: string[]): Promise<void> {
    if (this.#closed) throw safeError();
    const work = (async () => {
      this.#registry.register(this.#label, values);
      await registerCredentials(process.env.OTTEROOM_CREDENTIAL_SOCKET ?? '', this.#label, values);
    })().catch(() => { this.#failed = true; throw safeError(); });
    // Attach a rejection observer immediately; flush still propagates the failure.
    this.#pending.push(work);
    await work;
  }

  async flush(): Promise<void> {
    await Promise.all(this.#pending);
    if (this.#failed || this.#logs.overflowed) throw safeError();
  }

  async record(input: string | Record<string, unknown>): Promise<void> {
    await this.flush();
    this.#logs.add(input, this.#registry.values());
    if (this.#logs.overflowed) throw safeError();
  }

  async #inspect() {
    await this.flush();
    const result = await this.page.evaluate(() => {
      const view = window as typeof window & { __otteroomMutationEpoch?: number };
      const all = [...document.querySelectorAll('*')];
      if (all.length > 5000 || view.__otteroomMutationEpoch === undefined) return { complete: false, reason: 'inspection-bound', values: [], epoch: -1, viewport: '' };
      const values: string[] = [document.body?.innerText ?? '', document.title];
      let complete = true;
      let reason = 'safe';
      for (const element of all) {
        const box = element.getBoundingClientRect();
        const visible = box.width > 0 && box.height > 0 && box.right > 0 && box.bottom > 0 && box.left < innerWidth && box.top < innerHeight &&
          element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
        if (!visible) continue;
        // Visual content that cannot be verified as text is not screenshot-authorized.
        if (element.matches('canvas,iframe,img,svg,object,embed,[data-expo-error-overlay]') || element.shadowRoot) {
          complete = false; reason = ['canvas', 'iframe', 'img', 'svg', 'object', 'embed'].includes(element.localName) ? element.localName : 'nontext-visual';
        }
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) values.push(element.value);
        for (const attribute of element.attributes) values.push(attribute.value);
        if (getComputedStyle(element).backgroundImage !== 'none') { complete = false; reason = 'background-image'; }
        if (element.getAnimations().length > 0) { complete = false; reason = 'animation'; }
      }
      return { complete, reason, values, epoch: view.__otteroomMutationEpoch, viewport: [innerWidth, innerHeight, scrollX, scrollY, devicePixelRatio].join(':') };
    });
    const safe = result.complete && inspectUiValues(result.values, this.#registry.values());
    this.#info.annotations.push({ type: 'safe-ui-result', description: !result.complete ? 'incomplete' : safe ? 'safe' : 'credential' });
    this.#info.annotations.push({ type: 'safe-ui-reason', description: result.reason });
    return { safe, epoch: result.epoch, viewport: result.viewport, digest: createHash('sha256').update(JSON.stringify(result.values)).digest('hex') };
  }

  async assertNoCredentialUi(): Promise<void> {
    const inspected = await this.#inspect();
    if (!inspected.safe) throw safeError();
  }

  async captureControlledFailure(error: unknown): Promise<void> {
    // Ordinary retention remains disabled until the future real-Auth T061 gate.
    // This infrastructure does not create an Auth session or implement the C probe.
    if (process.env.OTTEROOM_E2E_MODE !== 'security' || process.env.OTTEROOM_E2E_STATIC !== '0' ||
      !this.#info.title.startsWith('@credential-probe C ') || this.#registry.size === 0 ||
      !(error instanceof Error) || error.message !== 'CONTROLLED_AUTH_DIAGNOSTIC_FAILURE') throw safeError();
    const before = await this.#inspect();
    requireStableCapture(before.safe, true);
    const png = await this.#screenshot({ type: 'png', fullPage: false, animations: 'disabled', caret: 'hide' });
    try {
      const after = await this.#inspect();
      requireStableCapture(after.safe, before.epoch === after.epoch && before.viewport === after.viewport && before.digest === after.digest);
      if (!validPng(png)) throw safeError();
      const root = process.env.OTTEROOM_E2E_ARTIFACT_DIR;
      if (!root) throw safeError();
      const filename = this.#info.outputPath('safe-failure.png');
      const relative = path.relative(root, filename);
      await registerPng(process.env.OTTEROOM_CREDENTIAL_SOCKET ?? '', relative, createHash('sha256').update(png).digest('hex'));
      fs.mkdirSync(path.dirname(filename), { recursive: true });
      fs.writeFileSync(filename, png, { flag: 'wx', mode: 0o600 });
      fs.writeFileSync(this.#info.outputPath('safe-diagnostics.txt'), this.#logs.text(), { flag: 'wx', mode: 0o600 });
    } finally { png.fill(0); }
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    try { await this.flush(); }
    finally {
      this.context.removeListener('request', this.#observeRequest);
      this.context.removeListener('console', this.#drop);
      this.context.removeListener('weberror', this.#drop);
      try { await this.context.close(); }
      finally { this.#registry.clear(); this.#pending.length = 0; }
    }
  }
}

export const test = base.extend<{ diagnostics: SafeDiagnostics }>({
  browser: [async ({ playwright, browserName, headless }, use, info) => {
    const policy = info.project.use;
    if (browserName !== 'chromium' || policy.trace !== 'off' || policy.video !== 'off' || policy.screenshot !== 'off' ||
      policy.storageState !== undefined || policy.connectOptions !== undefined ||
      info.config.reporter.length !== 1 || !info.config.reporter[0][0].endsWith('/e2e/support/safe-reporter.ts') ||
      process.env.PLAYWRIGHT_NO_COPY_PROMPT !== '1' || !process.env.OTTEROOM_CREDENTIAL_SOCKET) throw safeError();
    validateContextOptions(policy.contextOptions ?? {});
    let browser: Awaited<ReturnType<typeof playwright.chromium.launch>>;
    try {
      const { browserConnection } = await import('../../scripts/playwright-runtime.mjs');
      const connection = browserConnection();
      browser = connection ? await playwright.chromium.connect(connection) : await playwright.chromium.launch({ headless });
    }
    catch { throw safeError(); }
    const create = browser.newContext.bind(browser);
    const createPage = browser.newPage.bind(browser);
    browser.newPage = async () => { throw safeError(); };
    browser.newContext = async options => {
      validateContextOptions(options ?? {});
      const context = await create(options); blockCapture(context); return context;
    };
    try { await use(browser); } catch (error) { throw safeError(error); }
    finally {
      browser.newContext = create; browser.newPage = createPage;
      try { await browser.close(); } catch { throw safeError(); }
    }
  }, { scope: 'worker' }],
  diagnostics: async ({ browser, baseURL, viewport }, use, info) => {
    const options: BrowserContextOptions = { baseURL, viewport, serviceWorkers: 'block' };
    let context: BrowserContext | undefined, diagnostics: SafeDiagnostics | undefined;
    try {
      context = await browser.newContext(options);
      diagnostics = await SafeDiagnostics.create(context, options, info);
      await use(diagnostics);
    } catch (error) { throw safeError(error); }
    finally {
      try {
        if (diagnostics) await diagnostics.close(); else await context?.close();
        info.annotations.push({ type: 'safe-context-cleanup', description: 'complete' });
      } catch (error) { throw safeError(error); }
    }
  },
  context: async ({ diagnostics }, use) => { try { await use(diagnostics.context); } catch (error) { throw safeError(error); } },
  page: async ({ diagnostics }, use) => { try { await use(diagnostics.page); } catch (error) { throw safeError(error); } },
});

// Test and hook bodies cross this boundary BEFORE Playwright records an exception.
// No soft assertions, raw attachments or secret-bearing test/step titles are allowed.
export async function safeBody(diagnostics: SafeDiagnostics, body: () => Promise<void>): Promise<void> {
  try { await body(); await diagnostics.assertNoCredentialUi(); await diagnostics.flush(); }
  catch (error) {
    try { await diagnostics.flush(); } catch { throw safeError(); }
    throw safeError(error);
  }
}
