import {
  ResolutionContractError, narrowResolutionResult,
} from '../../src/resolution/contracts';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

it.each([
  { outcome: 'not_found', filter_resolution_status: null },
  { outcome: 'pending', filter_resolution_status: 'pending' },
  { outcome: 'compatible', filter_resolution_status: 'compatible' },
  { outcome: 'incompatible', filter_resolution_status: 'incompatible' },
] as const)('accepts only the closed two-field resolver row %#', row => {
  expect(narrowResolutionResult([row])).toEqual(row);
});

it.each([undefined, null, {}, [], [null], [{ outcome: 'pending' }],
  [{ outcome: 'pending', filter_resolution_status: 'pending', release_year_from: 1900 }],
  [{ outcome: 'pending', filter_resolution_status: 'pending' },
    { outcome: 'pending', filter_resolution_status: 'pending' }],
])('rejects non-singleton, missing, extra or private resolver data %#', value => {
  expect(() => narrowResolutionResult(value)).toThrow(ResolutionContractError);
});

it.each([
  ['not_found', 'pending'], ['not_found', 'compatible'], ['not_found', 'incompatible'],
  ['pending', null], ['pending', 'compatible'], ['pending', 'incompatible'],
  ['compatible', null], ['compatible', 'pending'], ['compatible', 'incompatible'],
  ['incompatible', null], ['incompatible', 'pending'], ['incompatible', 'compatible'],
  ['failed', null], ['already_resolved', 'compatible'],
] as const)('rejects outcome/status mismatch %s/%s', (outcome, filter_resolution_status) => {
  expect(() => narrowResolutionResult([{ outcome, filter_resolution_status }]))
    .toThrow(ResolutionContractError);
});

it('keeps the resolution boundary status-only with no candidate or second-channel path',()=>{
  const root=join(process.cwd(),'src','resolution');
  const source=['contracts.ts','service.ts','state.ts','use-common-filter-resolution.ts']
    .map(file=>readFileSync(join(root,file),'utf8')).join('\n');
  expect(source).not.toMatch(/p_genres|release_year_from|release_year_to|clause_ordinal|room_members|participant_filters|ensure_room_candidate|ensureRoomCandidate|useRoomCandidate|CandidateCard|tmdb|fetch\(|\.channel\(/i);
  const route=readFileSync(join(process.cwd(),'app','room','[code].tsx'),'utf8');
  expect(route).not.toMatch(/src\/candidates|ensureRoomCandidate|useRoomCandidate|CandidateCard|tmdb/i);
});
