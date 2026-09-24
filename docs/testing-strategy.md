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

## Feature 007 fixed acceptance profile

Feature 007 adds the override-free `npm run test:e2e:feature007` profile. It
selects exactly K01/K02 with caps 2 and 4 (owner total 6), while direct J03 is
bounded separately at 2. The post-feature full inventory is 44 cases and 106
identities. K01 retains only four monotonic responsiveness aggregates: 20
samples, count at or below 2,000 ms (at least 19), maximum duration, and zero
recoverable failures. It records no individual samples or percentile. Capture
remains off; the credential registry, finalized scanner, controlled provider,
safe reporter, and owned cleanup remain mandatory.

## Feature 008 fixed acceptance profile

Feature 008 adds the override-free `npm run test:e2e:feature008` profile. It
selects exactly L01 (2 identities) and L02 (4 identities), for owner total 6.
L03 remains embedded in L01, and L02 reuses its four case-owned identities
across its three-voter and four-voter room subflows; neither adds a case or an
identity. At the Feature 008 boundary, the full inventory was 46 cases/112
identities. Including C1, that historical full-checkpoint formula is
`1 + 112 = 113`. Capture remains off;
the controlled provider, credential registry, finalized scanner, safe reporter,
and owned cleanup remain mandatory.

Feature 008 charged blocks remain separately admitted: normal/run one is
`1 + 16 + 6 = 23`, the additional repeatability run is `16 + 6 = 22`, their
cumulative budget is `23 + 22 = 45`, and the fresh-checkout C1 plus smoke block
is `1 + 16 = 17`. The preserved pre-feature full checkpoint was
`1 + 106 = 107`; the Feature 008-boundary full checkpoint was `1 + 112 = 113`.

## Feature 009 current evidence and owner release check

**Current status: Feature 009 release-complete; ready to commit.** The owner
reports the latest-product-source manual live-TMDB mixed-clause browser recheck
PASSED after the source correction. The previously failing three-voter flow
progressed beyond four rejected candidates, all clients converged on the next
candidate, and no `deadline`, `request_budget` or incorrect
`ordering_inconsistent` occurred. The owner later observed valid, more varied
candidates under operational YAML values `minimum_vote_count: 100` and
`ordering: popularity_desc`; this is configuration evidence, not a new product
requirement. T096 and T097 remain valid charged evidence
for their tested source: 23 identities plus 22 identities, for 45 repeatability
identities. T100 G5 passed for that source. The later correction has deterministic,
clean-database and bounded live source replay evidence. T096/T097 and T100 do
not certify the later source correction; the owner manual recheck is recorded
separately. The owner intentionally discontinued
T098 independent fresh-checkout certification because the remaining effort had
become validation-infrastructure work unrelated to product acceptance. T098 did
not pass; preserve its attempts and receipts as historical diagnostics. Do not
claim 62-identity certification for the T096/T097 source or spend the planned
additional 17 identities. T099 reconciliation and T100 G5 audit used their
then-current source worktree and non-charged evidence only. Feature 010
Discovery and Feature 011 Match remain unstarted.

Historical T001–T074 receipts remain preserved certification for their original
pre-regression source, including all failed, partial, diagnostic, manual, and
replacement attempts. The post-G5 candidate-source correction invalidated that
exact-source release claim. The pre-runtime-correction current-source sequence was
T078 normal acceptance, T079 unchanged-source repeatability, T080 independent
fresh-checkout evidence, T081 reconciliation, and the passing T082 final current-
source G5 audit; those receipts remain historical and are not rewritten. The later
T089 Docker runtime correction changed the authoritative `scripts/` manifest. The
previously governing corrected-source sequence was T090 normal run one, T091
unchanged-source repeatability, T092 independent fresh checkout, and T093
current-source reconciliation. T094 completed the final corrected-current-source
G5 audit with zero identities and no charged rerun. T081 and T082 performed no
charged rerun.

The implemented Feature 009 profile adds the override-free
`npm run test:e2e:feature009` profile. It selects exactly M01 (2 identities) and M02
(4 identities), for an owner-acceptance total of 6.
M01 reuses its two voter identities across its bounded room subflows. M02 reuses one
non-voting creator plus three voters across its three-voter and four-voter subflows;
neither case adds a hidden identity. Targeted historical selection is `T = 0` because
the permanent smoke covers the changed creation transport and M01/M02 cover the
evolved candidate/progression journeys. Capture remains off; workers 1, retries 0,
repeat 1, the controlled provider, credential registry, finalized scanner, safe
reporter, and owned cleanup remain mandatory.

The final Feature 009 charged-block and inventory reconciliation is:

