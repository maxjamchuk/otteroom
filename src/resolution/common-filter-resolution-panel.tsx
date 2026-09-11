import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CommonFilterResolutionModel } from './use-common-filter-resolution';

export function CommonFilterResolutionPanel({ model }: { model: CommonFilterResolutionModel }) {
  if (model.attempt === 'integrity-error') return <View style={styles.section}>
    <Text accessibilityRole="header">Common-filter status could not be verified.</Text>
    <Text accessibilityLiveRegion="assertive">{model.message}</Text>
  </View>;
  if (model.status === 'compatible') return <View style={styles.section}>
    <Text accessibilityRole="header" accessibilityLiveRegion="polite">Filters are compatible.</Text>
    <Text>Movie candidate sourcing is the next step in a future feature.</Text>
  </View>;
  if (model.status === 'incompatible') return <View style={styles.section}>
    <Text accessibilityRole="header" accessibilityLiveRegion="polite">Filters are incompatible.</Text>
    <Text>This room is frozen. Start a new room to choose different filters.</Text>
    <Link href="/" accessibilityLabel="Create a new room" style={styles.link}>Create a new room</Link>
  </View>;
  if (model.attempt === 'resolving') return <View style={styles.section}>
    <Text accessibilityRole="header" accessibilityLiveRegion="polite">Resolving common filters…</Text>
  </View>;
  if (model.attempt === 'error') return <View style={styles.section}>
    <Text accessibilityLiveRegion="assertive">{model.message}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Retry common-filter resolution"
      onPress={model.retry} style={styles.control}>
      <Text>Retry common-filter resolution</Text>
    </Pressable>
  </View>;
  return null;
}

const styles = StyleSheet.create({
  section: { gap: 12, width: '100%' },
  control: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#767676', borderRadius: 8 },
  link: { color: '#2457A7', fontSize: 18, paddingVertical: 12 },
});

