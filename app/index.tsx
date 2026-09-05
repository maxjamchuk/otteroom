import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>Otteroom</Text>
      <Text>Application baseline. Room functionality is not enabled.</Text>
      <Link href="/room/0A1B2C3D4E" style={styles.link}>
        Open route preview
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 20 },
  title: { fontSize: 32, fontWeight: '600' },
  link: { color: '#2457A7', fontSize: 18, paddingVertical: 12 },
});
