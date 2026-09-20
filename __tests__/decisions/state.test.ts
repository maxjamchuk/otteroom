import {
  beginDecisionSubmission,
  createDecisionState,
  failDecisionRequest,
  receiveDecisionRecovery,
  receiveDecisionSubmission,
  refreshDecisionRecovery,
  retryDecisionRecovery,
  type DecisionGeneration,
} from '../../src/decisions/state';

const generation: DecisionGeneration = {
  roomId: '11111111-1111-4111-8111-111111111111', candidateSequence:1,tmdbMovieId: 42,
};
const projection = { myDecision: null, completedCount: 0, requiredVoterCount: 2,
  candidateSequence:1,decisionSetComplete: false,agreementThreshold:2,
  candidateOutcome:'collecting',candidateProgressionStatus:'collecting' } as const;

it('recovers authority before enabling a voter and retains no optimistic answer', () => {
  const recovering = createDecisionState(generation, 'voter');
  expect(recovering).toMatchObject({ kind: 'recovering', pendingIntent: null, projection: null });
  const undecided = receiveDecisionRecovery(recovering, generation,
    { outcome: 'not_decided', ...projection });
  expect(undecided).toMatchObject({ kind: 'undecided', pendingIntent: null, projection });
  const submitting = beginDecisionSubmission(undecided, 'yes');
  expect(submitting).toMatchObject({ kind: 'submitting', pendingIntent: 'yes' });
  expect(submitting.projection?.myDecision).toBeNull();
  expect(beginDecisionSubmission(submitting, 'no')).toBe(submitting);
});

it.each([
  ['accepted', null], ['unchanged', null], ['conflict', 'conflict'],
] as const)('adopts the authoritative value for %s', (outcome, notice) => {
  const undecided = receiveDecisionRecovery(createDecisionState(generation, 'voter'), generation,
    { outcome: 'not_decided', ...projection });
  const submitting = beginDecisionSubmission(undecided, 'no');
  const decided = receiveDecisionSubmission(submitting, generation, {
    outcome, ...projection, myDecision: outcome === 'conflict' ? 'yes' : 'no', completedCount: 1,
  });
  expect(decided).toMatchObject({ kind: 'decided', pendingIntent: null, notice,
    projection: { myDecision: outcome === 'conflict' ? 'yes' : 'no' } });
});

it('keeps observers aggregate-only and never makes them undecided', () => {
  const observer = receiveDecisionRecovery(createDecisionState(generation, 'observer'), generation,
    { outcome: 'observer', ...projection, completedCount: 1 });
  expect(observer).toMatchObject({ kind: 'unavailable', availability: 'observer',
    projection: { myDecision: null, completedCount: 1 } });
  expect(beginDecisionSubmission(observer, 'yes')).toBe(observer);
});

it('adopts authoritative progress and resolved outcome without calculating it locally', () => {
  const exactTwo = receiveDecisionRecovery(createDecisionState(generation, 'voter'), generation, {
    outcome: 'decided', ...projection, myDecision: 'yes', completedCount: 2,
    decisionSetComplete: true,candidateOutcome:'agreed',candidateProgressionStatus:'agreed',
  });
  expect(exactTwo.projection).toMatchObject({ myDecision: 'yes', completedCount: 2,
    requiredVoterCount: 2, decisionSetComplete: true,candidateOutcome:'agreed',
    candidateProgressionStatus:'agreed' });

  const largerRoom = receiveDecisionRecovery(createDecisionState(generation, 'observer'), generation, {
    outcome: 'observer', myDecision: null, completedCount: 3, requiredVoterCount: 3,
    candidateSequence:1,decisionSetComplete: true,agreementThreshold:2,
    candidateOutcome:'agreed',candidateProgressionStatus:'agreed',
  });
  expect(largerRoom.projection).toMatchObject({ myDecision: null, completedCount: 3,
    requiredVoterCount: 3, decisionSetComplete: true,candidateOutcome:'agreed' });
});

it('retires stale successes and stale failures by room/candidate generation', () => {
  const recovering = createDecisionState(generation, 'voter');
  const other = { ...generation, tmdbMovieId: 99 };
  expect(receiveDecisionRecovery(recovering, other,
    { outcome: 'not_decided', ...projection })).toBe(recovering);
  expect(failDecisionRequest(recovering, other)).toBe(recovering);
});

it('turns uncertainty into a retryable recovery without retaining pending intent', () => {
  const undecided = receiveDecisionRecovery(createDecisionState(generation, 'voter'), generation,
    { outcome: 'not_decided', ...projection });
  const failed = failDecisionRequest(beginDecisionSubmission(undecided, 'yes'), generation);
  expect(failed).toMatchObject({ kind: 'recoverable-error', pendingIntent: null });
  expect(retryDecisionRecovery(failed)).toMatchObject({ kind: 'recovering' });
});

it('recovers a prior same-value winner without accepting the pending intent locally', () => {
  const uncertain = failDecisionRequest(beginDecisionSubmission(
    receiveDecisionRecovery(createDecisionState(generation, 'voter'), generation,
      { outcome: 'not_decided', ...projection }), 'no'), generation);
  const retrying = retryDecisionRecovery(uncertain);
  const recovered = receiveDecisionRecovery(retrying, generation, {
    outcome: 'decided', ...projection, myDecision: 'no', completedCount: 1,
  });
  expect(recovered).toMatchObject({ kind: 'decided', pendingIntent: null,
    projection: { myDecision: 'no', completedCount: 1 } });
});

it('retains the last safe projection while a lifecycle refresh is in flight', () => {
  const decided = receiveDecisionRecovery(createDecisionState(generation, 'voter'), generation, {
    outcome: 'decided', ...projection, myDecision: 'yes', completedCount: 1,
  });
  expect(refreshDecisionRecovery(decided)).toMatchObject({ kind: 'recovering',
    projection: { myDecision: 'yes', completedCount: 1 }, pendingIntent: null });
});
