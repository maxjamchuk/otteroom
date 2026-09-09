import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { AcceptedRoomState } from '../rooms/state';
import type { CandidateResult } from './contracts';
import { resolveCandidatePoster } from './posters';
import { ensureRoomCandidate } from './service';
import { candidateMessage, createCandidateState, failCandidate, finishPoster, receiveCandidate,
  retryCandidate, sameCandidateImage, sameCandidateRequest, type CandidateImage, type CandidateRequest } from './state';

// One accepted-room consumer owns these promises and generations. Realtime
// supplies the existing room projection; this hook owns no channel or Auth client.
export function useRoomCandidate(room: AcceptedRoomState | null) {
  const id = room?.id ?? null, ready = room?.state === 'ready';
  const [model, setModel] = useState(() => createCandidateState(id, ready));
  const flight = useRef<{ request: CandidateRequest; promise: Promise<CandidateResult> } | null>(null);
  const activeImage = useRef<CandidateImage | null>(null);

  // Adjust local state during render so a changed room cannot expose one frame
  // of retired metadata. A → B → A receives a new generation as well.
  let state = model;
  if (model.roomId !== id || model.ready !== ready) {
    state = createCandidateState(id, ready, model.generation + 1);
    setModel(state);
  }
  const { roomId, generation, requestAttempt, posterAttempt } = state;
  const image = useMemo(() => ({ roomId, generation, requestAttempt, posterAttempt }),
    [roomId, generation, requestAttempt, posterAttempt]);
  useLayoutEffect(() => {
    activeImage.current = image;
    return () => { if (activeImage.current === image) activeImage.current = null; };
  }, [image]);

  const acquiring = state.status === 'loading' && !state.candidate && ready && roomId !== null;
  useEffect(() => {
    if (!acquiring || roomId === null) return;
    const request = { roomId, generation, requestAttempt };
    let disposed = false;
    if (!flight.current || !sameCandidateRequest(flight.current.request, request)) {
      // Retain this exact promise across setup/cleanup replay. Async wrapping
      // also turns a synchronous transport failure into the same safe state.
      flight.current = { request, promise: (async () => ensureRoomCandidate(roomId))() };
    }
    void flight.current.promise.then(result => {
      if (!disposed) setModel(previous => receiveCandidate(previous, request, result));
    }, () => {
      if (!disposed) setModel(previous => failCandidate(previous, request));
    });
    return () => { disposed = true; };
  }, [acquiring, roomId, generation, requestAttempt]);

  const posterKey = state.candidate?.poster_key;
  const poster = useMemo(() => {
    let source: ReturnType<typeof resolveCandidatePoster> | null = null, failed = false;
    if (posterKey) {
      try { source = resolveCandidatePoster(posterKey); }
      catch { failed = true; }
    }
    // This descriptor owns one image attempt, including its same-source retry.
    return { source, failed, attempt: posterAttempt };
  }, [posterKey, posterAttempt]);
  const visible = poster.failed ? failCandidate(state, image) : state;

  const retry = useCallback(() => {
    if (!activeImage.current || !sameCandidateImage(activeImage.current, image)) return;
    setModel(previous => sameCandidateImage(previous, image)
      ? retryCandidate(poster.failed ? failCandidate(previous, image) : previous) : previous);
  }, [image, poster.failed]);
  const onLoad = useCallback(() => {
    if (poster.source === null || !activeImage.current || !sameCandidateImage(activeImage.current, image)) return;
    setModel(previous => finishPoster(previous, image, true));
  }, [image, poster.source]);
  const onError = useCallback(() => {
    if (!activeImage.current || !sameCandidateImage(activeImage.current, image)) return;
    setModel(previous => finishPoster(previous, image, false));
  }, [image]);

  return { ...visible, message: candidateMessage(visible), posterSource: poster.source,
    imageKey: `${generation}:${requestAttempt}:${poster.attempt}`, retry, onLoad, onError };
}