| Measure | Formula | Identities/inventory |
| --- | --- | ---: |
| M01 | fixed case cap | **2 identities** |
| M02 | fixed case cap | **4 identities** |
| Owner acceptance | `2 + 4` | **6 identities** |
| Permanent smoke | `G03 3 + G04 4 + G05 2 + G08 4 + H01 3` | **5 cases / 16 identities** |
| C1 security probe | separate controlled probe | **1 identity** |
| T096 normal checkpoint / repeatability run one | `C1 1 + smoke 16 + owner 6 + T 0` | **PASS; 23 identities** |
| T097 additional repeatability | `smoke 16 + owner 6` | **PASS; 22 identities** |
| T096/T097 tested-source repeatability | `23 + 22` | **PASS; 45 identities** |
| T098 fresh checkout, previously planned | `C1 1 + smoke 16` | **WAIVED by owner; not passed; 0 of 17 additional identities spent** |
| Final full acceptance inventory | Feature 008 boundary `46/112` + M01/M02 `2/6` | **48 cases / 118 identities** |
| Final full inventory plus C1 | `118 + 1` | **119 identities** |

The previous `45 + 17 = 62` combined figure was a plan projection only. The
T098 certification for the T096/T097 source was intentionally discontinued and is not
included in current accepted evidence. The full inventory remains a case/identity
count, not a claim that the whole inventory or a 119-identity block was run.

The inventory is repository-derived rather than carried forward from the approved
projection: the repository profile assertion records the Feature 008 boundary as `42 + 2 + 2
= 46` cases and `100 + 2 + 4 + 2 + 4 = 112` identities; the current runner maps
M01/M02 to 2 and 4, and the Feature 009 profile test discovers exactly those two
additive cases. Therefore the implemented final inventory is `46 + 2 = 48` cases
and `112 + 2 + 4 = 118` identities, with C1 making 119.

The pre-runtime-correction evidence is T078 normal acceptance, T079
unchanged-source repeatability, and T080 fresh checkout, recorded in the Feature
009 quickstart. Their formulas are respectively `23`, `22`, and `17`, with
cumulative repeatability `45` and repeatability plus fresh checkout `62`; their
source identity remains historical after the T089 runtime correction. The later
T090 `23`, T091 `22`, and T092 `17` evidence yielded `23/22/45/17/62` for its
tested source. Each of those charged blocks has its
required fresh R02 admission, safe-wrapper/profile selection, fail-fast controls,
capture-off configuration, exact Auth result, zero-finding scanner, owned cleanup,
and no HTTP 429; targeted historical work is `T = 0`. Those receipts remain
historical for their tested sources; T092's 17 identities do not establish a
fresh-checkout pass for the T096/T097 source.

The quickstart retains and accounts for all earlier failed, partial, diagnostic,
manual, and replacement attempts. Historical charged accounting is intentionally
separate from the current-source formulas: the preserved T070/T071/T072 ledger
records its historical attempts independently, including T070's 41 identities,
T071's historical charged 22, and T072's 33 charged identities across its failed/
partial block and recovery. None is added to the current-source `23/22/45`
repeatability evidence. T098's planned additional 17 identities remain unspent,
and the combined 62-identity certification for the T096/T097 source was not performed. No
unfinished charged run remains.

The pre-runtime-correction implementation identity is mutually consistent across
T078, T079, and T080: workspace HEAD
`e55a53bbc6494691f9a9e636cfead61a29255982`, a 144-file
source manifest with path-list SHA-256
`3f6512790b06794de3a5eeb0f66cc4d7dfaf3e7f7c0c467727b83a411e3f65a6` and
content-manifest SHA-256
`b9ad3cc14c8da65064a579c4e43b6782343417f8e5bbc22cbbba95e24f55d62d`.
The ordered traversal, owner spec, controller, canonical/bundled YAML, and
generated-types hashes are unchanged across those receipts. T080 independently
reconstructed the same source in candidate commit
`b25871b85e01ef6260f286d6f064036910f0a9ce`, tree
`5f561aa323499846af9a4ed6ec5b6e1451cfe9ef`, and matched the manifest.

T081 historically confirmed the repository-derived inventory; T093
reconciliation confirms it remains M01 `2`, M02 `4`, owner `6`, full `48 cases /
118 identities`, and full plus C1 `119`: the fixed Feature 008 runner is `46/112`,
while the current Feature 009 profile discovers exactly two additive cases. The
post-G5 traversal correction changed source traversal only and the Playwright
runtime correction changed owned execution plumbing only; neither changed the
acceptance inventory. T090, T091, and T092 remain separate historical receipts for
the corrected source, all report clean scanner/Auth/cleanup evidence and no HTTP
429, and retain check-only types after the sole T063 write. T075–T080 and all
earlier attempts remain historical; T094 confirmed Feature 009 complete for its
tested source. T095 reopened it; the later mixed-clause correction has only its
own recorded lower-layer and live source evidence. Feature 010 Discovery and
Feature 011 Match remain unstarted.

