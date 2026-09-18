import { DecisionContractError, narrowGetDecisionResult, narrowSubmitDecisionResult } from '../../src/decisions/contracts';

const projection = { my_decision: null, decision_completed_count: 0,
  required_voter_count: 2, decision_set_complete: false, two_voter_agreement: false };

it.each([
  ['not_decided', null], ['observer', null], ['decided', 'yes'], ['decided', 'no'],
] as const)('accepts coherent get outcome %s', (outcome, my_decision) => {
  const decision_completed_count = outcome === 'decided' ? 1 : 0;
  expect(narrowGetDecisionResult([{ outcome, ...projection, my_decision,
    decision_completed_count }])).toMatchObject({
    outcome, myDecision: my_decision, completedCount: decision_completed_count, requiredVoterCount: 2,
  });
});

it.each(['not_found','not_ready','candidate_changed'] as const)('accepts protected get rejection %s', outcome => {
  expect(narrowGetDecisionResult([{ outcome, my_decision: null, decision_completed_count: null,
    required_voter_count: null, decision_set_complete: null, two_voter_agreement: null }])).toEqual({
    outcome, projection: null,
  });
});

it.each(['accepted','unchanged','conflict'] as const)('accepts authoritative submit outcome %s', outcome => {
  expect(narrowSubmitDecisionResult([{ outcome, ...projection, my_decision: 'yes',
    decision_completed_count: 1 }])).toMatchObject({ outcome, myDecision: 'yes', completedCount: 1 });
});

it('accepts observer rejection only with safe aggregate and larger-room null policy', () => {
  expect(narrowSubmitDecisionResult([{ outcome: 'not_voter', my_decision: null,
    decision_completed_count: 3, required_voter_count: 3,
    decision_set_complete: true, two_voter_agreement: null }])).toMatchObject({
    outcome: 'not_voter', completedCount: 3, requiredVoterCount: 3,
  });
});

it.each([
  [[]], [[null]], [[{ outcome: 'future', ...projection }]],
  [[{ outcome: 'not_decided', ...projection, peer_decision: 'yes' }]],
  [[{ outcome: 'not_decided', ...projection, required_voter_count: 1 }]],
  [[{ outcome: 'not_decided', ...projection, decision_completed_count: -1 }]],
  [[{ outcome: 'not_decided', ...projection, decision_completed_count: 0.5 }]],
  [[{ outcome: 'not_decided', ...projection, decision_set_complete: true }]],
  [[{ outcome: 'not_decided', ...projection, two_voter_agreement: true }]],
  [[{ outcome: 'not_decided', ...projection, required_voter_count: 3, two_voter_agreement: false }]],
  [[{ outcome: 'decided', ...projection, my_decision: null }]],
  [[{ outcome: 'decided', ...projection, my_decision: 'yes', decision_completed_count: 0 }]],
  [[{ outcome: 'observer', ...projection, my_decision: 'yes' }]],
  [[{ outcome: 'not_decided', ...projection }, { outcome: 'not_decided', ...projection }]],
] as const)('rejects malformed/private get payload %#', data => {
  expect(() => narrowGetDecisionResult(data)).toThrow(DecisionContractError);
});

it.each([
  [{ outcome: 'accepted', ...projection, my_decision: null }],
  [{ outcome: 'not_voter', ...projection, my_decision: 'no' }],
  [{ outcome: 'not_found', ...projection }],
  [{ outcome: 'candidate_changed', my_decision: null, decision_completed_count: null,
    required_voter_count: null, decision_set_complete: null, two_voter_agreement: false }],
] as const)('rejects malformed submit payload %#', data => {
  expect(() => narrowSubmitDecisionResult(data)).toThrow(DecisionContractError);
});

it('accepts a complete exact-two agreement and rejects out-of-range PostgreSQL counts', () => {
  expect(narrowGetDecisionResult([{ outcome: 'decided', my_decision: 'yes',
    decision_completed_count: 2, required_voter_count: 2,
    decision_set_complete: true, two_voter_agreement: true }])).toMatchObject({
    decisionSetComplete: true, twoVoterAgreement: true,
  });
  expect(() => narrowGetDecisionResult([{ outcome: 'not_decided', ...projection,
    required_voter_count: 2147483648 }])).toThrow(DecisionContractError);
});

it.each([
  [0, false, false], [1, false, false], [2, true, true], [2, true, false],
] as const)('accepts exact-two progress %s complete=%s agreement=%s', (count, complete, agreement) => {
  expect(narrowGetDecisionResult([{ outcome: count ? 'decided' : 'not_decided',
    my_decision: count ? 'yes' : null, decision_completed_count: count,
    required_voter_count: 2, decision_set_complete: complete,
    two_voter_agreement: agreement }])).toMatchObject({ completedCount: count,
    decisionSetComplete: complete, twoVoterAgreement: agreement });
});

it('accepts larger-room completion only with absent agreement policy', () => {
  expect(narrowGetDecisionResult([{ outcome: 'decided', my_decision: 'no',
    decision_completed_count: 3, required_voter_count: 3,
    decision_set_complete: true, two_voter_agreement: null }])).toMatchObject({
    completedCount: 3, requiredVoterCount: 3, twoVoterAgreement: null,
  });
});
