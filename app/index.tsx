import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { createRoom } from '../src/rooms/service';
import { createErrorState } from '../src/rooms/state';

export default function HomeScreen() {
  const requestId = useRef<string | undefined>(undefined);
  const inFlight = useRef(false);
  const [state, setState] = useState<'idle' | 'creating' | 'error'>('idle');

  async function create() {
    // This synchronous guard also protects calls before React disables the UI.
    if (inFlight.current) return;
    inFlight.current = true;
    setState('creating');
    try {
      requestId.current ??= randomUUID();
      const result = await createRoom(requestId.current);
      router.replace(`/room/${result.room_code}`);
      // Stay guarded until replace unmounts this action. Returning home starts
      // a new component/logical request; a thrown navigation keeps this UUID.
    } catch {
      inFlight.current = false;
      setState('error');
    }
  }
  const label = state === 'creating' ? 'Creating room…' : state === 'error' ? 'Retry create' : 'Create Room';
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>Otteroom</Text>
      <Text>Create a two-person room.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={label}
        accessibilityState={{ disabled: state === 'creating', busy: state === 'creating' }}
        disabled={state === 'creating'} onPress={() => { void create(); }} style={styles.button}>
        <Text>{label}</Text>
      </Pressable>
      {state === 'creating' && <Text accessibilityLiveRegion="polite">Creating your room…</Text>}
      {state === 'error' && <Text accessibilityLiveRegion="polite">{createErrorState().message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 20 },
  title: { fontSize: 32, fontWeight: '600' },
  button: { padding: 16, borderWidth: 1, borderColor: '#2457A7', borderRadius: 8, alignSelf: 'flex-start' },
});
