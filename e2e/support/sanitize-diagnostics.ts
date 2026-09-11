const REDACTED = '[REDACTED]';
const RECORD_LIMIT = 4096;
const INPUT_LIMIT = 1024 * 1024;
const secretField = /(?:access.?token|refresh.?token|authorization|cookie|session|service.?role|secret|password|jwt)/i;
const secretAssignment = /["']?(?:access[_-]?token|refresh[_-]?token|authorization|set-cookie|cookie|service[_-]?role(?:[_-]?key)?|secret(?:[_-]?key)?|(?:database[_-]?)?password|jwt)["']?\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\r\n,}]+)/gi;
const bearer = /\bbearer\s+[^\s"'<>;,}]+/gi;
const jwt = /\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const secretKey = /\bsb_secret_[A-Za-z0-9_-]+/g;
const fields = new Set([
  'message', 'stack', 'error', 'scenario', 'context', 'status', 'outcome',
  'roomCode', 'roomState', 'category', 'component', 'testName',
]);

function redact(text: string, known: Iterable<string>): string {
  let output = text;
  for (const value of known) {
    if (typeof value === 'string' && value.length > 0) output = output.split(value).join(REDACTED);
  }
  return output
    .replace(secretAssignment, REDACTED)
    .replace(bearer, REDACTED)
    .replace(jwt, REDACTED)
    .replace(secretKey, REDACTED);
}

export function containsCredential(text: string, known: Iterable<string> = []): boolean {
  for (const value of known) if (value && text.includes(value)) return true;
  for (const pattern of [bearer, jwt, secretKey, secretAssignment]) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      if (!match[0].includes(REDACTED)) return true;
    }
  }
  return false;
}

function bounded(text: string, limit: number): string {
  if (Buffer.byteLength(text) <= limit) return text;
  // Decode only complete UTF-8 sequences and leave an explicit safe truncation marker.
  return Buffer.from(text).subarray(0, limit - 16).toString('utf8').replace(/\uFFFD$/u, '') + '[TRUNCATED]';
}

export function sanitizeDiagnostic(input: unknown, known: Iterable<string> = []): string {
  const credentials = [...known];
  const seen = new Set<object>();
  let bytes = 0;
  function project(value: unknown, depth: number): unknown {
    if (depth > 6) throw new Error('DIAGNOSTIC_DEPTH');
    if (typeof value === 'string') {
      bytes += Buffer.byteLength(value);
      if (bytes > INPUT_LIMIT) throw new Error('DIAGNOSTIC_SIZE');
      return redact(value, credentials);
    }
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'object' || value === null || seen.has(value)) throw new Error('DIAGNOSTIC_SHAPE');
    if (Object.getPrototypeOf(value) !== Object.prototype && !Array.isArray(value)) throw new Error('DIAGNOSTIC_SHAPE');
    seen.add(value);
    try {
      if (Array.isArray(value)) {
        if (value.length > 64) throw new Error('DIAGNOSTIC_SIZE');
        return value.map(item => project(item, depth + 1));
      }
      const descriptors = Object.getOwnPropertyDescriptors(value);
      if (Object.keys(descriptors).length > 64) throw new Error('DIAGNOSTIC_SIZE');
      const selected: Record<string, unknown> = {};
      for (const [key, descriptor] of Object.entries(descriptors)) {
        if (!('value' in descriptor)) throw new Error('DIAGNOSTIC_ACCESSOR');
        if (secretField.test(key)) selected['redacted'] = REDACTED;
        else if (fields.has(key)) selected[key] = project(descriptor.value, depth + 1);
      }
      return selected;
    } finally { seen.delete(value); }
  }
  try {
    const selected = project(input, 0);
    return bounded(typeof selected === 'string' ? selected : JSON.stringify(selected), RECORD_LIMIT);
  } catch {
    return REDACTED + ' unsupported diagnostic';
  }
}

export class DiagnosticBuffer {
  #records: string[] = [];
  #size = 0;
  overflowed = false;

  add(input: unknown, known: Iterable<string> = []): void {
    const line = sanitizeDiagnostic(input, known);
    const bytes = Buffer.byteLength(line) + 1;
    if (this.#size + bytes > 65536) { this.overflowed = true; return; }
    this.#records.push(line);
    this.#size += bytes;
  }

  text(): string { return this.#records.join('\n'); }
}

// Only reviewed test files and numeric locations may survive an error boundary.
// Input/stack contents and arbitrary paths never become diagnostic labels.
export function safeDiagnosticLocation(value: string): string | undefined {
  return value.match(/e2e\/(?:diagnostics\/credential-safety\.spec|room-session\.spec|generalized-room-membership-qr\.spec|participant-filters\.spec|support\/(?:safe-diagnostics|room-harness|filter-harness|qr-harness))\.ts:\d{1,5}:\d{1,5}/)?.[0];
}
