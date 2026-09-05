import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const MAX_FRAME = 65536;
const validContext = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value);

export class CredentialRegistry {
  #contexts = new Map<string, Set<string>>();
  #closed = new Set<string>();
  #pngs = new Map<string, string>();

  register(context: string, values: string[]): void {
    if (!validContext(context) || this.#closed.has(context) || !Array.isArray(values) ||
      values.length > 128 || values.some(value => typeof value !== 'string' || !value.length || value.length > 16384)) {
      throw new Error('CREDENTIAL_REGISTRATION_REJECTED');
    }
    const current = this.#contexts.get(context) ?? new Set<string>();
    if (current.size + values.length > 1024) throw new Error('CREDENTIAL_REGISTRY_BOUND');
    for (const value of values) current.add(value);
    this.#contexts.set(context, current);
  }

  *values(): IterableIterator<string> {
    for (const values of this.#contexts.values()) yield* values;
  }
  hasCredential(value: string): boolean { return [...this.#contexts.values()].some(values => values.has(value)); }
  get size(): number { return [...this.#contexts.values()].reduce((count, values) => count + values.size, 0); }
  closeContext(context: string): void { this.#closed.add(context); }
  approvePng(file: string, digest: string): void {
    if (!/^[A-Za-z0-9_./-]+\.png$/.test(file) || file.startsWith('/') ||
      file.split('/').includes('..') || !/^[a-f0-9]{64}$/.test(digest)) throw new Error('PNG_REGISTRATION_REJECTED');
    this.#pngs.set(file, digest);
  }
  approvedPng(file: string, digest: string): boolean { return this.#pngs.get(file) === digest; }
  clear(): void { this.#contexts.clear(); this.#closed.clear(); this.#pngs.clear(); }
  toJSON(): never { throw new Error('REGISTRY_SERIALIZATION_FORBIDDEN'); }
}

export async function startRegistryServer(registry: CredentialRegistry) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'otteroom-credentials-'));
  fs.chmodSync(directory, 0o700);
  const endpoint = path.join(directory, 'registry.sock');
  const clients = new Set<net.Socket>();
  const server = net.createServer(socket => {
    clients.add(socket);
    let data = Buffer.alloc(0);
    let expected: number | undefined;
    let processed = false;
    socket.setTimeout(5000, () => socket.destroy());
    socket.on('error', () => {});
    socket.on('close', () => { clients.delete(socket); data.fill(0); });
    socket.on('data', chunk => {
      if (processed) { socket.destroy(); return; }
      if (data.length + chunk.length > MAX_FRAME + 4) { socket.destroy(); return; }
      const previous = data;
      data = Buffer.concat([data, chunk]);
      previous.fill(0);
      if (data.length >= 4) expected = data.readUInt32BE(0);
      if (expected !== undefined && (expected === 0 || expected > MAX_FRAME)) { socket.destroy(); return; }
      if (expected === undefined || data.length < expected + 4) return;
      if (data.length !== expected + 4) { socket.destroy(); return; }
      processed = true;
      try {
        const message = JSON.parse(data.subarray(4).toString('utf8'));
        if (message.kind === 'values') registry.register(message.context, message.values);
        else if (message.kind === 'png') registry.approvePng(message.file, message.digest);
        else throw new Error('REGISTRY_PROTOCOL');
        socket.end('OK\n');
      } catch { socket.end('NO\n'); }
      finally { data.fill(0); }
    });
  });
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', () => reject(new Error('REGISTRY_START_FAILED')));
      server.listen(endpoint, resolve);
    });
    fs.chmodSync(endpoint, 0o600);
  } catch {
    server.close();
    fs.rmSync(directory, { recursive: true });
    throw new Error('REGISTRY_START_FAILED');
  }
  return {
    endpoint,
    async close() {
      for (const client of clients) client.destroy();
      await new Promise<void>((resolve, reject) => server.close(error =>
        error ? reject(new Error('REGISTRY_CLOSE_FAILED')) : resolve()));
      fs.rmSync(directory, { recursive: true });
    },
  };
}

async function sendRegistration(endpoint: string, message: unknown): Promise<void> {
  if (!endpoint || !path.isAbsolute(endpoint)) throw new Error('REGISTRY_UNAVAILABLE');
  const payload = Buffer.from(JSON.stringify(message));
  if (payload.length > MAX_FRAME) { payload.fill(0); throw new Error('REGISTRY_FRAME_BOUND'); }
  const frame = Buffer.alloc(payload.length + 4);
  frame.writeUInt32BE(payload.length);
  payload.copy(frame, 4);
  payload.fill(0);
  try {
    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection(endpoint);
      let reply = '';
      socket.setTimeout(5000, () => socket.destroy(new Error('REGISTRY_TIMEOUT')));
      socket.on('connect', () => socket.write(frame, () => frame.fill(0)));
      socket.on('data', data => {
        reply += data.toString('utf8');
        if (reply.length > 3) socket.destroy(new Error('REGISTRY_PROTOCOL'));
      });
      socket.on('error', () => reject(new Error('REGISTRY_UNAVAILABLE')));
      socket.on('close', () => reply === 'OK\n' ? resolve() : reject(new Error('REGISTRY_ACK_REQUIRED')));
    });
  } finally { frame.fill(0); }
}

export async function registerCredentials(endpoint: string, context: string, values: string[]): Promise<void> {
  await sendRegistration(endpoint, { kind: 'values', context, values });
}

export async function registerPng(endpoint: string, file: string, digest: string): Promise<void> {
  await sendRegistration(endpoint, { kind: 'png', file, digest });
}
