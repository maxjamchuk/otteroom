# Contract: Client Decision Flow

**Feature**: 007 — Swipe Decisions

**Planned module**: `src/decisions`

## Inputs and Authority Key

The decision hook receives validated room identity/role state and Feature 006's
candidate presentation. Its authority key is:

```ts
type DecisionGeneration = {
  roomId: string;
  tmdbMovieId: number;
};
```

Every asynchronous recovery, submission and room-refetch result captures this
key. It may change only when the route room or authoritative candidate changes.
Results for an inactive key are ignored and cannot alter controls, messages or
stored local authority.

## Candidate Eligibility

Controls may be active only when all are true:

- the room projection is valid and fixed assembly is complete;
- candidate acquisition is authoritatively `assigned`;
- a validated positive `tmdbMovieId` is available;
- the caller is a fixed voter; and
- private recovery for the active generation completed as `not_decided`.

Recognizable candidate presentations that retain controls:

- `loading-poster`;
- `available`;
- `poster-error`; and
- `no-poster`.

Presentations that withhold controls:

- acquiring candidate;
- loading candidate metadata;
- candidate metadata error;
- authoritative no-candidates;
- candidate or room integrity error; and
- authorized non-voting observer.

A poster failure never creates a new decision target. A metadata failure means
the minimum recognizable decision surface is unavailable, so the client must
not ask for a choice based only on a numeric ID.

## Local States

| State | Meaning | Control behavior |
| --- | --- | --- |
| `unavailable` | No eligible voter/candidate target. | No active Yes/No controls. |
| `recovering` | Private read for the active generation is in flight. | Disabled; no undecided claim. |
| `undecided` | Authority confirmed no stored value. | Swipe and buttons enabled. |
| `submitting` | Exactly one chosen value is in flight. | Controls disabled; gesture resets/settles. |
| `decided` | Authoritative `yes` or `no` is known. | Controls disabled; textual result shown. |
| `recoverable-error` | Transport/malformed response left authority uncertain. | No success claim; retry/reconcile action available. |

The state also carries the last validated safe projection when one is known.
It does not store another voter's answer.

## State Transitions

```text
eligible generation -> recovering
recover decided ---------------------------> decided
recover not_decided -----------------------> undecided
recover transport/contract failure --------> recoverable-error

undecided -- choose yes/no --> submitting
submitting -- accepted/unchanged ----------> decided(authoritative value)
submitting -- conflict --------------------> decided(stored winner + conflict notice)
submitting -- uncertain transport ---------> recoverable-error
submitting -- candidate_changed/not_ready --> unavailable + room/candidate refetch

recoverable-error -- retry/reconcile ------> recovering
any state -- generation changes -----------> discard old work; new recovery/unavailable
```

`observer`, `not_voter` and `not_found` are not silent successes. Observer role
is rendered without controls; `not_found` follows the existing safe room-access
failure path.

## Submission Rules

- Buttons and accepted gestures call the same `submit(decision)` operation.
- Only `undecided` may start a submission.
- At most one request is active for a generation; repeated taps/gesture endings
  while submitting do not enqueue requests.
- The UI may animate intent but cannot label it accepted before a validated
  authoritative result.
- `accepted` and `unchanged` show the returned value as confirmed.
- `conflict` shows the returned stored value and explains that the earlier
  answer remains authoritative.
- A lost/failed response shows uncertainty and a retry/reconcile action. A
  retry is safe because the backend pair is immutable.
- Submission never invokes acquisition, modifies candidate state, navigates to
  a next candidate or shows final-match UX.

## Realtime and Lifecycle

The hook does not create a Realtime channel. It observes validated room state
from the existing room lifecycle. A higher aggregate count or reconnect/refetch
can trigger private recovery, but only one recovery per coalesced active
generation should be in flight.

On unmount, room switch, identity change or candidate generation change, local
pending work is invalidated. Network requests need not be physically cancelled
if their completion is guarded by the generation key.

## User-Facing Outcome Contract

Messages must distinguish:

- confirmed yes: “You chose Yes”;
- confirmed no: “You chose No”;
- prior answer recovered after a conflicting attempt;
- temporary inability to confirm with a Retry action; and
- candidate/room no longer eligible, which returns control to canonical room
  synchronization.

Text or accessible names carry meaning independently of color, card direction
and animation. Aggregate completion may be displayed without disclosing other
answers. Exact-two agreement may be represented as a neutral current-candidate
fact, but must not trigger progression or Feature 009 match presentation.

## Test Contract

Unit/component tests cover:

- exact payload validation for every RPC outcome;
- voter versus non-voter eligibility across all Feature 006 presentation
  states;
- one-flight behavior for repeated controls;
- no optimistic acceptance;
- accepted, unchanged, conflict, transport loss and malformed-response paths;
- stale room/candidate callback rejection;
- reload/re-entry recovery of yes and no;
- room invalidation followed by refetch/private recovery; and
- absence of acquisition, navigation and match side effects.
