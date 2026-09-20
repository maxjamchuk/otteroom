import { Text } from 'react-native';
import type { AcceptedRoomState } from '../rooms/state';
import type { useCandidateDecision } from '../decisions/use-candidate-decision';

type DecisionModel = ReturnType<typeof useCandidateDecision>;

export function CandidateProgressionStatus({ room, decision }: {
  room: AcceptedRoomState;
  decision: DecisionModel;
}) {
  const projection = decision.projection;
  const trusted = projection && projection.candidateSequence === room.candidateSequence
    ? projection.candidateProgressionStatus : null;
  const status = trusted === 'agreed' || trusted === 'advancing'
    ? trusted : room.candidateProgressionStatus;
  if (status === 'collecting') return <Text testID="candidate-progression-status"
    accessibilityLiveRegion="polite">{room.decisionCompletedCount} of {room.requiredVoterCount} decisions collected.</Text>;
  if (status === 'advancing') return <Text testID="candidate-progression-status"
    accessibilityLiveRegion="polite">The group did not agree. Finding another movie.</Text>;
  if (status === 'agreed') return <Text testID="candidate-progression-status"
    accessibilityLiveRegion="polite">Group agreement reached. Candidate selection has stopped.</Text>;
  if (status === 'exhausted') return <Text testID="candidate-progression-status"
    accessibilityLiveRegion="polite">No further eligible movies were found for this selection.</Text>;
  return null;
}
