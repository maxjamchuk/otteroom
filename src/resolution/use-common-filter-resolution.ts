import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RoomResolutionStatus } from '../rooms/contracts';
import type { AcceptedRoomState } from '../rooms/state';
import { resolveCommonFilters } from './service';
import {
  createResolutionState, failResolution, receiveResolutionResult, retryResolution,
  sameResolutionRequest, syncResolutionRoom, type CommonFilterResolutionState,
  type ResolutionRequest,
} from './state';

type ResolutionFlight = { request: ResolutionRequest; promise: ReturnType<typeof resolveCommonFilters> };

export type CommonFilterResolutionModel = CommonFilterResolutionState & {
  retry: () => void;
};

export function useCommonFilterResolution(room: AcceptedRoomState | null,
  observeStatus?: (status: RoomResolutionStatus) => void): CommonFilterResolutionModel {
  const [model, setModel] = useState(() => createResolutionState(room));
  const stateRef = useRef(model);
  const flightRef = useRef<ResolutionFlight | null>(null);
  const observerRef = useRef(observeStatus);

  let state = syncResolutionRoom(model, room);
  if (state !== model) setModel(state);
  useLayoutEffect(() => { stateRef.current = state; observerRef.current = observeStatus; },
    [observeStatus, state]);

  const update = useCallback((change: (current: CommonFilterResolutionState) =>
    CommonFilterResolutionState) => {
    const next = change(stateRef.current);
    stateRef.current = next;
    setModel(next);
  }, []);

  const { request, attempt } = state;
  useEffect(() => {
    if (attempt !== 'resolving' || request.roomId === null) return;
    let disposed = false;
    if (!flightRef.current || !sameResolutionRequest(flightRef.current.request, request)) {
      flightRef.current = { request, promise: resolveCommonFilters(request.roomId) };
    }
    const flight = flightRef.current;
    void flight.promise.then(result => {
      if (disposed) return;
      update(current => receiveResolutionResult(current, request, result));
      if (result.filter_resolution_status === 'compatible' ||
          result.filter_resolution_status === 'incompatible') {
        observerRef.current?.(result.filter_resolution_status);
      }
    }, () => { if (!disposed) update(current => failResolution(current, request)); });
    return () => { disposed = true; };
  }, [attempt, request, update]);

  const retry = useCallback(() => update(retryResolution), [update]);
  return { ...state, retry };
}
