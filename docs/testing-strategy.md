# Cross-Feature Acceptance and R02 Strategy

**Status:** Normative engineering policy for Feature 005 and later work.
**Established:** 2026-09-12.

This policy changes how later features select existing evidence. It does not
change product behavior, completed Feature 001–004 requirements, or the validity
of their recorded acceptance results. The constitution remains authoritative.

## Policy

A completed feature's accepted evidence remains valid for the implementation it
verified. A later feature MUST NOT automatically rerun every historical browser
case. Its minimum validation set MUST instead contain:

1. real-stack browser acceptance owned by the current feature;
2. the permanent cross-feature browser smoke profile;
3. only the historical browser cases selected by a recorded impact review; and
4. the applicable client, PostgreSQL, migration, type, build and export checks.

The impact review MUST name every observable boundary changed by the feature,
the authoritative evidence layer, the selected historical browser cases and
their R02 cost. `None` is a valid targeted-browser selection only with a concrete
rationale. A requirement is not weakened merely because its regression oracle
is below the browser layer.

## Evidence-layer ownership

| Guarantee | Primary regression authority | Browser responsibility |
| --- | --- | --- |
| A core user journey across Auth, UI, RPC, PostgreSQL and Realtime | Real-stack browser | Prove the components cooperate through observable UI and real public-client traffic |
| Authentication bootstrap, retained-session recovery and independent browser identities | Browser integration, supported by client storage tests | Prove real anonymous Auth integrates with the app; do not export or share storage state |
| User-visible validation, role-specific surfaces, invitations/QR, progress, failures and recovery | Browser for cross-component behavior; client tests for isolated component/state behavior | Prove only the representative integration paths selected by smoke, feature ownership or impact review |
| Parser shape/nullability, reducer/state-machine transitions, component behavior, one-flight and stale-generation guards | Client tests | Rerun in a browser only when browser integration or transport timing is the changed subject |
| Lock ordering, concurrent serialization and exact winner/loser ordering | Deterministic PostgreSQL sessions with bounded lock barriers | Browser dispatch may prove usable integration but is not a lock oracle |
| Transaction rollback, exact row/write counts and `xmin` preservation | PostgreSQL tests and nonempty migration checks | Browser failure/retry covers visible recovery only when that boundary changes |
| Exact RLS, ACL, function owner/search path, grants and deny-by-default behavior | PostgreSQL role-level tests | Keep one representative ordinary-JWT cross-room integration smoke; do not duplicate the full ACL matrix in every feature |
| Schema evolution, existing-row preservation and generated-type stability | Versioned migration checks, clean reset, database tests and `db:types:check` | No browser repetition is required solely to re-prove schema mechanics |
| Build and platform packaging | Lint, typecheck, client suite, web export and applicable native exports | Browser does not replace build/export evidence |
| Credential-safe diagnostics | C1 security runner and finalized artifact scanner | C1 remains a separate mandatory gate with its controlled one-identity probe |

Mocks may isolate units but MUST NOT replace the real-stack current-feature
acceptance or permanent smoke. Conversely, a browser request race MUST NOT be
claimed as proof of database lock ordering without the deterministic database
evidence.

## Current E/G/H classification

The categories classify guarantees, not file ownership. A grouped case can
contain browser integration assertions and lower-layer invariant assertions.
When such a case runs, all its assertions still have to pass; the table identifies
which layer owns ongoing regression confidence.

