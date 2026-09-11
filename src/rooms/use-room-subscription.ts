import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { bootstrapAnonymousSession } from '../auth/anonymous-session';
import { getSupabase } from '../lib/supabase';
import { refetchRoom } from './service';
import { applyRoomFilterProgress, applyRoomRefetch, type AcceptedRoomState } from './state';

// Owned by one accepted route, never a global room cache. The RPC model stays
// stable as input, including creator/voter flags and target. Authoritative reads
// advance voter counts only through applyRoomRefetch in this lifecycle.
export function useRoomSubscription(accepted: AcceptedRoomState | null) {
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState({ source: accepted, room: accepted, error: false, retrying: false });
  const generation = useRef(0), sequence = useRef(0), retryFlight = useRef(false);
  const lastAccepted = useRef<{ source: AcceptedRoomState; room: AcceptedRoomState } | null>(null);
  // Await retiring channels before replacement, including effect replay. Failed
  // removal is retried explicitly; never create a second channel over a failed one.
  const removePrevious = useRef<() => Promise<void>>(() => Promise.resolve());

  useEffect(() => {
    if (!accepted) return;
    const owner = accepted, id = owner.id, lifecycle = ++generation.current;
    let disposed = false, channel: RealtimeChannel | undefined;
    let client: ReturnType<typeof getSupabase> | undefined;
    let active = false, pending = false, bound = false, latest = 0;
    let room = lastAccepted.current?.source === owner ? lastAccepted.current.room : owner;
    const current = () => !disposed && generation.current === lifecycle;
    const invalidate = () => { disposed = true; ++generation.current; ++sequence.current; bound = false; pending = false; };
    const publish = (error: boolean, retrying = false) => {
      if (current()) {
        lastAccepted.current = { source: owner, room };
        setView({ source: owner, room, error, retrying });
      }
    };
    const failure = () => {
      if (!current()) return;
      retryFlight.current = false; publish(true);
    };
    const read = async () => {
      active = true; pending = false;
      const request = latest;
      try {
        const row = await refetchRoom(id);
        if (current() && bound && request === latest) {
          const watermark = lastAccepted.current?.source === owner ? lastAccepted.current.room : room;
          room = applyRoomRefetch(watermark, row);
          retryFlight.current = false; publish(false);
        }
      } catch { if (current() && bound && request === latest) failure(); }
      finally {
        active = false;
        if (current() && bound && pending) void read();
      }
    };
    const schedule = () => {
      if (!current() || !bound) return;
      latest = ++sequence.current;
      if (active) pending = true;
      else void read();
    };
    const start = async () => {
      try {
        await removePrevious.current();
        if (!current()) return;
        await bootstrapAnonymousSession();
        if (!current()) return;
        client = getSupabase();
        channel = client.channel(`room:${id}`);
        const degraded = () => {
          bound = false; pending = false; latest = ++sequence.current; failure();
        };
        channel.on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${id}`, select: ['id'],
        }, () => schedule()).on('system', {}, (payload: unknown) => {
          // Both listeners are installed before subscribe. A join acknowledgement
          // is transport-only on the pinned server, not an active DB binding.
          if (!current() || !payload || typeof payload !== 'object' ||
            !('extension' in payload) || payload.extension !== 'postgres_changes' ||
            !('status' in payload)) return;
          if (payload.status === 'ok') { bound = true; schedule(); }
          else if (payload.status === 'error') degraded();
          // Keep server retries alive; never log/render raw system details.
        }).subscribe(status => {
          if (!current()) return;
          if (status === 'SUBSCRIBED') { /* Transport joined only. Await system-ok. */ }
          else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            degraded();
          }
        });
      } catch { failure(); }
    };
    void start();
    return () => {
      // Invalidate synchronously BEFORE removeChannel can emit CLOSED or resolve.
      invalidate();
      if (channel && client) {
        const old = channel, shared = client;
        let removal: Promise<void> | undefined;
        removePrevious.current = () => {
          if (!removal) removal = Promise.resolve().then(() => shared.removeChannel(old)).then(status => {
            if (status !== 'ok') throw new Error('Room subscription cleanup failed.');
          }).catch(() => { removal = undefined; throw new Error('Room subscription cleanup failed.'); });
          return removal;
        };
        // No raw errors/logs after unmount; a subsequent setup awaits this same
        // operation and cannot silently bypass a failed cleanup.
        void removePrevious.current().catch(() => {});
      }
    };
  }, [accepted, attempt]);

  const visible = view.source === accepted ? view : { room: accepted, error: false, retrying: false };
  const retry = useCallback(() => {
    if (!accepted || !visible.error || retryFlight.current) return;
    retryFlight.current = true;
    setView(previous => ({ ...previous, retrying: true }));
    setAttempt(value => value + 1);
  }, [accepted, visible.error]);
  const observeFilterProgress = useCallback((count: number) => {
    if (!accepted) return;
    setView(previous => {
      if (previous.source !== accepted || !previous.room) return previous;
      let room: AcceptedRoomState;
      try { room = applyRoomFilterProgress(previous.room, count); }
      catch { return previous; }
      if (room === previous.room) return previous;
      lastAccepted.current = { source: accepted, room };
      return { ...previous, room };
    });
  }, [accepted]);
  return { room: visible.room, error: visible.error, retrying: visible.retrying, retry, observeFilterProgress };
}
