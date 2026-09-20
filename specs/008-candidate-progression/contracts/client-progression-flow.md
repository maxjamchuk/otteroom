# Contract: Client Candidate Progression Flow

**Feature**: 008 — Candidate Progression
**Status**: Approved contract for planned Expo client behavior; not implemented.
The client never owns resolution or candidate choice.

## Composition Boundary

The room route continues to compose:

1. recovered room membership/projection;
2. filter/common-resolution state;
3. the existing Feature 006 candidate service/hook;
4. the existing Feature 007 decision service/hook; and
5. one small progression-status presentation.

Feature 008 evolves these modules to share an authoritative sequence. It does
not add a second decision service, another candidate endpoint, a second
Realtime subscription or a Match route.

## Generation Keys

### Room progression generation

```text
(roomId, candidateSequence, candidateProgressionStatus)
```

Room projection merge rules are defined in
[room-progression-realtime.md](room-progression-realtime.md).

### Candidate request generation

```text
(roomId, candidateSequence, localRequestAttempt)
```

Candidate responses carry the database-confirmed candidate sequence for metadata
generation only. They never enter the room projection merge, never set room
progression/count, and never imply `0/N`. Every assigned/terminal response causes
a canonical room refetch. Metadata is rendered only if that projection still
names the same sequence in collecting/agreed; a late response for a retired
sequence/phase is discarded.

### Decision generation

```text
(roomId, candidateSequence, tmdbMovieId)
```

Every get/submit call includes all three values. A new sequence constructs a new
decision state even if the TMDB ID were ever the same. Old successes, failures
and in-flight gestures cannot act on the new occurrence.

## Room State to Client State

| Room progression | Candidate behavior | Decision behavior | Visible meaning |
| --- | --- | --- | --- |
| `inactive/pending` | Existing first-candidate acquisition | unavailable | Finding first movie |
| `inactive/no_candidates` | No acquisition | unavailable | Existing Feature 006 empty terminal |
| `collecting` | Recover/load metadata for this sequence | Recover own value; controls only for undecided voter | Candidate plus `x of N decisions collected` |
| `advancing` | Invoke same Edge endpoint for this sequence step | Old generation unavailable | Finding another movie or actionable source Retry |
| successor `collecting` | Render committed sequence `k+1` | New generation starts undecided at `0/N` | Shared next candidate |
| `agreed` | Recover same candidate metadata only | Read-only own recovery; no controls | Neutral agreement-stopped status |
| `exhausted` | No acquisition | unavailable | Stable no-further-candidate status and new-room action |

Metadata/poster loading and failure remain Feature 006 presentation substates.
They never change progression. On agreed metadata failure, stopped meaning still
remains visible while presentation Retry targets the same identity.

## Collecting Behavior

- Display the one authoritative candidate occurrence.
- Display safe progress from the room/RPC projection.
- A fixed voter may decide only after own-decision recovery proves they are
  undecided for this exact generation.
- A voter who already decided sees their immutable own value and no enabled
  alternative submission.
- A non-voting creator sees no decision controls.
- Threshold/outcome is not announced while incomplete, even if agreement is
  already inevitable or impossible.
- No source request for another candidate occurs while status is collecting.

## Final Decision Behavior

The UI does not optimistically declare agreement/rejection. It waits for the
strictly parsed RPC result or canonical room refetch.

### Agreed response

- Observe room `agreed` for the same sequence.
- Preserve the candidate card/identity.
- Remove/disable all decision controls.
- Render neutral text such as “Group agreement reached. Candidate selection has
  stopped.”
- Issue no candidate acquisition request.
- Provide no Match navigation, celebration, confirmation or post-match action.

### Rejected response

- Preserve the old own-decision confirmation only within the retiring response;
  do not keep it as current state.
- Observe room `advancing` for the same sequence with current count 0.
- Remove old candidate decision controls immediately.
- Invoke the existing candidate endpoint for that advancing step.
- Do not display a proposed candidate until the Edge response confirms a
  database-assigned winner.

### Lost response

- Show the existing actionable recovery state, not an optimistic outcome.
- Retry/get/refetch with the old generation.
- If it now returns `candidate_changed`, canonical refetch determines agreed,
  advancing, successor or exhausted state.
