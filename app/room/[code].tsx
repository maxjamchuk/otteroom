import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { invitationLink, parseRoomSegment } from '../../src/rooms/code';
import { joinRoom } from '../../src/rooms/service';
import { joinRoomState, joinErrorState, malformedInvitationState } from '../../src/rooms/state';

export default function RoomRouteScreen() {
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const route = parseRoomSegment(params.code);
  const path = route?.path;
  const replace = route?.replace;
  const [failedPath, setFailedPath] = useState<string>();
  useEffect(() => {
    if (!replace || !path) return;
    let current = true;
    // Schedule navigation after this commit; cancelled effect replays do nothing.
    void Promise.resolve().then(() => { if (current) router.replace(path); })
      .catch(() => { if (current) setFailedPath(path); });
    return () => { current = false; };
  }, [path, replace]);

  return (
    <View style={styles.container}>
      {!route ? <Text accessibilityLiveRegion="polite">{malformedInvitationState().message}</Text>
        : failedPath === path ? <>
          <Text accessibilityLiveRegion="polite">{joinErrorState().message}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Retry room" onPress={() => {
            try { router.replace(route.path); setFailedPath(undefined); } catch { /* Remain recoverable. */ }
          }}><Text>Retry room</Text></Pressable>
        </> : replace ? <Text accessibilityLiveRegion="polite">Loading room…</Text>
          : <RoomEntry key={route.code} code={route.code} />}
      <Link href="/" replace style={styles.link}>Back to home</Link>
    </View>
  );
}

// A canonical-code key is the route generation boundary: changing code removes
// the old projection during render, before its effect cleanup. No shared cache.
function RoomEntry({ code }: { code: string }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<(ReturnType<typeof joinRoomState> & { invitation?: string }) | ReturnType<typeof joinErrorState> | { kind: 'loading' }>({ kind: 'loading' });
  const flight = useRef<{ attempt: number; promise: ReturnType<typeof joinRoom> } | null>(null);
  useEffect(() => {
    let current = true;
    // Keep the promise across React effect replay, but never across code keys
    // or explicit retries. Cleanup invalidates every old async callback.
    if (!flight.current || flight.current.attempt !== attempt) {
      flight.current = { attempt, promise: joinRoom(code) };
    }
    void flight.current.promise.then(result => {
      if (!current) return;
      if ((result.outcome === 'joined' || result.outcome === 'already_member') && result.room_code !== code) {
        setState(joinErrorState()); return;
      }
      const mapped = joinRoomState(result);
      setState(mapped.kind === 'accepted' && mapped.state === 'waiting'
        ? { ...mapped, invitation: invitationLink(mapped.code) } : mapped);
    }).catch(() => { if (current) setState(joinErrorState()); });
    return () => { current = false; };
  }, [code, attempt]);

  if (state.kind === 'loading') return <Text accessibilityLiveRegion="polite">Loading room…</Text>;
  if (state.kind !== 'accepted') return <>
    <Text accessibilityLiveRegion="polite">{state.message}</Text>
    {state.kind === 'error' && <Pressable accessibilityRole="button" accessibilityLabel="Retry room" onPress={() => {
      setState({ kind: 'loading' }); setAttempt(value => value + 1);
    }}><Text>Retry room</Text></Pressable>}
  </>;
  return <>
    <Text accessibilityRole="header" style={styles.title}>{state.title}</Text>
    <Text accessibilityLabel="Room code" selectable>{state.code}</Text>
    <Text>{state.count} of 2</Text>
    {state.state === 'waiting' && <>
      <Text>Waiting for the second participant.</Text>
      <Text accessibilityLabel="Invitation link" selectable>{state.invitation}</Text>
    </>}
  </>;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 20 },
  title: { fontSize: 28, fontWeight: '600' },
  link: { color: '#2457A7', fontSize: 18, paddingVertical: 12 },
});
