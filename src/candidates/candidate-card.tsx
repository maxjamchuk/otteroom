import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import type { useRoomCandidate } from './use-room-candidate';

export function CandidateCard({ model }: { model: ReturnType<typeof useRoomCandidate> }) {
  if (model.attempt === 'inactive') return null;
  const candidate = model.attempt === 'integrity-error' ? null : model.candidate;
  const retryLabel = model.attempt === 'acquisition-error' ? 'Retry finding a movie' :
    model.attempt === 'metadata-error' ? 'Retry movie details' :
    model.attempt === 'poster-error' ? 'Retry poster' : null;

  return (
    <View testID="candidate-card" style={styles.card} accessibilityState={{
      busy: model.attempt === 'acquiring' || model.attempt === 'loading-metadata' ||
        model.attempt === 'loading-poster' }}>
      {candidate && <>
        <Text testID="candidate-title" accessibilityRole="header" style={styles.title}>{candidate.title}</Text>
        <Text testID="candidate-year">{candidate.releaseYear}</Text>
        {model.posterSource !== null
          ? <Image key={model.imageKey} testID="candidate-poster" source={model.posterSource}
              accessible accessibilityRole="image" accessibilityLabel={`Poster for ${candidate.title}`}
              style={styles.poster} resizeMode="contain" onLoad={model.onLoad} onError={model.onError} />
          : model.attempt === 'no-poster' && <View testID="candidate-poster-fallback" style={[styles.poster, styles.fallback]}
              accessible accessibilityRole="image" accessibilityLabel={`No poster available for ${candidate.title}`}>
              <Text>No poster available.</Text>
            </View>}
      </>}
      {model.message && <Text testID="candidate-status" accessibilityLiveRegion="polite">{model.message}</Text>}
      {retryLabel && <Pressable accessibilityRole="button" accessibilityLabel={retryLabel}
        onPress={model.retry} style={styles.retry}><Text>{retryLabel}</Text></Pressable>}
      {model.attempt === 'no-candidates' && <Link href="/" accessibilityLabel="Create a new room"
        style={styles.link}>Create a new room</Link>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 360, alignSelf: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '600' },
  poster: { width: '100%', maxWidth: 240, aspectRatio: 2 / 3, alignSelf: 'center' },
  fallback: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#767676' },
  retry: { minHeight: 44, justifyContent: 'center', paddingVertical: 12 },
  link: { color: '#2457A7', fontSize: 18, paddingVertical: 12 },
});
