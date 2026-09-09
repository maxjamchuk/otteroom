/** @jest-environment node */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { crc32, inflateSync } from 'node:zlib';

// Test-only asset expectations, not a runtime movie catalog or poster registry.
const directory = path.join(process.cwd(), 'assets/candidates');
const filenames = [
  'cardboard-comet.png',
  'pebble-bay-lanterns.png',
  'cloud-tram-four.png',
  'clockwork-orchard.png',
];
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

// Decode the fixtures' non-interlaced 8-bit RGB/RGBA profile using Node only.
// CRCs, inflation and every reconstructed scanline are checked, not just IHDR.
function decodePoster(bytes: Buffer) {
  expect(bytes.length).toBeGreaterThan(45);
  expect(bytes.length).toBeLessThanOrEqual(65536);
  expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const chunks: { type: string; body: Buffer }[] = [];
  let offset = 8;
  while (offset < bytes.length) {
    expect(offset + 12).toBeLessThanOrEqual(bytes.length);
    const length = bytes.readUInt32BE(offset);
    const end = offset + 8 + length;
    expect(end + 4).toBeLessThanOrEqual(bytes.length);
    expect(crc32(bytes.subarray(offset + 4, end))).toBe(bytes.readUInt32BE(end));
    chunks.push({ type: bytes.toString('ascii', offset + 4, offset + 8), body: bytes.subarray(offset + 8, end) });
    offset = end + 4;
  }
  // Pixel data only: no embedded text, URLs, EXIF or other ancillary metadata.
  expect(chunks.map(chunk => chunk.type).join(',')).toMatch(/^IHDR,(?:IDAT,)+IEND$/);
  const header = chunks[0].body;
  expect(header.length).toBe(13);
  expect(header.readUInt32BE(0)).toBe(240);
  expect(header.readUInt32BE(4)).toBe(360);
  expect(header[8]).toBe(8);
  expect([2, 6]).toContain(header[9]);
  expect([...header.subarray(10)]).toEqual([0, 0, 0]);
  expect(chunks[chunks.length - 1].body.length).toBe(0);

  const channels = header[9] === 2 ? 3 : 4;
  const stride = 240 * channels;
  const raw = inflateSync(Buffer.concat(chunks.slice(1, -1).map(chunk => chunk.body)), {
    maxOutputLength: 360 * (stride + 1),
  });
  expect(raw.length).toBe(360 * (stride + 1));
  const pixels = Buffer.alloc(360 * stride);
  for (let y = 0; y < 360; y++) {
    const filter = raw[y * (stride + 1)];
    expect(filter).toBeLessThanOrEqual(4);
    for (let x = 0; x < stride; x++) {
      const index = y * stride + x;
      const left = x >= channels ? pixels[index - channels] : 0;
      const up = y > 0 ? pixels[index - stride] : 0;
      const corner = x >= channels && y > 0 ? pixels[index - stride - channels] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      if (filter === 2) predictor = up;
      if (filter === 3) predictor = Math.floor((left + up) / 2);
      if (filter === 4) {
        const estimate = left + up - corner;
        const a = Math.abs(estimate - left), b = Math.abs(estimate - up), c = Math.abs(estimate - corner);
        predictor = a <= b && a <= c ? left : b <= c ? up : corner;
      }
      pixels[index] = (raw[y * (stride + 1) + 1 + x] + predictor) & 255;
    }
  }
  const visibleColors = new Set<string>();
  for (let i = 0; i < pixels.length; i += channels) {
    if (channels === 3 || pixels[i + 3] > 0) visibleColors.add(pixels.subarray(i, i + 3).toString('hex'));
  }
  expect(visibleColors.size).toBeGreaterThan(1);
  return pixels;
}

describe('local candidate poster fixtures', () => {
  it('contains exactly the four approved files, with no extra assets or directories', () => {
    expect(fs.readdirSync(directory).sort()).toEqual([...filenames].sort());
    for (const filename of filenames) expect(fs.lstatSync(path.join(directory, filename)).isFile()).toBe(true);
  });

  it.each(filenames)('%s is a complete, nonempty 240×360 PNG within 64 KiB', filename => {
    decodePoster(fs.readFileSync(path.join(directory, filename)));
  });

  it('has four distinct file contents and four distinct decoded images', () => {
    const files = filenames.map(filename => fs.readFileSync(path.join(directory, filename)));
    expect(new Set(files.map(digest)).size).toBe(4);
    expect(new Set(files.map(bytes => digest(decodePoster(bytes)))).size).toBe(4);
  });
});
