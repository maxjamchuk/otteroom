import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { containsCredential, sanitizeDiagnostic } from '../e2e/support/sanitize-diagnostics.ts';

const MAX_TEXT = 1024 * 1024;
const forbidden = /(?:^|[-_.])(?:trace|har|storage[-_.]?state|cookies?|sessions?|network|requests?|responses?|websocket)(?:[-_.]|$)/i;
const textTypes = new Set(['.txt', '.json', '.md']);

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function validPng(bytes) {
  if (bytes.length < 45 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return false;
  let offset = 8, header = false, data = false;
  while (offset + 12 <= bytes.length) {
    const size = bytes.readUInt32BE(offset);
    if (size > bytes.length - offset - 12) return false;
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const body = bytes.subarray(offset + 8, offset + 8 + size);
    const crc = bytes.readUInt32BE(offset + 8 + size);
    if (crc32(bytes.subarray(offset + 4, offset + 8 + size)) !== crc) return false;
    if (type === 'IHDR') {
      if (header || offset !== 8 || size !== 13) return false;
      const width = body.readUInt32BE(0), height = body.readUInt32BE(4);
      if (!width || !height || width > 4096 || height > 4096 || body[8] !== 8 ||
        ![2, 6].includes(body[9]) || body[10] !== 0 || body[11] !== 0 || body[12] !== 0) return false;
      header = true;
    } else if (type === 'IDAT') {
      if (!header) return false;
      data = true;
    } else if (type === 'IEND') return header && data && size === 0 && offset + 12 === bytes.length;
    // No text, EXIF or arbitrary metadata is accepted.
    else return false;
    offset += size + 12;
  }
  return false;
}

export function scanArtifacts(directory, { registry } = {}) {
  const findings = [];
  let fileCount = 0, visited = 0;
  const root = path.resolve(directory || '.');
  const known = () => registry?.values() ?? [];
  function fail(file, category) {
    if (findings.length >= 32) return;
    findings.push({
      file: sanitizeDiagnostic(file, known()).replace(/[^\w./[\] -]/g, '_').slice(0, 240),
      category, finding: '[REDACTED]',
    });
  }
  function inspectText(text, file, depth = 0) {
    if (depth > 12) { fail(file, 'incomplete-scan'); return; }
    if (containsCredential(text, known())) fail(file, 'credential-content');
  }
  function inspectJson(value, file, depth = 0) {
    if (depth > 12) { fail(file, 'incomplete-scan'); return; }
    if (typeof value === 'string') inspectText(value, file, depth);
    else if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        inspectText(key, file, depth);
        inspectJson(item, file, depth + 1);
      }
    }
  }
  function walk(current, depth) {
    const relative = path.relative(root, current) || '.';
    if (++visited > 10000 || depth > 16) { fail(relative, 'incomplete-scan'); return; }
    try {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink() || !(stat.mode & 0o444)) { fail(relative, 'unreadable-or-symlink'); return; }
      if (stat.isDirectory()) {
        if (!(stat.mode & 0o111)) { fail(relative, 'unreadable-directory'); return; }
        for (const name of fs.readdirSync(current)) walk(path.join(current, name), depth + 1);
        return;
      }
      if (!stat.isFile()) { fail(relative, 'unapproved-artifact'); return; }
      fileCount++;
      const extension = path.extname(current).toLowerCase();
      if (forbidden.test(path.basename(current)) || !textTypes.has(extension) && extension !== '.png') {
        fail(relative, 'forbidden-artifact'); return;
      }
      if (extension === '.png') {
        if (stat.size > 20 * 1024 * 1024) { fail(relative, 'unapproved-png'); return; }
        const bytes = fs.readFileSync(current);
        const digest = createHash('sha256').update(bytes).digest('hex');
        if (!validPng(bytes) || !registry?.approvedPng(relative, digest)) fail(relative, 'unapproved-png');
        return;
      }
      // Oversized output fails explicitly; no unscanned tail is accepted.
      if (stat.size > MAX_TEXT) { fail(relative, 'incomplete-oversized-text'); return; }
      const bytes = fs.readFileSync(current);
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (text.includes('\0')) { fail(relative, 'unapproved-binary'); return; }
      inspectText(text, relative);
      if (extension === '.json') {
        try { inspectJson(JSON.parse(text), relative); }
        catch { fail(relative, 'invalid-json'); }
      } else {
        // Include valid JSON lines and escaped JSON strings in textual diagnostics.
        for (const line of text.split('\n')) {
          try { inspectJson(JSON.parse(line), relative); } catch { /* Plain text already scanned. */ }
        }
        for (const match of text.matchAll(/"(?:[^"\\]|\\.)*"/g)) {
          try { inspectJson(JSON.parse(match[0]), relative); } catch { fail(relative, 'invalid-json-string'); }
        }
      }
    } catch { fail(relative, 'unreadable-or-incomplete-scan'); }
  }
  try {
    if (fs.realpathSync(root) !== root || !fs.lstatSync(root).isDirectory()) fail('.', 'invalid-artifact-directory');
    else walk(root, 0);
  } catch { fail('.', 'missing-artifact-directory'); }
  return { ok: findings.length === 0, fileCount, findings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = process.argv.length === 3 ? scanArtifacts(process.argv[2]) :
    { ok: false, fileCount: 0, findings: [{ file: '.', category: 'artifact-directory-required', finding: '[REDACTED]' }] };
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exitCode = result.ok ? 0 : 1;
}
