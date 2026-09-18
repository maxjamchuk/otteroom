import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { ReduceMotion, runOnJS, useAnimatedStyle, useSharedValue,
  withSpring } from 'react-native-reanimated';
import { CandidateCard } from '../candidates/candidate-card';
import type { useRoomCandidate } from '../candidates/use-room-candidate';
import type { useCandidateDecision } from './use-candidate-decision';

type CandidateModel = ReturnType<typeof useRoomCandidate>;
type DecisionModel = ReturnType<typeof useCandidateDecision>;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function decisionForRelease(surfaceWidth: number, translationX: number,
  translationY: number): 'yes' | 'no' | null {
  if (![surfaceWidth, translationX, translationY].every(Number.isFinite) || surfaceWidth <= 0)
    return null;
  const distance = clamp(surfaceWidth * 0.25, 72, 120);
  if (Math.abs(translationX) < 1.25 * Math.abs(translationY)) return null;
  if (translationX >= distance) return 'yes';
  if (translationX <= -distance) return 'no';
  return null;
}

function statusText(decision: DecisionModel): string | null {
  if (decision.kind === 'recovering') return 'Checking your choice…';
  if (decision.kind === 'undecided') return 'Choose Yes or No for this candidate.';
  if (decision.kind === 'submitting')
    return `Saving your ${decision.pendingIntent === 'yes' ? 'Yes' : 'No'} choice…`;
  if (decision.kind === 'recoverable-error')
    return 'Unable to confirm your choice. Please retry.';
  if (decision.kind === 'decided' && decision.projection?.myDecision) {
    const value = decision.projection.myDecision === 'yes' ? 'Yes' : 'No';
    return decision.notice === 'conflict'
      ? `You chose ${value} earlier. That choice remains saved.`
      : `You chose ${value}`;
  }
  return null;
}

export function CandidateDecisionSurface({ candidate, decision }: {
  candidate: CandidateModel;
  decision: DecisionModel;
}) {
  const [width, setWidth] = useState(360);
  const translationX = useSharedValue(0);
  const submit = decision.submit;
  const enabled = decision.controlsEnabled;
  const pan = Gesture.Pan()
    .maxPointers(1)
    .activeOffsetX([-12, 12])
    .failOffsetY([-24, 24])
    .enabled(enabled)
    .withTestId('candidate-decision-pan')
    .onUpdate(event => {
      'worklet';
      translationX.value = event.translationX;
    })
    .onEnd((event, success) => {
      'worklet';
      if (!success || event.numberOfPointers > 1) {
        translationX.value = withSpring(0, { reduceMotion: ReduceMotion.System });
        return;
      }
      const value = decisionForRelease(width, event.translationX, event.translationY);
      translationX.value = withSpring(0, { reduceMotion: ReduceMotion.System });
      if (value) runOnJS(submit)(value);
    })
    .onFinalize((_event, success) => {
      'worklet';
      if (!success) translationX.value = withSpring(0, { reduceMotion: ReduceMotion.System });
    });
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translationX.value },
      { rotate: `${clamp(translationX.value / Math.max(width, 1), -0.08, 0.08)}rad` }],
  }), [width]);
  const onLayout = (event: LayoutChangeEvent) => {
    const measured = event.nativeEvent.layout.width;
    if (Number.isFinite(measured) && measured > 0) setWidth(measured);
  };
  const status = statusText(decision);
  const progress = decision.projection
    ? `${decision.projection.completedCount} of ${decision.projection.requiredVoterCount} decisions collected.`
    : null;
  const agreement = decision.projection?.decisionSetComplete &&
    decision.projection.requiredVoterCount === 2 &&
    decision.projection.twoVoterAgreement !== null
    ? decision.projection.twoVoterAgreement
      ? 'Current candidate agreement: both voters chose Yes.'
      : 'Current candidate agreement: not both Yes.'
    : null;

  return <View testID="candidate-decision-surface" onLayout={onLayout}
    accessibilityLabel="Candidate decision" style={styles.surface}>
    <GestureDetector gesture={pan}>
      <Animated.View style={animatedStyle}>
        <CandidateCard model={candidate} />
      </Animated.View>
    </GestureDetector>
    {decision.controlsVisible && <View accessibilityLabel="Choose whether you want to watch"
      style={styles.controls}>
      <Pressable accessibilityRole="button" accessibilityLabel="No — don't want to watch"
        accessibilityState={{ disabled: !enabled, busy: decision.kind === 'submitting' }}
        focusable disabled={!enabled} onPress={() => submit('no')} style={styles.control}>
        <Text style={styles.controlText}>No</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Yes — want to watch"
        accessibilityState={{ disabled: !enabled, busy: decision.kind === 'submitting' }}
        focusable disabled={!enabled} onPress={() => submit('yes')} style={styles.control}>
        <Text style={styles.controlText}>Yes</Text>
      </Pressable>
    </View>}
    {status && <Text testID="decision-status" accessibilityLiveRegion="polite">{status}</Text>}
    {progress && <Text testID="decision-progress" accessibilityLiveRegion="polite">{progress}</Text>}
    {agreement && <Text testID="decision-agreement">{agreement}</Text>}
    {decision.kind === 'recoverable-error' && <Pressable accessibilityRole="button"
      accessibilityLabel="Retry decision recovery" onPress={decision.retry} style={styles.retry}>
      <Text>Retry</Text>
    </Pressable>}
  </View>;
}

const styles = StyleSheet.create({
  surface: { width: '100%', gap: 16 },
  controls: { flexDirection: 'row', gap: 16, justifyContent: 'center' },
  control: { minWidth: 96, minHeight: 44, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#2457A7', borderRadius: 8, paddingHorizontal: 16 },
  controlText: { fontSize: 18, fontWeight: '600' },
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingVertical: 12 },
});
