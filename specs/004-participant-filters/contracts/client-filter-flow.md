# Contract: Client Participant Filter Flow

## Route ownership

`app/room/[code].tsx` retains Feature 003 canonical routing, one join/recovery
flight, stale-code invalidation, invitation behavior and one rooms subscription.
After an accepted room projection, it delegates only the Feature 004 filter
surface. It imports no candidate hook/card.

Recommended feature-local boundary:

```text
src/filters/genres.ts
src/filters/contracts.ts
src/filters/service.ts
src/filters/state.ts
src/filters/use-participant-filter.ts
src/filters/participant-filter-form.tsx
```

No new state/form library is required. React/React Native primitives support the
19 toggles, two numeric inputs, save/retry and accessible status text.

## Canonical UI model

The model contains:

```text
roomId + request generation
membership Waiting/Ready
isVoter
authoritative filterCompletedCount / requiredVoterCount
ownRecovery: inactive | loading | absent | saved | locked | error
accepted: canonical genres + inclusive years | null
draft: genres + from/to text
submission: idle | submitting | validation-error | error
```

`accepted` changes only from an exact validated RPC result. `draft` may change
locally and is never counted or labelled saved. A failed or invalid replacement
preserves `accepted`; recovery/retry can deliberately reset the draft from it.
No optimistic room progress is permitted.

## Phase derivation and rendering

1. `room.state === 'waiting'`: show membership assembly and voter count. Do not
   recover/submit filters. Invitations remain per Feature 003. No candidate.
2. Ready + non-voter + X<N: show progress X/N and waiting explanation only.
3. Ready + voter + recovery loading/error: show progress plus bounded recovery
   status/retry; do not guess defaults as authoritative while recovery is unknown.
4. Ready + voter + no accepted row + X<N: editable defaults (Any,
   1900..server-returned `allowed_release_year_max`).
5. Ready + voter + accepted row + X<N: show saved/waiting, X/N and allow own
   replacement. Clearly separate current accepted summary from unsaved draft.
6. Ready + X=N: all members see filters collected and Feature 005 is next, with
   no automatic continuation. Once recovered, voters see only their own accepted
   values read-only. If own recovery is still loading/failed, show a separate
   read-only detail loading/error and retry; never expose defaults or reopen editing.

## Interaction rules

- Genre controls expose all 19 labels, selected state and an accessible Any
  meaning when none is selected. Empty does not visually select every genre.
- Year fields are explicit and required. The full default is populated only for
  a new local draft; it does not submit automatically.
- Save is guarded synchronously against duplicate taps and disabled while the
  one request is active or room synchronization is degraded. Effect replay
  shares the same promise. Existing accepted values and draft are preserved.
- Local validation uses the same fixed vocabulary/current-year/inclusive rules
  and yields specific corrective text. The server result remains final.
- `saved`/`unchanged` adopts canonical returned values and count. A saved voter
  sees that they are waiting for the others while X<N.
- `locked` discards any claim that the attempted draft was accepted, adopts the
  returned authoritative own values and renders read-only completion.
- If aggregate N/N arrives during an active save, disable editing immediately but
  keep the request alive. Its response may adopt own detail as `saved` (the edit
  serialized first) or `locked` (the final other-voter save serialized first),
  but can never lower progress or unlock the form.
- Generic transport failure keeps both last accepted values and the explicit
  draft; Retry resubmits deliberately or Recover re-reads, without a new Auth ID.
- Route A→B→A and retired requests cannot show another room's draft, accepted
  values, progress or errors for one frame.

## Privacy and accessibility

The UI displays no member/Auth/filter-row UUID, participant roster, per-person
completion marker or another voter's genres/years. A non-voting creator never
mounts form/detail requests. Progress text is the same X/N for all room members.

Use mobile-first scrollable layout, minimum practical touch targets, accessible
button/checkbox semantics, labels for both years, live-region status/error text
and a web-functional keyboard path. Native export proves module compatibility;
physical-device UX remains a supplemental manual check, not replaced by web E2E.

## Recovery and synchronization

- Reload/link/QR/code same-identity entry first recovers Feature 003 membership
  and aggregate from join, then own filter for voters when Ready.
- Reconnect uses the existing Auth identity and rooms subscription. It neither
  creates a member/filter nor excludes a disconnected voter from N.
- A missed room UPDATE is recovered on Realtime system-ok refetch.
- A lost submit response is recovered through the read RPC or equal retry; the
  client never inserts an extra completion locally.
- Room synchronization retry and own-filter recovery/submission retry are
  separate controls and do not discard one another's last accepted state.
- Join, refetch, own recovery and submit responses feed one route-level monotonic
  X/N watermark. Any exact validated response may advance it, none may regress
  it, and N/N dominates delayed X<N; own details use a separate generation guard.

## Component/integration evidence

Unit/integration tests cover exact enum/order/defaults, draft-versus-accepted,
all validation boundaries, one-flight/retry, stale generations, saved edits,
locked adoption, both active-save/N/N response orders, N/N during own recovery,
non-voter no-call, Waiting no-call, sync-error save disabling, monotonic X/N and
no candidate import/call/render. Web acceptance groups complete workflows as
specified in quickstart.md; static text or mock invocation alone is insufficient.
