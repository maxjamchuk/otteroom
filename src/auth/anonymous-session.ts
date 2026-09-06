import type { Session } from '@supabase/supabase-js';
import { getSupabase, hasPersistedSession } from '../lib/supabase';

export class SessionBootstrapError extends Error {
  readonly category: 'auth-budget' | 'session-recovery';
  readonly status: number | undefined;

  constructor(status?: number) {
    super('Unable to restore your local session. Please try again.');
    this.name = 'SessionBootstrapError';
    this.status = status;
    this.category = status === 429 ? 'auth-budget' : 'session-recovery';
  }
}

let flight: Promise<Session> | undefined;
let previouslyPersisted = false;

function failure(error: unknown): SessionBootstrapError {
  const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined;
  return new SessionBootstrapError(typeof status === 'number' && status >= 400 && status <= 599 ? status : undefined);
}

export function bootstrapAnonymousSession(): Promise<Session> {
  if (flight) return flight;
  flight = Promise.resolve().then(async () => {
    // Read before the SDK can run recovery. Storage failure is not absence.
    previouslyPersisted = hasPersistedSession() || previouslyPersisted;
    const client = getSupabase();
    const restored = await client.auth.getSession();
    if (restored.error) throw restored.error;
    if (restored.data.session) {
      if (!restored.data.session.user?.id) throw new SessionBootstrapError();
      previouslyPersisted = true;
      return restored.data.session;
    }
    if (previouslyPersisted) throw new SessionBootstrapError();
    const signedIn = await client.auth.signInAnonymously();
    if (signedIn.error) throw signedIn.error;
    if (!signedIn.data.session?.user.id) throw new SessionBootstrapError();
    previouslyPersisted = true;
    return signedIn.data.session;
  }).catch(error => { throw failure(error); }).finally(() => { flight = undefined; });
  return flight;
}

// Future protected operations use this same bootstrap, not a second Auth client.
export async function withParticipant<T>(action: (session: Session) => T | Promise<T>): Promise<T> {
  const session = await bootstrapAnonymousSession();
  return action(session);
}
