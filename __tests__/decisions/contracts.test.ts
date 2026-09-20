import { DecisionContractError, narrowGetDecisionResult,
  narrowSubmitDecisionResult } from '../../src/decisions/contracts';

const collecting = { my_decision: null, candidate_sequence: 1,
  decision_completed_count: 0, required_voter_count: 2,
  decision_set_complete: false, agreement_threshold: 2,
  candidate_outcome: 'collecting', candidate_progression_status: 'collecting' } as const;
const protectedRow = (outcome: string) => ({ outcome, my_decision: null,
  candidate_sequence: null, decision_completed_count: null, required_voter_count: null,
  decision_set_complete: null, agreement_threshold: null, candidate_outcome: null,
  candidate_progression_status: null });

it.each([['not_decided',null],['observer',null],['decided','yes'],['decided','no']] as const)(
  'accepts coherent exact nine-field get outcome %s',(outcome,my_decision)=>{
    const count=outcome==='decided'?1:0;
    expect(narrowGetDecisionResult([{outcome,...collecting,my_decision,
      decision_completed_count:count}])).toMatchObject({outcome,myDecision:my_decision,
        candidateSequence:1,completedCount:count,agreementThreshold:2,
        candidateOutcome:'collecting',candidateProgressionStatus:'collecting'});
  });

it.each(['not_found','not_ready','candidate_changed'] as const)(
  'requires all-null protected result for %s',outcome=>{
    expect(narrowGetDecisionResult([protectedRow(outcome)])).toEqual({outcome,projection:null});
    expect(narrowSubmitDecisionResult([protectedRow(outcome)])).toEqual({outcome,projection:null});
  });

it.each(['accepted','unchanged','conflict'] as const)(
  'accepts immutable submit outcome %s',outcome=>{
    expect(narrowSubmitDecisionResult([{outcome,...collecting,my_decision:'yes',
      decision_completed_count:1}])).toMatchObject({outcome,myDecision:'yes',completedCount:1});
  });

it('accepts rejected occurrence N while its canonical room phase is advancing',()=>{
  expect(narrowSubmitDecisionResult([{outcome:'accepted',...collecting,my_decision:'no',
    decision_completed_count:2,decision_set_complete:true,candidate_outcome:'rejected',
    candidate_progression_status:'advancing'}])).toMatchObject({completedCount:2,
      candidateOutcome:'rejected',candidateProgressionStatus:'advancing'});
});

it('accepts agreed complete sets and bigint-safe thresholds without a yes tally',()=>{
  expect(narrowGetDecisionResult([{outcome:'decided',...collecting,my_decision:'yes',
    required_voter_count:10,decision_completed_count:10,decision_set_complete:true,
    agreement_threshold:7,candidate_outcome:'agreed',candidate_progression_status:'agreed'}]))
    .toMatchObject({requiredVoterCount:10,agreementThreshold:7,candidateOutcome:'agreed'});
});

it.each([
  [[]],[null],[{outcome:'future',...collecting}],
  [{outcome:'not_decided',...collecting,peer_decision:'yes'}],
  [{outcome:'not_decided',...collecting,candidate_sequence:0}],
  [{outcome:'not_decided',...collecting,agreement_threshold:1}],
  [{outcome:'not_decided',...collecting,decision_set_complete:true}],
  [{outcome:'not_decided',...collecting,candidate_outcome:'agreed'}],
  [{outcome:'decided',...collecting,my_decision:null}],
  [{outcome:'observer',...collecting,my_decision:'yes'}],
  [{outcome:'not_found',...collecting}],
  [{...protectedRow('candidate_changed'),candidate_sequence:1}],
])('rejects malformed, contradictory, or private payload %#',data=>{
  expect(()=>narrowGetDecisionResult(data)).toThrow(DecisionContractError);
});

it('rejects invalid submit ownership/nullability',()=>{
  expect(()=>narrowSubmitDecisionResult([{outcome:'accepted',...collecting}]))
    .toThrow(DecisionContractError);
  expect(()=>narrowSubmitDecisionResult([{outcome:'not_voter',...collecting,my_decision:'no'}]))
    .toThrow(DecisionContractError);
});
