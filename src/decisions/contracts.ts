export type CandidateDecision = 'yes' | 'no';

export type DecisionProjection = Readonly<{
  myDecision: CandidateDecision | null;
  completedCount: number;
  requiredVoterCount: number;
  decisionSetComplete: boolean;
  twoVoterAgreement: boolean | null;
}>;

type ProtectedGetOutcome = 'not_found' | 'not_ready' | 'candidate_changed';
type ProtectedSubmitOutcome = ProtectedGetOutcome;
export type GetDecisionResult =
  | (DecisionProjection & Readonly<{ outcome: 'decided' | 'not_decided' | 'observer' }>)
  | Readonly<{ outcome: ProtectedGetOutcome; projection: null }>;
export type SubmitDecisionResult =
  | (DecisionProjection & Readonly<{ outcome: 'accepted' | 'unchanged' | 'conflict' | 'not_voter' }>)
  | Readonly<{ outcome: ProtectedSubmitOutcome; projection: null }>;

export class DecisionContractError extends Error {
  constructor() {
    super('Unable to verify the decision result. Please try again.');
    this.name = 'DecisionContractError';
  }
}

const fields = ['outcome','my_decision','decision_completed_count','required_voter_count',
  'decision_set_complete','two_voter_agreement'] as const;
type Raw = Record<(typeof fields)[number], unknown>;

function oneRow(data: unknown): Raw {
  if (!Array.isArray(data) || data.length !== 1) throw new DecisionContractError();
  const row = data[0];
  if (!row || typeof row !== 'object' || Array.isArray(row) ||
      Object.keys(row).length !== fields.length || !fields.every(field => Object.hasOwn(row, field))) {
    throw new DecisionContractError();
  }
  return row as Raw;
}

function decision(value: unknown): value is CandidateDecision {
  return value === 'yes' || value === 'no';
}

function protectedResult(row: Raw, outcomes: readonly string[]):
  { outcome: ProtectedGetOutcome; projection: null } | null {
  if (!outcomes.includes(String(row.outcome))) return null;
  if (row.my_decision !== null || row.decision_completed_count !== null ||
      row.required_voter_count !== null || row.decision_set_complete !== null ||
      row.two_voter_agreement !== null) throw new DecisionContractError();
  return { outcome: row.outcome as ProtectedGetOutcome, projection: null };
}

function projection(row: Raw): DecisionProjection {
  const completed = row.decision_completed_count;
  const required = row.required_voter_count;
  const complete = row.decision_set_complete;
  const agreement = row.two_voter_agreement;
  if (typeof completed !== 'number' || !Number.isSafeInteger(completed) || completed < 0 ||
      completed > 2147483647 || typeof required !== 'number' || !Number.isSafeInteger(required) ||
      required < 2 || required > 2147483647 ||
      completed > required || typeof complete !== 'boolean' || complete !== (completed === required) ||
      (required === 2
        ? typeof agreement !== 'boolean' || agreement && !complete
        : agreement !== null)) throw new DecisionContractError();
  return Object.freeze({
    myDecision: decision(row.my_decision) ? row.my_decision : null,
    completedCount: completed,
    requiredVoterCount: required,
    decisionSetComplete: complete,
    twoVoterAgreement: agreement as boolean | null,
  });
}

export function narrowGetDecisionResult(data: unknown): GetDecisionResult {
  const row = oneRow(data);
  const rejected = protectedResult(row, ['not_found','not_ready','candidate_changed']);
  if (rejected) return Object.freeze(rejected);
  if (!(row.outcome === 'decided' || row.outcome === 'not_decided' || row.outcome === 'observer')) {
    throw new DecisionContractError();
  }
  const value = projection(row);
  if (row.outcome === 'decided'
    ? !decision(row.my_decision) || value.completedCount === 0
    : row.my_decision !== null) {
    throw new DecisionContractError();
  }
  return Object.freeze({ outcome: row.outcome, ...value });
}

export function narrowSubmitDecisionResult(data: unknown): SubmitDecisionResult {
  const row = oneRow(data);
  const rejected = protectedResult(row, ['not_found','not_ready','candidate_changed']);
  if (rejected) return Object.freeze(rejected);
  if (!(row.outcome === 'accepted' || row.outcome === 'unchanged' ||
      row.outcome === 'conflict' || row.outcome === 'not_voter')) throw new DecisionContractError();
  const value = projection(row);
  if (row.outcome === 'not_voter'
    ? row.my_decision !== null
    : !decision(row.my_decision) || value.completedCount === 0) {
    throw new DecisionContractError();
  }
  return Object.freeze({ outcome: row.outcome, ...value });
}
