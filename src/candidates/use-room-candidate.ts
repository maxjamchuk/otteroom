import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { AcceptedRoomState } from '../rooms/state';
import type { CandidateResult } from './contracts';
import { ensureRoomCandidate } from './service';
import { candidateMessage, createCandidateState, failCandidate, finishPoster,
  observeAuthoritativeStatus, receiveCandidate, retryCandidate, sameCandidateImage,
  sameCandidateRequest, type CandidateImage, type CandidateRequest } from './state';

function roomEligibility(room: AcceptedRoomState | null): boolean {
  return !!room && room.state === 'ready' && room.filtersComplete &&
    room.filterResolutionStatus === 'compatible' && !room.resolutionIntegrityError &&
    !room.candidateIntegrityError;
}

// The existing rooms-only subscription owns canonical invalidation. This hook
// owns one generation-scoped Edge flight and never creates another channel.
export function useRoomCandidate(room: AcceptedRoomState | null) {
  const id = room?.id ?? null;
  const eligible = roomEligibility(room);
  const authority = room?.candidateAcquisitionStatus ?? 'pending';
  const integrity = !!room?.candidateIntegrityError || !!room?.resolutionIntegrityError;
  const [model, setModel] = useState(() => createCandidateState(id, eligible, authority));
  const flight = useRef<{ request: CandidateRequest; promise: Promise<CandidateResult> } | null>(null);
  const activeImage = useRef<CandidateImage | null>(null);

  let state = model;
  if (model.roomId !== id) {
    state = createCandidateState(id, eligible, authority, model.generation + 1);
    setModel(state);
  } else {
    const observed = observeAuthoritativeStatus(model, eligible, authority, integrity);
    if (observed !== model) { state = observed; setModel(observed); }
  }

  const { roomId, generation, requestAttempt, imageAttempt } = state;
  const image = useMemo(() => ({ roomId, generation, requestAttempt, imageAttempt }),
    [roomId, generation, requestAttempt, imageAttempt]);
  useLayoutEffect(() => {
    activeImage.current = image;
    return () => { if (activeImage.current === image) activeImage.current = null; };
  }, [image]);

  const requesting = (state.attempt === 'acquiring' || state.attempt === 'loading-metadata') &&
    eligible && roomId !== null;
  useEffect(() => {
    if (!requesting || roomId === null) return;
    const request = { roomId, generation, requestAttempt };
    let disposed = false;
    if (!flight.current || !sameCandidateRequest(flight.current.request, request))
      flight.current = { request, promise: (async () => ensureRoomCandidate(roomId))() };
    void flight.current.promise.then(result => {
      if (!disposed) setModel(previous => receiveCandidate(previous, request, result));
    }, () => {
      if (!disposed) setModel(previous => failCandidate(previous, request));
    });
    return () => { disposed = true; };
  }, [requesting, roomId, generation, requestAttempt, eligible]);

  const posterUrl = state.candidate?.posterUrl;
  const posterSource = useMemo(() => posterUrl ? { uri: posterUrl } : null, [posterUrl]);
  const retry = useCallback(() => {
    if (!activeImage.current || !sameCandidateImage(activeImage.current, image)) return;
    setModel(previous => sameCandidateImage(previous, image) ? retryCandidate(previous) : previous);
  }, [image]);
  const onLoad = useCallback(() => {
    if (!activeImage.current || !sameCandidateImage(activeImage.current, image)) return;
    setModel(previous => finishPoster(previous, image, true));
  }, [image]);
  const onError = useCallback(() => {
    if (!activeImage.current || !sameCandidateImage(activeImage.current, image)) return;
    setModel(previous => finishPoster(previous, image, false));
  }, [image]);

  return { ...state, status: state.attempt, message: candidateMessage(state), posterSource,
    imageKey: `${generation}:${requestAttempt}:${imageAttempt}`, retry, onLoad, onError };
}
