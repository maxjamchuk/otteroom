import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, ScrollView } from 'react-native';
import { parseRoomSegment } from '../src/rooms/code';
import { createRoom } from '../src/rooms/service';
import { createErrorState, joinErrorState, malformedInvitationState } from '../src/rooms/state';

export default function HomeScreen() {
  const request = useRef<Readonly<{ requestId: string; requiredVoterCount: number; creatorIsVoter: boolean }> | undefined>(undefined);
  const [requiredText, setRequiredText] = useState('2');
  const [creationStarted, setCreationStarted] = useState(false);
  const [creatorIsVoter, setCreatorIsVoter] = useState<boolean | null>(null);
  const [configurationError, setConfigurationError] = useState<string>();
  const inFlight = useRef(false);
  const [state, setState] = useState<'idle' | 'creating' | 'error' | 'joining' | 'malformed' | 'join-error'>('idle');
  const [input, setInput] = useState('');

  async function create() {
    // This synchronous guard also protects calls before React disables the UI.
    if (inFlight.current) return;
    const target = Number(requiredText.trim());
    if (!request.current) {
      if (!/^\d+$/.test(requiredText.trim()) || !Number.isInteger(target) || target < 2 || target > 2147483647) {
        setConfigurationError('Enter a whole voter count from 2 to 2147483647.'); return;
      }
      if (creatorIsVoter === null) { setConfigurationError('Choose whether you will vote.'); return; }
    }
    inFlight.current = true;
    setConfigurationError(undefined);
    setState('creating');
    try {
      request.current ??= Object.freeze({ requestId: randomUUID(), requiredVoterCount: target, creatorIsVoter: creatorIsVoter! });
      const frozen = request.current;
      setCreationStarted(true);
      const result = await createRoom(frozen.requestId, frozen.requiredVoterCount, frozen.creatorIsVoter);
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
  const configurationLocked = busy || creationStarted;
  const label = state === 'creating' ? 'Creating room…' : state === 'error' ? 'Retry create' : 'Create Room';
  const joinLabel = state === 'joining' ? 'Opening room…' : state === 'join-error' ? 'Retry join' : 'Join Room';
  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={styles.title}>Otteroom</Text>
      <Text>Create a room to choose a movie together.</Text>
      <Text>Required voters</Text>
      <TextInput accessibilityLabel="Required voter count" value={requiredText}
        editable={!configurationLocked} keyboardType="number-pad" onChangeText={value => {
          if (!configurationLocked) { setRequiredText(value); setConfigurationError(undefined); }
        }} style={styles.input} />
      <Text>Will you vote?</Text>
      {[true, false].map(voting => {
        const choice = voting ? 'Yes, I will vote' : 'No, I will not vote';
        return <Pressable key={String(voting)} accessibilityRole="button" accessibilityLabel={choice}
          accessibilityState={{ selected: creatorIsVoter === voting, disabled: configurationLocked }}
          disabled={configurationLocked} onPress={() => {
            if (!configurationLocked) { setCreatorIsVoter(voting); setConfigurationError(undefined); }
          }} style={[styles.button, creatorIsVoter === voting && styles.selected]}><Text>{choice}</Text></Pressable>;
      })}
      {configurationError && <Text accessibilityLiveRegion="polite">{configurationError}</Text>}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 20 },
  title: { fontSize: 32, fontWeight: '600' },
  button: { padding: 16, borderWidth: 1, borderColor: '#2457A7', borderRadius: 8, alignSelf: 'flex-start' },
  selected: { backgroundColor: '#DCE9FF' },
  input: { borderWidth: 1, borderColor: '#555', borderRadius: 8, padding: 12, maxWidth: 360 },
});
