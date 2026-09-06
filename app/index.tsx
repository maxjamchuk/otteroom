import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { parseRoomSegment } from '../src/rooms/code';
import { createRoom } from '../src/rooms/service';
import { createErrorState, joinErrorState, malformedInvitationState } from '../src/rooms/state';

export default function HomeScreen() {
  const requestId = useRef<string | undefined>(undefined);
  const inFlight = useRef(false);
  const [state, setState] = useState<'idle' | 'creating' | 'error' | 'joining' | 'malformed' | 'join-error'>('idle');
  const [input, setInput] = useState('');

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
  function join() {
    if (inFlight.current) return;
    const route = parseRoomSegment(input);
    if (!route) { setState('malformed'); return; }
    inFlight.current = true;
    setState('joining');
    try { router.replace(route.path); }
    catch { inFlight.current = false; setState('join-error'); }
  }
  const busy = state === 'creating' || state === 'joining';
  const label = state === 'creating' ? 'Creating room…' : state === 'error' ? 'Retry create' : 'Create Room';
  const joinLabel = state === 'joining' ? 'Opening room…' : state === 'join-error' ? 'Retry join' : 'Join Room';
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>Otteroom</Text>
      <Text>Create a two-person room.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={label}
        accessibilityState={{ disabled: busy, busy: state === 'creating' }}
        disabled={busy} onPress={() => { void create(); }} style={styles.button}>
        <Text>{label}</Text>
      </Pressable>
      {state === 'creating' && <Text accessibilityLiveRegion="polite">Creating your room…</Text>}
      {state === 'error' && <Text accessibilityLiveRegion="polite">{createErrorState().message}</Text>}
      <Text>Or enter an invitation code.</Text>
      <TextInput accessibilityLabel="Room code input" value={input} editable={!busy}
        onChangeText={setInput} autoCapitalize="characters" autoCorrect={false}
        onSubmitEditing={join} style={styles.input} />
      <Pressable accessibilityRole="button" accessibilityLabel={joinLabel}
        accessibilityState={{ disabled: busy, busy: state === 'joining' }}
        disabled={busy} onPress={join} style={styles.button}><Text>{joinLabel}</Text></Pressable>
      {state === 'joining' && <Text accessibilityLiveRegion="polite">Opening your room…</Text>}
      {state === 'malformed' && <Text accessibilityLiveRegion="polite">{malformedInvitationState().message}</Text>}
      {state === 'join-error' && <Text accessibilityLiveRegion="polite">{joinErrorState().message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 20 },
  title: { fontSize: 32, fontWeight: '600' },
  button: { padding: 16, borderWidth: 1, borderColor: '#2457A7', borderRadius: 8, alignSelf: 'flex-start' },
  input: { borderWidth: 1, borderColor: '#555', borderRadius: 8, padding: 12, maxWidth: 360 },
});
