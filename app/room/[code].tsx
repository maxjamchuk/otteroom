import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { invitationLink, normalizeRoomCode } from '../../src/rooms/code';
import { joinRoom } from '../../src/rooms/service';
import { acceptedRoomState, type AcceptedRoomState } from '../../src/rooms/state';

export default function RoomRouteScreen() {
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const code = normalizeRoomCode(params.code);
  const [state, setState] = useState<(AcceptedRoomState & { invitation: string }) | { kind: 'loading' | 'error' }>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!code) return;
    let current = true;
    // No create-result cache or navigation payload: recover from the authority.
    void joinRoom(code).then(result => {
      if (!current) return;
      if (result.outcome !== 'already_member' || result.participant_role !== 'host' || result.room_code !== code) {
        setState({ kind: 'error' });
        return;
      }
      setState({ ...acceptedRoomState(result), invitation: invitationLink(result.room_code) });
    }).catch(() => { if (current) setState({ kind: 'error' }); });
    return () => { current = false; };
  }, [code, attempt]);
  const failed = !code || state.kind === 'error';
  return (
    <View style={styles.container}>
      {failed ? <>
        <Text accessibilityLiveRegion="polite">Unable to open this room. Please try again.</Text>
        {code && <Pressable accessibilityRole="button" accessibilityLabel="Retry room" onPress={() => {
          setState({ kind: 'loading' }); setAttempt(value => value + 1);
        }}><Text>Retry room</Text></Pressable>}
      </> : state.kind === 'accepted' ? <>
        <Text accessibilityRole="header" style={styles.title}>{state.title}</Text>
        <Text accessibilityLabel="Room code" selectable>{state.code}</Text>
        <Text>{state.count} of 2</Text>
        {state.state === 'waiting' && <>
          <Text>Waiting for the second participant.</Text>
          <Text accessibilityLabel="Invitation link" selectable>{state.invitation}</Text>
        </>}
      </> : <Text accessibilityLiveRegion="polite">Loading room…</Text>}
      <Link href="/" replace style={styles.link}>Back to home</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 20 },
  title: { fontSize: 28, fontWeight: '600' },
  link: { color: '#2457A7', fontSize: 18, paddingVertical: 12 },
});