| Current case(s) | Classification | Ongoing treatment |
| --- | --- | --- |
| G03 | A, with C support | Permanent smoke for a three-voter voting-creator flow, link/code assembly, Realtime convergence, filter progress and same-identity recovery. PostgreSQL remains authoritative for stored membership/filter invariants. |
| G04 | A, with C support | Permanent smoke for a non-voting creator, three external voters, aggregate-only progress and recovery. PostgreSQL remains authoritative for exact ownership/privacy. |
| G05 | A, with C support | Permanent smoke for visible QR decode/navigation and same-session idempotent admission. PostgreSQL owns uniqueness/write-count proof. |
| G08 | A, with C support | Permanent ordinary-JWT cross-room isolation integration. PostgreSQL owns the exhaustive RLS/ACL and mutation-denial matrix. |
| H01 | A, with C support | Permanent smoke for the assembled-voter filter surface, own accepted values and the all-complete handoff. Client/PostgreSQL tests own exhaustive parser, vocabulary, validation and write invariants. |
| Auth; E01–E12 | B, with C where noted below | Feature 001 owner evidence. Rerun only when Auth/session, create/join, two-voter compatibility, Realtime/navigation, failure UI or isolation boundaries change. Current generalized smoke already exercises the normal successor flow. |
| G01, G02, G06, G07, G09 | B, with C | Feature 003 owner evidence for exhaustive configuration, creation recovery, multi-slot/final-slot races and join failure/lost-response paths. Select cases affected by later membership, invitation or recovery changes. |
| H02, H03 | B, with C | Feature 004 owner evidence for exhaustive transport recovery/failure and final-completion race/freeze paths. Select them when later work changes those observable paths. |

The following guarantees within E/G/H are category C even when a grouped browser
case also observes their integration:

- E01/G02/G09/H02 rollback, duplicate request and committed-response-loss state;
- E05/E06/G05/G06/G07 membership capacity, uniqueness, lock ordering and exact writes;
- E12/G08 exact RLS, ACL, direct-write denial and private-row visibility;
- E12 navigation and all filter client state/stale-generation behavior where the
  state machine, rather than browser navigation, is the changed subject;
- H01 exact parser/vocabulary/year validation and owner targeting;
- H02/H03 row/count rollback, final-write serialization, no-write retries,
  lock/freeze ordering and `xmin` invariants.

Their authoritative suites are `supabase/tests/database/room_session.test.sql`,
`supabase/tests/database/participant_filter_concurrency.test.sql`, the applicable
candidate/migration SQL suites, and the focused `__tests__/rooms`,
`__tests__/filters`, `__tests__/routes` and configuration tests.

## Permanent browser smoke

The current permanent profile is exactly:

| Case | Identities | Permanent invariant represented |
| --- | ---: | --- |
| G03 | 3 | Voting creator, three-voter assembly, Realtime progress and recovery |
| G04 | 4 | Non-voting creator, three-voter assembly, aggregate privacy and recovery |
| G05 | 2 | Real displayed QR decode/join and same-identity admission |
| G08 | 4 | Ordinary-JWT room isolation through the public browser boundary |
| H01 | 3 | Voter-owned filter UI and durable all-complete handoff |
| **Smoke total** | **16** | Five existing real-stack cases |
| **C1 + smoke** | **17** | C1 is one separate identity |

Run it only through the safe wrappers:

```sh
npm run test:e2e:security
npm run test:e2e:smoke
```

The profile retains `workers=1`, `retries=0`, `repeatEach=1`, capture-off
defaults, the safe reporter, credential registry, finalized scanner and owned
cleanup. The runner rejects overrides for the smoke profile and fails unless it
receives exactly G03/G04/G05/G08/H01 and exactly 16 signup attempts/identities.

These case IDs are the current executable vehicles, not a promise to freeze
superseded terminal copy or flow. When a later feature deliberately evolves the
normal journey, its artifacts MUST update or replace the affected smoke
assertions while preserving the invariant intent and recording the new exact
budget. The completed earlier receipt remains historical evidence.

## Feature-specific acceptance

Each feature specification and plan MUST define a bounded real-stack browser
acceptance set for its new observable behavior before implementation. It MUST:

- cover every new cross-component core flow and every new user-visible security
  or failure boundary for which lower-layer tests are insufficient;
- use client/PostgreSQL tests as the primary oracle for the guarantees assigned
  to those layers above;
- group related checks into one deliberate room/context when independence is not
  the property under test; and
- state case-level signup/identity caps and the total feature-owner budget.

The recommended planning envelope is at most 9 identities for a normal small
vertical slice. This is a budget envelope, not a Feature 005 test design or an
authorization to omit necessary acceptance. If the required feature evidence is
larger, the plan MUST record why and still satisfy R02 admission.

## Targeted historical regression

Before implementation, create an impact matrix with one row per changed
observable boundary. Select an historical browser case when the later feature
changes or can regress that case's browser-specific cooperation, for example:

