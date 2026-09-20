import { render,screen } from '@testing-library/react-native';
import { CandidateProgressionStatus } from '../../src/progression/candidate-progression-status';
import type { AcceptedRoomState } from '../../src/rooms/state';

const room={kind:'accepted',id:'11111111-1111-4111-8111-111111111111',code:'ABCDEF0123',
  isCreator:true,isVoter:true,state:'ready',title:'Ready',voterCount:3,requiredVoterCount:3,
  filterCompletedCount:3,filtersComplete:true,filterResolutionStatus:'compatible',
  resolutionIntegrityError:false,candidateAcquisitionStatus:'assigned',
  candidateProgressionStatus:'collecting',candidateSequence:1,candidateIntegrityError:false,
  decisionCompletedCount:1} as AcceptedRoomState;
const decision={projection:null} as never;

it.each([
  ['collecting','1 of 3 decisions collected.'],
  ['advancing','The group did not agree. Finding another movie.'],
  ['agreed','Group agreement reached. Candidate selection has stopped.'],
  ['exhausted','No further eligible movies were found for this selection.'],
] as const)('renders accessible neutral %s meaning without Match UX',(status,text)=>{
  render(<CandidateProgressionStatus room={{...room,candidateProgressionStatus:status,
    candidateAcquisitionStatus:status==='collecting'||status==='agreed'?'assigned':
      status==='exhausted'?'no_candidates':'pending',decisionCompletedCount:status==='agreed'?3:
        status==='collecting'?1:0}} decision={decision}/>);
  expect(screen.getByText(text)).toHaveProp('accessibilityLiveRegion','polite');
  expect(JSON.stringify(screen.toJSON())).not.toMatch(/match|celebrat|confirm/i);
});
