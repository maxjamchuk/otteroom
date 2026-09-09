/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';

const keys = ['cardboard-comet', 'pebble-bay-lanterns', 'cloud-tram-four', 'clockwork-orchard'];

it.each(['native', 'web'])('preserves all four exact static %s sources unchanged', platform => {
  const sources = keys.map((key, i) => platform === 'native' ? i + 101 : Object.freeze({ uri: `/assets/${key}.png`, width: 240, height: 360 }));
  keys.forEach((key, i) => jest.doMock(`../../assets/candidates/${key}.png`, () => sources[i]));
  jest.isolateModules(() => {
    const { posterSources, resolveCandidatePoster, CandidatePosterError } = require('../../src/candidates/posters');
    expect(Object.keys(posterSources).sort()).toEqual([...keys].sort());
    keys.forEach((key, i) => {
      expect(resolveCandidatePoster(key)).toBe(sources[i]);
      expect(resolveCandidatePoster(key)).toBe(resolveCandidatePoster(key));
    });
    for (const key of ['', 'unknown-poster', '__proto__', 'constructor', 'toString']) {
      expect(() => resolveCandidatePoster(key)).toThrow(CandidatePosterError);
      expect(() => resolveCandidatePoster(key)).toThrow('Unable to load this movie. Please try again.');
    }
  });
});

it('uses exactly four literal local requires, each backed by a committed PNG', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'src/candidates/posters.ts'), 'utf8');
  const requires = [...source.matchAll(/\brequire\s*\(([^)]*)\)/g)].map(match => match[1]);
  expect(requires.sort()).toEqual(keys.map(key => `'../../assets/candidates/${key}.png'`).sort());
  for (const key of keys) expect(fs.readFileSync(path.join(process.cwd(), `assets/candidates/${key}.png`)).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(source).not.toMatch(/https?:|supabase|fetch\s*\(/i);
});
