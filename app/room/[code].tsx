import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function RoomRouteScreen() {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>Room route preview</Text>
      <Text>This route is available. No room has been created or joined.</Text>
      <Link href="/" replace style={styles.link}>Back to home</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 20 },
  title: { fontSize: 28, fontWeight: '600' },
  link: { color: '#2457A7', fontSize: 18, paddingVertical: 12 },
});
