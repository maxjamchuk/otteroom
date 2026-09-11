import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { CandidateCard } from '../../src/candidates/candidate-card';
import { useRoomCandidate } from '../../src/candidates/use-room-candidate';
import { invitationLink, parseRoomSegment } from '../../src/rooms/code';
import { InvitationQr } from '../../src/rooms/invitation-qr';
import { joinRoom } from '../../src/rooms/service';
import { joinRoomState, joinErrorState, malformedInvitationState, type AcceptedRoomState } from '../../src/rooms/state';
import { useRoomSubscription } from '../../src/rooms/use-room-subscription';

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
    <ScrollView contentContainerStyle={styles.container}>
      {!route ? <Text accessibilityLiveRegion="polite">{malformedInvitationState().message}</Text>
        : failedPath === path ? <>
          <Text accessibilityLiveRegion="polite">{joinErrorState().message}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Retry room" onPress={() => {
            try { router.replace(route.path); setFailedPath(undefined); } catch { /* Remain recoverable. */ }
          }}><Text>Retry room</Text></Pressable>
        </> : replace ? <Text accessibilityLiveRegion="polite">Loading room…</Text>
          : <RoomEntry key={route.code} code={route.code} />}
      <Link href="/" replace style={styles.link}>Back to home</Link>
    </ScrollView>
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
      setState(mapped.kind === 'accepted' && (mapped.isCreator || mapped.state === 'waiting')
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
  return <AcceptedRoom initial={state} />;
}

function AcceptedRoom({ initial }: { initial: AcceptedRoomState & { invitation?: string } }) {
  const { room, error, retry, retrying } = useRoomSubscription(initial);
  // An accepted RPC is immediately visible, including intermediate Waiting counts.
  const state = room ?? initial;
  const candidate = useRoomCandidate(state);
  const invitation = state.isCreator || state.state === 'waiting' ? initial.invitation : undefined;
  return <>
    <Text accessibilityRole="header" style={styles.title}>{state.title}</Text>
    <Text accessibilityLabel="Room code" selectable>{state.code}</Text>
    <Text>{state.voterCount} of {state.requiredVoterCount} voters</Text>
    {state.isCreator && <Text>{state.isVoter
      ? 'You created this room and are voting.'
      : 'You created this room and are not voting.'}</Text>}
    {state.state === 'waiting' && <Text>Waiting for the voting group.</Text>}
    {invitation && <>
      <Text accessibilityLabel="Invitation link" selectable>{invitation}</Text>
      <InvitationQr value={invitation} />
    </>}
    {error && <>
      <Text accessibilityLiveRegion="polite">Unable to synchronize this room. Please try again.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Retry synchronization" disabled={retrying} onPress={retry}>
        <Text>{retrying ? 'Reconnecting…' : 'Retry synchronization'}</Text>
      </Pressable>
    </>}
    <CandidateCard model={candidate} />
  </>;
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 20 },
  title: { fontSize: 28, fontWeight: '600' },
  link: { color: '#2457A7', fontSize: 18, paddingVertical: 12 },
});
