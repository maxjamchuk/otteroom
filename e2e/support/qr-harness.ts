import { expect, type Page } from '@playwright/test';
import jsQR from 'jsqr';

const MAX_SVG_BYTES = 65536;
const MAX_SIDE = 512;
const allowedElements = new Set(['svg', 'g', 'defs', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'lineargradient', 'stop']);
const allowedAttributes = new Set([
  'xmlns', 'width', 'height', 'viewBox', 'fill', 'stroke', 'stroke-width', 'd', 'x', 'y', 'rx', 'ry',
  'cx', 'cy', 'r', 'x1', 'x2', 'y1', 'y2', 'points', 'transform', 'fill-rule', 'clip-rule',
  'shape-rendering', 'preserveAspectRatio', 'focusable', 'aria-hidden', 'id', 'offset', 'stop-color', 'stop-opacity', 'stroke-linecap',
]);

function fail(): never { throw new Error('E2E_SAFE_FAILURE'); }
function markupFailure(): never { throw new Error('E2E_SAFE_FAILURE'); }
function decodeFailure(): never { throw new Error('E2E_SAFE_FAILURE'); }
function rasterFailure(): never { throw new Error('E2E_SAFE_FAILURE'); }

/** Pure fail-closed check used by the controller tests and again on the live DOM. */
export function assertSafeQrMarkup(markup: string): void {
  if (typeof markup !== 'string' || Buffer.byteLength(markup) > MAX_SVG_BYTES || !/^<svg(?:\s|>)/.test(markup)) markupFailure();
  const tags = [...markup.matchAll(/<\/?\s*([\w:-]+)/g)].map(match => match[1].toLowerCase());
  if (!tags.length || tags.some(tag => !allowedElements.has(tag))) markupFailure();
  const withoutNamespace = markup.replace(/\sxmlns="http:\/\/www\.w3\.org\/2000\/svg"/i, '');
  if (/\b(?:on\w+|href|style|class)\s*=|(?:https?:|data:|javascript:|@import|font)/i.test(withoutNamespace) ||
    /url\s*\((?!#[A-Za-z][\w.-]*\))/i.test(withoutNamespace)) markupFailure();
}

export function decodeQrRgba(pixels: Uint8ClampedArray, width: number, height: number, expected: string): string {
  try {
    if (!(pixels instanceof Uint8ClampedArray) || !Number.isInteger(width) || !Number.isInteger(height) ||
      width < 1 || height < 1 || width > MAX_SIDE || height > MAX_SIDE || pixels.length !== width * height * 4 ||
      typeof expected !== 'string' || expected.length < 1 || expected.length > 2048) fail();
    const decoded = jsQR(pixels, width, height, { inversionAttempts: 'dontInvert' });
    if (!decoded || decoded.data !== expected) fail();
    return decoded.data;
  } catch { decodeFailure(); }
  finally { pixels.fill(0); }
}

/** Decode the selected visible QR only. No screenshot, attachment or persisted bytes are produced. */
export async function verifyInvitationQr(page: Page, expected: string): Promise<string> {
  if (typeof expected !== 'string' || expected.length < 1 || expected.length > 2048) fail();
  const wrapper = page.getByRole('img', { name: 'Room invitation QR code', exact: true });
  await expect(wrapper).toBeVisible();
  await wrapper.scrollIntoViewIfNeeded();
  const svg = wrapper.locator('svg');
  await expect(svg).toHaveCount(1);
  await expect(svg).toBeVisible();

  const raster = await svg.evaluate((node, limits) => {
    const reject = () => { throw new Error('E2E_SAFE_FAILURE'); };
    if (!(node instanceof SVGSVGElement)) reject();
    if (!node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) reject();
    const box = node.getBoundingClientRect();
    if (!(box.width > 0 && box.height > 0 && box.width <= limits.side && box.height <= limits.side &&
      box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight)) reject();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    if (!hit || !node.contains(hit)) reject();
    const allowedTags = new Set(limits.elements);
    const allowedAttrs = new Set(limits.attributes);
    for (const element of [node, ...node.querySelectorAll('*')]) {
      if (!allowedTags.has(element.localName.toLowerCase())) reject();
      for (const attribute of [...element.attributes]) {
        // react-native-svg adds layout-only root CSS. Validate it, then omit it
        // from the isolated geometry serialized for rasterization.
        if (element === node && attribute.name === 'style' && !/(?:url\s*\(|https?:|data:|@import|font)/i.test(attribute.value)) continue;
        if (!allowedAttrs.has(attribute.name) || attribute.name !== 'xmlns' && (/(?:https?:|data:|javascript:|@import|font)/i.test(attribute.value) ||
          /url\s*\((?!#[A-Za-z][\w.-]*\))/i.test(attribute.value))) reject();
      }
    }
    const selected = node.cloneNode(true) as SVGSVGElement;
    selected.removeAttribute('style');
    const markup = new XMLSerializer().serializeToString(selected);
    if (new TextEncoder().encode(markup).byteLength > limits.bytes) reject();
    const canvas = document.createElement('canvas');
    const width = Math.ceil(box.width), height = Math.ceil(box.height);
    if (width < 1 || height < 1 || width > limits.side || height > limits.side) reject();
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) reject();
    const drawing = context!;
    const blob = new Blob([markup], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    return new Promise<{ markup: string; width: number; height: number; pixels: number[] }>((resolve, rejectPromise) => {
      const clear = () => { URL.revokeObjectURL(url); image.src = ''; canvas.width = 0; canvas.height = 0; };
      const deadline = setTimeout(() => { clear(); rejectPromise(new Error('E2E_SAFE_FAILURE')); }, 5000);
      image.onload = () => {
        try {
          drawing.drawImage(image, 0, 0, width, height);
          const data = drawing.getImageData(0, 0, width, height).data;
          resolve({ markup, width, height, pixels: Array.from(data) });
          data.fill(0);
        } catch { rejectPromise(new Error('E2E_SAFE_FAILURE')); }
        finally { clearTimeout(deadline); clear(); }
      };
      image.onerror = () => { clearTimeout(deadline); clear(); rejectPromise(new Error('E2E_SAFE_FAILURE')); };
      image.src = url;
    });
  }, { bytes: MAX_SVG_BYTES, side: MAX_SIDE, elements: [...allowedElements], attributes: [...allowedAttributes] }).catch(rasterFailure);

  try {
    assertSafeQrMarkup(raster.markup);
    const pixels = Uint8ClampedArray.from(raster.pixels);
    raster.pixels.fill(0);
    return decodeQrRgba(pixels, raster.width, raster.height, expected);
  } finally { raster.pixels.fill(0); raster.markup = ''; }
}
