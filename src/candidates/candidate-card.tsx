import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { useRoomCandidate } from './use-room-candidate';

export function CandidateCard({ model }: { model: ReturnType<typeof useRoomCandidate> }) {
  if (model.status === 'inactive') return null;
  const failed = model.status === 'acquisition-error' || model.status === 'poster-error';

  return (
    <View testID="candidate-card" style={styles.card} accessibilityState={{ busy: model.status === 'loading' }}>
      {model.candidate && <>
        <Text testID="candidate-title" accessibilityRole="header" style={styles.title}>{model.candidate.title}</Text>
        <Text testID="candidate-year">{model.candidate.release_year}</Text>
        {model.posterSource !== null
          ? <Image key={model.imageKey} testID="candidate-poster" source={model.posterSource}
              accessible accessibilityRole="image" accessibilityLabel={`Poster for ${model.candidate.title}`}
              style={styles.poster} resizeMode="contain" onLoad={model.onLoad} onError={model.onError} />
          : <View style={styles.poster} />}
      </>}
      {model.message && <Text testID="candidate-status" accessibilityLiveRegion="polite">{model.message}</Text>}
      {failed && <Pressable accessibilityRole="button" accessibilityLabel="Retry candidate"
        onPress={model.retry} style={styles.retry}><Text>Retry candidate</Text></Pressable>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 360, alignSelf: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '600' },
  poster: { width: '100%', maxWidth: 240, aspectRatio: 2 / 3, alignSelf: 'center' },
  retry: { minHeight: 44, justifyContent: 'center', paddingVertical: 12 },
});
