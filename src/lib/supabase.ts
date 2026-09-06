import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readPublicEnv } from '../config/env';
import type { Database } from '../types/database.generated';
import { authStorage } from './auth-storage';

let client: SupabaseClient<Database> | undefined;

// Lazy construction: module evaluation/static export never starts Auth.
export function getSupabase(): SupabaseClient<Database> {
  if (!client) {
    const { url, publishableKey } = readPublicEnv();
    client = createClient<Database>(url, publishableKey, {
      auth: { storage: authStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  }
  return client;
}

// Read before construction/recovery: a failed SDK recovery must never be
// mistaken for an initially empty store and silently replace the participant.
export function hasPersistedSession(): boolean {
  const { url } = readPublicEnv();
  const key = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
  return authStorage.getItem(key) !== null;
}