- Auth bootstrap, local-session continuity or independent-context semantics;
- create/join RPC projection as consumed by the browser;
- route entry, invitation link/code or rendered/decoded QR behavior;
- role visibility, normal phase transitions or user-visible failures;
- rooms Realtime subscription/refetch/navigation behavior;
- browser-facing privacy through ordinary public-client credentials; or
- safe browser context, reporter, scanner or cleanup behavior.

Do not select a browser case solely because a migration touches a table used by
that historical feature. Use the database/client authority and select browser
regression only if the observable integration boundary is also affected.
Targeted historical cases run once in the normal gate. Repeatability does not
automatically repeat them.

## Identity and context isolation

- Storage-state export remains prohibited. Credentials, cookies, sessions and
  browser storage MUST NOT be written to artifacts or carried between cases.
- Independent security, isolation, capacity-winner/loser and unrelated-room
  actors MUST use independent contexts and fresh identities within their case.
- An identity or context MAY be reused inside one case for reload, reconnect,
  retry, re-entry, overlapping same-identity calls and multiple deliberate rooms
  when identity independence is not the property being tested.
- Separate cases MUST NOT share an Auth identity or credential/session cache.
- A new page in the same context is the same identity and is allowed only when
  the case deliberately tests same-session behavior.
- Every case owns bounded observers, barriers, routes, contexts, rooms and
  cleanup. Cleanup must be deterministic on success, failure and interruption.
- Reducing identities by merging independent security actors, unrelated cases or
  required winner/loser identities is forbidden.

## Repeatability

Repeatability runs C1 once, then runs the **current feature acceptance plus the
permanent smoke** twice from unchanged source and stack, with fresh case contexts
for each run. Selected historical regression runs once as part of the normal
gate and is not mechanically repeated.

The first current-feature-plus-smoke execution SHOULD also be the normal feature
checkpoint; do not add an uncounted preliminary full run. A suite-level clean DB
reset and `db:types:check` may occur between runs. It does not recover Auth quota.
If quota is insufficient, wait outside every test/application harness.

## Fresh checkout

At the exact committed implementation SHA, an independent disposable checkout
MUST prove:

- declared-toolchain dependency installation and local environment setup;
- applicable nonempty migration paths, clean latest reset and full database tests;
- check-only generated types with canonical bytes;
- lint, typecheck, full client suite, build and applicable web/native exports;
- C1 with scanner zero; and
- the permanent real-stack browser smoke with scanner zero.

It does not automatically rerun feature-owner or full historical browser
acceptance. The smoke intent must include the current core journey, so it is the
fresh-checkout scenario reproduction required by the constitution. Do not copy
environment files, node modules, Auth storage, service volumes or browser caches
into the checkout, and remove only owned resources afterward.

## Full historical browser acceptance

The existing `npm run test:e2e` remains the full current E/G/H inventory: 36
cases and 82 identities. Run it, plus C1, when any of the following applies:

- explicit release or milestone validation, including the first useful MVP
  release unless its approved release plan states a stricter superset;
- an explicit owner/requested full-regression checkpoint;
- cross-cutting changes to Auth/session bootstrap, public Supabase wiring,
  Playwright context lifecycle, safe diagnostics/reporter/scanner, global E2E
  harness behavior, shared room harness semantics or test discovery;
- a change spanning enough membership, invitation, filter, Realtime and security
  boundaries that targeted selection cannot be justified confidently; or
- a failed smoke/targeted run indicating possible regression outside the known
  impact boundary.

An additive, fail-closed profile selector that leaves full discovery, context
lifecycle, safety controls and case code unchanged requires static/unit coverage
of that selector, not an otherwise unmotivated 82-identity rerun. Any change to
the underlying execution or safety semantics does require the full gate.

## R02 accounting

For every browser block, record the exact source, profile/case selection,
configured maximum, actual signup attempts, successful identities, relevant
timestamps, scanner result and cleanup result.

- Reserve the sum of case maxima plus C1 before starting. Both attempts and
  successful identities are reported; every dispatched attempt consumes the
  rolling allowance even if the run later fails.
- Count targeted, partial, failed and manual runs in addition to planned gates.
- `anonymous_users=150` remains unchanged. No quota probe, automatic Auth retry,
  rate-limit change, storage clearing, service restart or database reset may be
  used to discover, avoid or replenish the allowance.
