import {
  FilterContractError, narrowFilterRecoveryResult, narrowFilterSubmissionResult,
} from '../../src/filters/contracts';

const own = { outcome:'saved',genres:['action','science_fiction'],release_year_from:1900,
  release_year_to:2026,filter_completed_count:1,required_voter_count:3,allowed_release_year_max:2026 };

it.each(['saved','locked'] as const)('accepts exact own-detail recovery outcome %s', outcome => {
  const row = outcome === 'locked'
    ? { ...own, outcome, filter_completed_count: own.required_voter_count }
    : { ...own, outcome };
  expect(narrowFilterRecoveryResult([row])).toEqual(row);
});
it.each(['not_ready','not_voter','not_submitted'] as const)('accepts exact aggregate-only recovery %s', outcome => {
  const row={...own,outcome,genres:null,release_year_from:null,release_year_to:null,
    filter_completed_count: outcome === 'not_ready' ? 0 : own.filter_completed_count};
  expect(narrowFilterRecoveryResult([row])).toEqual(row);
});
it('requires all-null not_found recovery',()=>{
  const row={outcome:'not_found',genres:null,release_year_from:null,release_year_to:null,
    filter_completed_count:null,required_voter_count:null,allowed_release_year_max:null};
  expect(narrowFilterRecoveryResult([row])).toEqual(row);
});
it.each(['saved','unchanged','locked'] as const)('accepts exact own-detail submission %s', outcome=>{
  const row = outcome === 'locked'
    ? { ...own, outcome, filter_completed_count: own.required_voter_count }
    : { ...own, outcome };
  expect(narrowFilterSubmissionResult([row])).toEqual(row);
});
it.each(['not_ready','not_voter','invalid_genres','invalid_year_range'] as const)('accepts exact detail-null submission %s',outcome=>{
  const row={...own,outcome,genres:null,release_year_from:null,release_year_to:null,
    filter_completed_count: outcome === 'not_ready' ? 0 : own.filter_completed_count};
  expect(narrowFilterSubmissionResult([row])).toEqual(row);
});

it.each([undefined,null,{},[],[own,own],[null]])('rejects non-singleton filter result %#',value=>{
  expect(()=>narrowFilterRecoveryResult(value)).toThrow(FilterContractError);
  expect(()=>narrowFilterSubmissionResult(value)).toThrow(FilterContractError);
});
it.each([
  {extra:'private'},{room_member_id:'private'},{genres:['unknown']},{genres:['action','action']},
  {genres:['science_fiction','action']},{release_year_from:1899},{release_year_to:2027},
  {release_year_from:2021,release_year_to:2020},{filter_completed_count:-1},
  {filter_completed_count:4},{required_voter_count:1},{allowed_release_year_max:1899},
  {allowed_release_year_max:2025},{release_year_from:1900.5},
])('rejects malformed/private/inconsistent own result %#',patch=>{
  expect(()=>narrowFilterRecoveryResult([{...own,...patch}])).toThrow(FilterContractError);
  expect(()=>narrowFilterSubmissionResult([{...own,...patch}])).toThrow(FilterContractError);
});
it.each(['not_found','not_ready','not_voter','not_submitted','saved','locked','unknown'])('enforces recovery outcome nullability for %s',outcome=>{
  expect(()=>narrowFilterRecoveryResult([{...own,outcome,genres:null}])).toThrow(FilterContractError);
});
it.each(['not_found','not_ready','not_voter','invalid_genres','invalid_year_range','saved','unchanged','locked','unknown'])('enforces submission outcome nullability for %s',outcome=>{
  expect(()=>narrowFilterSubmissionResult([{...own,outcome,genres:
    outcome==='saved'||outcome==='unchanged'||outcome==='locked'?null:own.genres}])).toThrow(FilterContractError);
});