The historical corrected-source identity reconciled by T093 and audited by
T094 is workspace
HEAD `e55a53bbc6494691f9a9e636cfead61a29255982`, a 144-file source manifest with
path-list SHA-256 `b7e2ca13cf82fb08ca726f6f6dd5667bb7a4f17d7f27eb6b433b55cc9428b3d8`
and content-manifest SHA-256
`478a4ae21bcac343054c0cb5af6af2fc18ebfccd0bce33654647d4e6c5f4fcd7`. Its
Playwright runtime implementation SHA-256 is
`9a93ace924ad6026783a3861346abada0f1a2d4e9ff185c4c7f1853481fa29cd`, and the
generated database types remain
`69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03`. T092's
independent candidate commit/tree are
`0d8efaaf74f200a0fc7b770569a636ef52aa7679` /
`d5fc596a834afbd7b4a2bdfecc13ce3632f352aa`; its 144-file path/content manifest
and runtime hash match T090/T091 and their tested workspace source. The canonical
and bundled YAML hashes, Feature 009 migration hash, ordered `tmdb-client.ts`
hash, owner spec, and controller are likewise unchanged across the three
historical receipts.

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

Repeatability runs C1 once and runs the **current feature acceptance plus the
permanent smoke** twice from unchanged source and stack, with fresh case contexts
for each execution. Selected historical regression runs once as part of the
normal gate and is not mechanically repeated.

The normal feature checkpoint MUST be repeatability run one; it already charges
C1, targeted selection, and the first owner-plus-smoke execution. To complete
repeatability after that checkpoint, charge and run only one additional
owner-plus-smoke execution with fresh case contexts. Do not rerun C1 or the
normal/first execution. A suite-level clean DB reset and `db:types:check` may
occur between runs. It does not recover Auth quota. If quota is insufficient,
wait outside every test/application harness.

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

At the Feature 008 boundary, the existing `npm run test:e2e` inventory was the full
E/G/H/I/J/K/L set: 46 cases and 112 identities. With the implemented Feature 009
profile, the repository's final full acceptance inventory is 48 cases and 118
identities, or 119 including C1. Run the applicable full inventory, plus C1, when any
of the following applies:

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
of that selector, not an otherwise unmotivated full-inventory rerun. Any change to
the underlying execution or safety semantics does require the full gate.

## R02 accounting

For every browser block, record the exact source, profile/case selection,
configured maximum, actual signup attempts, successful identities, relevant
timestamps, scanner result and cleanup result.

- Reserve the sum of the case maxima actually scheduled in that block. Add C1
  only when that block schedules C1 (the normal/run-one and fresh-checkout
  blocks, not the additional repeatability execution). Both attempts and
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
- Feature 008-boundary full acceptance is 112; final Feature 009 full acceptance is
  118; the preserved pre-Feature-008 baseline was 106; C1 is 1; permanent smoke is
  16. Targeted selection costs the sum of its current case budgets and is never free
  merely because the same case ran earlier in the hour.

Let `F` be current-feature identities and `T` the once-only targeted historical
selection. The normal formulas are:

| Gate | Identity budget |
| --- | ---: |
| Normal feature checkpoint / repeatability run one | `1 + 16 + F + T` |
| Additional repeatability run after normal | `16 + F` |
| Cumulative normal plus repeatability | `1 + 2 × (16 + F) + T` |
| Fresh checkout | `1 + 16 = 17` |
| Preserved pre-Feature-008 full baseline | `1 + 106 = 107` |
| Feature 008-boundary full historical checkpoint | `1 + 112 = 113` |
| Final Feature 009 full checkpoint | `1 + 118 = 119` |

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
| Additional repeatability run after normal | 82 | `16 + 9 = 25` |
| Cumulative normal plus repeatability | 165 | `26 + 25 = 1 + 2 × (16 + 9) = 51` |
| Fresh checkout | 83 | `1 + 16 = 17` |
| Cumulative repeatability plus fresh checkout | 248 | `51 + 17 = 68` |

If impact review selects historical cases, add `T` once to the normal and
cumulative-repeatability figures, never to the additional repeat execution.
These projected blocks fit comfortably within one fresh 150-identity window, but
actual prior usage must still be admitted and recorded.

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