- Never resubmit the value against the successor automatically.

## Successor Behavior

On a committed `candidate_sequence = k+1`:

- retire all candidate image/request and decision callbacks for `k`;
- cache only the database-confirmed winning identity/metadata;
- refetch the canonical room projection before rendering the successor;
- render only when the canonical projection still permits sequence `k+1` as
  collecting/agreed;
- display the exact canonical decision count rather than assuming it remains 0;
- recover the caller's current decision for the occurrence (normally none at
  commit, but possibly already present when the candidate response was delayed);
- enable controls only after that recovery for a voter; and
- retain all prior decision rows exclusively as server-side history.

If the winning response was delayed while other voters decided, the observed
count may already be greater than zero and must not regress. If the successor has
already become advancing/exhausted or the room has reached a later sequence, the
old candidate result cannot restore its card, controls or count.

If a client missed multiple occurrences, it renders only the current higher
sequence from refetch. It does not animate or invent intermediate cards.

## Source Failure and Retry

While the durable room state remains `advancing`:

- pending request: announce “Finding another movie…”;
- 503/network/strict-parse failure: announce a generic retryable inability to
  continue and expose one accessible Retry control;
- Retry calls the same endpoint for the same room; server preflight recovers the
  step/current winner;
- no decision controls or old candidate card is active; and
- raw provider/system detail is not rendered.

Reload may briefly return to pending acquisition before the source fails again;
the durable meaning remains the same advancing step.

## Exhaustion Behavior

When room state is `exhausted`:

- render a neutral, accessible “No further eligible movies were found for this
  selection” meaning;
- render no candidate card as active and no decision controls;
- render no acquisition Retry, because the committed bounded attempt completed;
- retain an action to start a new room/selection session through existing
  navigation; and
- issue no automatic or user-triggered source request in this room.

The copy must distinguish exhaustion from agreement and transient source
failure. It must not call it a match.

## Stale Client Behavior

An old tab may still show candidate `k`. Any interaction:

- carries expected sequence `k` and old TMDB ID;
- cannot be retargeted locally;
- receives `candidate_changed` or `refresh_required` after authority moves;
- retires its old generation;
- refetches the room; and
- converges on agreed `k`, successor `k+1+`, advancing or exhausted.

Late old candidate metadata, poster success/failure, decision success/failure,
source success/failure and pending states are ignored after generation changes.

## Reload, Reconnect and Re-entry

The same local Auth identity remains the recovery boundary. On route recovery:

- use create/join/re-entry result plus exact room refetch;
- rebind the one rooms subscription;
- reconstruct candidate/decision generation from canonical sequence;
- recover metadata for collecting/agreed;
- recover only the caller's current own decision;
- resume the same advancing source step if applicable; and
- preserve agreed/exhausted terminals without relying on an earlier event.

No prior decision is replayed as part of recovery.

## Accessibility

- State text does not rely only on color, animation, poster imagery or gesture.
- Pending/acquisition/decision status uses existing accessible live-region
  semantics where applicable.
- Retry and start-new-room actions have explicit labels, roles and minimum
  existing control dimensions.
- Agreed/exhausted states remove disabled-looking active swipe targets rather
  than leaving an ambiguous gesture surface.
- Reduced-motion behavior from Feature 007 remains; progression adds no
  celebration animation.

## Fail-Closed Client Integrity

Withhold candidate/decision/source action and show a generic reload/retry state
if any strict contract sees:

- illegal room progression/acquisition/count combination;
- projection nodes that are incomparable under the complete monotonic merge
  lattice, including an older terminal that could not precede a newer sequence;
- candidate response sequence inconsistent with room authority;
- assigned metadata with a different TMDB identity for the same generation;
- decision result count/outcome/threshold contradiction; or
- malformed/extra/missing fields.

The client never repairs such contradictions by decrementing counts, dropping a
voter, choosing a candidate or recalculating agreement.

## Explicitly Absent

- Match route/screen/card/celebration/confirmation;
- configurable agreement or difficulty controls;
- early outcome copy or early source request;
- decision change/retraction;
- membership management;
- client-side yes tally/threshold authority;
- local candidate ordering/deck; and
- direct writes to room, occurrence or decision tables.