- An HTTP 429 fails the gate. If usage is unknown, use a conservative full
  signup-free hour from the last counted attempt and wait outside the harness.
- Workers remain 1, retries 0 and repeatEach 1 for normal real-stack profiles
  until a separately reviewed isolation design proves another setting safe.
- Full historical acceptance is 82; C1 is 1; permanent smoke is 16. Targeted
  selection costs the sum of its current case budgets and is never free merely
  because the same case ran earlier in the hour.

Let `F` be current-feature identities and `T` the once-only targeted historical
selection. The normal formulas are:

| Gate | Identity budget |
| --- | ---: |
| Normal feature checkpoint | `1 + 16 + F + T` |
| Repeatability block | `1 + 2 × (16 + F) + T` |
| Fresh checkout | `1 + 16 = 17` |
| Explicit full historical checkpoint | `1 + 82 = 83` |

To keep a normal checkpoint at or below 50, `F + T` must be at most 33. To keep
it at or below 30, `F + T` must be at most 13.

## Feature 005 default inheritance and projection

This section is budgeting guidance only; it does not specify or implement
Feature 005.

Feature 005 inherits by default:

- C1 unchanged: 1 identity;
- the five-case permanent smoke: 16 identities;
- all applicable clean migration/reset/type, PostgreSQL, client, build and export
  gates at zero browser identities; and
- its own future specification's real-stack acceptance budget `F`.

It does **not** inherit by default the E/Auth inventory (47 identities), the
non-smoke G01/G02/G06/G07/G09 inventory (13), or H02/H03 (6). Those 66 identities
remain valid historical owner evidence. Feature 005's impact review may add any
affected case, once, to `T`; in particular H02/H03 are candidates only if its
approved design changes the observable filter recovery or locked-completion
boundary. G03/G04/G08/H01 are already present in smoke.

Using the recommended `F = 9` planning envelope and no additional affected
historical case (`T = 0`) gives this projection:

| Gate | Feature 004 policy | Feature 005 projected policy |
| --- | ---: | ---: |
| Normal checkpoint including C1 | 83 | `1 + 16 + 9 = 26` |
| Repeatability | 165 | `1 + 2 × (16 + 9) = 51` |
| Fresh checkout | 83 | `1 + 16 = 17` |
| Repeatability plus fresh checkout | 248 | `51 + 17 = 68` |

If impact review selects historical cases, add `T` once to the normal and
repeatability figures. These projected blocks fit comfortably within one fresh
150-identity window, but actual prior usage must still be admitted and recorded.

## Constitution check

| Constitutional requirement | Assessment |
| --- | --- |
| I — reproducible, verifiable behavior | Compatible: current-feature real-stack acceptance and permanent smoke remain executable; fresh checkout retains install, migration/reset/types, static/client/DB/build/export, C1 and scenario reproduction. |
| II — small verifiable slices | Compatible: validation follows the current vertical slice instead of expanding mechanically with project age. |
| III — artifact consistency | Compatible: every feature records an impact review and updates affected current artifacts without rewriting completed evidence. |
| IV — authoritative state transitions | Strengthened: deterministic locks, rollback, writes and ownership stay at the PostgreSQL boundary that can guarantee them. |
| V — security and least privilege | Compatible: C1 is unchanged; storage export/cross-case session reuse remain forbidden; PostgreSQL keeps exact RLS/ACL authority and G08 keeps ordinary-JWT browser integration. |
| VI — reproducibility/schema evolution | Compatible: clean migrations/reset, database tests, check-only types and fresh-checkout setup remain mandatory. |
| VII — executable acceptance evidence | Compatible: the current feature and core journey still have real-stack E2E; mocks do not replace integration, while lower-layer behavioral tests own guarantees browsers cannot prove authoritatively. |
| VIII — explicit scope/simplicity | Compatible: profiles remove redundant execution without adding product behavior or speculative infrastructure. |

No constitution amendment is required. The constitution requires an applicable,
recorded minimum validation set and re-evaluation when a change can affect a
boundary; it does not require every historical browser case in every later
feature's repeatability or fresh-checkout block.
