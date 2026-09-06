import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { bootstrapAnonymousSession } from '../src/auth/anonymous-session';
import { getSupabase } from '../src/lib/supabase';

export default function RootLayout() {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    let release = () => {};
    void bootstrapAnonymousSession().then(() => {
      if (!current) return;
      const { auth } = getSupabase();
      const { data } = auth.onAuthStateChange(event => {
        // Never automatically replace an identity lost during recovery/refresh.
        if (current && event === 'SIGNED_OUT') setState('error');
      });
      const updateRefresh = (value: string) => {
        if (value === 'active') void auth.startAutoRefresh();
        else void auth.stopAutoRefresh();
      };
      const listener = Platform.OS !== 'web' ? AppState.addEventListener('change', updateRefresh) : undefined;
      if (Platform.OS !== 'web') updateRefresh(AppState.currentState);
      release = () => {
        data.subscription.unsubscribe(); listener?.remove();
        if (Platform.OS !== 'web') void auth.stopAutoRefresh();
      };
      setState('ready');
    }).catch(() => { if (current) setState('error'); });
    return () => { current = false; release(); };
  }, [attempt]);

  if (state !== 'ready') return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>Otteroom</Text>
      <Text accessibilityLiveRegion="polite">
        {state === 'loading' ? 'Restoring local session…' : 'Unable to restore your local session. Please try again.'}
      </Text>
      {state === 'error' && (
        <Pressable accessibilityRole="button" accessibilityLabel="Retry session" onPress={() => { setState('loading'); setAttempt(value => value + 1); }}>
          <Text>Retry session</Text>
        </Pressable>
      )}
    </View>
  );
  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 20 },
  title: { fontSize: 32, fontWeight: '600' },
});
