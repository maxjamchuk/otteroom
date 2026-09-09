# Research: First Shared Movie Candidate

**Feature**: `002-first-movie-candidate` | **Access/review date**: 2026-09-09
**Result**: All technical decisions resolved within the user's selected architecture.
This document records design decisions, not executed implementation evidence.

## Evidence Basis

Normative input is [spec.md](spec.md), its reviewed checklist, the constitution,
and the binding planning request. Local integration evidence includes current
package.json/package-lock, migrations, generated types, room/Auth/client code,
`playwright.config.ts`, C1 support modules, and the existing room pgTAP/E2E
harness. Reuse the committed infrastructure; no dependency upgrade is selected.

## Decision 1 — Authoritative Catalog and Exact Fixtures

**Decision:** one new `public.movie_candidates` table with exactly five fields:
id, title, release_year, poster_key, sort_order. Insert exactly these four rows
through the first versioned migration:

| id | title | release_year | poster_key | sort_order |
| --- | --- | ---: | --- | ---: |
| fixture-cardboard-comet | The Cardboard Comet | 2020 | cardboard-comet | 10 |
| fixture-pebble-bay-lanterns | Lanterns of Pebble Bay | 2021 | pebble-bay-lanterns | 20 |
| fixture-cloud-tram-four | Cloud Tram Number Four | 2022 | cloud-tram-four | 30 |
| fixture-clockwork-orchard | The Clockwork Orchard | 2023 | clockwork-orchard | 40 |

These are fictional project fixtures, not assertions about real releases or
provider records. Names, dates, count, and ordering are implementation data,
not new product requirements. IDs/keys/orders are unique and frozen for Feature
002. Posters are newly created original geometric illustrations.

**Rationale:** a versioned database catalog supplies reproducible authoritative
metadata without credentials, external lookup, or a client-readable browse API.
Catalog rows are immutable through the application. Do not edit assigned
fixture metadata during Feature 002; stable display values depend on that rule.

**Rejected:** TMDB/external APIs, a second client metadata catalog, external image
URLs, runtime imports, and manual seed steps. All introduce dependencies or
consistency work outside the slice.

## Decision 2 — One Room Column and Minimum-Sort Selection

**Decision:** append `rooms.movie_candidate_id text NULL`, FK to the catalog
with ON DELETE RESTRICT/ON UPDATE NO ACTION, and
`rooms_candidate_requires_guest_check`:
`movie_candidate_id IS NULL OR guest_user_id IS NOT NULL`.

A Ready room may remain NULL until its first successful assignment. On first
assignment select `ORDER BY sort_order ASC LIMIT 1`; thereafter return its
existing FK without an UPDATE. The current first fixture is
`fixture-cardboard-comet`. Different rooms intentionally select the same movie.

**Rationale:** the room row is already the membership/locking authority. One
nullable column supplies at-most-one cardinality. Terminal behavior follows the
only authorized mutation RPC and denied direct client writes. No reassignment
trigger, reverse-lookup index, or maintenance surface is needed for four immutable
fixtures and no deletion/replacement flow.

**Rejected:** client-only selection, randomization, hashes/seeds, ranking,
queue/deck table, room-candidate join table, and title/year/poster snapshots in
every room. This ordering is temporary fixture selection, not a product
recommendation rule.

## Decision 3 — Locked RPC and Security

**Decision:** `public.ensure_room_candidate(p_room_id uuid)`, one row with
`outcome text, candidate_id text, title text, release_year smallint,
poster_key text`. Outcomes are available, not_ready, not_found.

Use postgres-owned SECURITY DEFINER with empty pinned search_path and qualified
references because ordinary clients have no catalog read or room write rights.
Read auth.uid(), lock the exact room FOR UPDATE, check membership with null-safe
comparisons, then inspect readiness and assignment. The first assignment updates
only FK and updated_at; repeats do not write.

**Rationale:** PostgreSQL 17 row locks last through transaction completion. Under
READ COMMITTED a waiting locking read can inspect the winner's committed row,
so the second caller returns its established candidate [S4, S5]. A real blocker
barrier uses backend PIDs and pg_blocking_pids, including queued blockers [S6].
Exact security behavior and concurrency proof are in
[contracts/candidate-rpc.md](contracts/candidate-rpc.md).

**Important local findings:**

- Preserve authenticated rooms SELECT(id, code, state), its membership policy,
  and Realtime select:['id']; do not grant movie_candidate_id or catalog SELECT.
- An unrelated Waiting room has a null guest. Use
  `caller IS DISTINCT FROM host AND caller IS DISTINCT FROM guest` for denial;
  a negated nullable OR could disclose not_ready to an outsider.
- Existing historical prose describes revoked default function EXECUTE, but
  current migrations only change default table privileges. The new migration
  explicitly revokes its exact signature from PUBLIC/anon/authenticated and
  grants authenticated in the same transaction. Do not assume a global default.
- RETURNS TABLE output parameters have physical nullability; generated types
  currently show primitive RPC fields even where branches return null. Keep
  strict runtime narrowing and database assertions of logical nullability.
- Null room input maps to not_found after Auth checking. Invalid UUID syntax,
  missing Auth, empty catalog, and unexpected integrity faults remain exceptional;
  none introduces a fourth business outcome.

Supabase's definer/search-path/EXECUTE guidance supports the hardened pattern [S7].
No new public helper function is selected.

## Decision 4 — Bundled PNGs and Rendering

**Decision:** reuse existing `Image` from react-native; do not install expo-image.
Create four 240×360 original PNGs, each at most 64 KiB, with these paths:

| poster_key | Planned bundled file |
| --- | --- |
| cardboard-comet | assets/candidates/cardboard-comet.png |
| pebble-bay-lanterns | assets/candidates/pebble-bay-lanterns.png |
| cloud-tram-four | assets/candidates/cloud-tram-four.png |
| clockwork-orchard | assets/candidates/clockwork-orchard.png |

`src/candidates/posters.ts` has four literal require expressions using
`../../assets/candidates/<fixed-name>.png`, typed as ImageSourcePropType.
The variable is the registry lookup key, never a dynamically constructed require
path. Source metadata must be passed unchanged to Image.

**Evidence/rationale:** React Native documents statically known image names [S1].
Expo SDK 57 Metro documents native numeric sources and web asset objects [S2].
Using one static registry is the design inference from those supported forms.

A successful card requires onLoad; onError enters recoverable display failure,
and onLoadEnd does not imply success [S3]. Stable callbacks avoid unnecessary RN
Web reload effects. Retry remounts only the Image with an incremented attempt key
while keeping exactly the same registered source and candidate [S8, S9].
Unknown keys retain metadata and fail safely; they do not select another record.

RN Web 0.21.2 paints its visible image as a CSS background and includes an
opacity-zero accessibility img [S9]. Therefore browser proof checks the visible
wrapper/background, loaded local PNG, decoded dimensions, and successful-card
state, not only the hidden img. Network interception is used to fail the actual
resolved local image request once and then allow the real retry [S10].
Bundled web images still use local HTTP; no external movie/image request is needed.

**Independent review evidence (2026-09-09):** inspected the installed
`@expo/metro-config` 57.0.12 `build/transform-worker/asset-transformer.js` and
`getAssets.js`, together with the repository's static-web app configuration and
absence of a custom Metro transformer. The web PNG branch emits a URI object;
there is no byte-size threshold that inlines a small PNG. A read-only, in-memory
invocation on the existing 188-byte `expo-router/assets/forward.png` emitted a
local file URI for development and a content-hashed file URI for export. The
iOS/Android branches emitted asset registration. No fixture, build output, or
application code was created. This corroborates [S2] and establishes that the
planned F08 request interception is feasible; it is not a browser acceptance run.

Bind F08 to the resolved app-origin HTTP PNG, before its first load in a fresh
context. Do not accept a data/blob URI as equivalent evidence for this test.
Image callbacks, decoded dimensions, and visible painting remain required.

Web export includes static assets in dist [S11]. Validate all four source files
and registry entries, exported inclusion, and live browser painting. Native source
compatibility is preserved; web evidence does not claim native runtime execution.

**Rejected:** expo-image's separate package/API [S12], asset URLs from providers,
Supabase Storage, dynamic require paths, onLoadEnd-as-success, and replacing a
candidate after image failure.

## Decision 5 — Hook, Realtime, and Recovery

**Decision:** a focused candidate hook consumes current accepted room ID/state.
Waiting does nothing; Ready automatically acquires once per room/attempt. A
room-local promise survives effect replay, while generation guards discard stale
completion. Metadata obtained from available is retained even before image load.
Any later differing result is a safe contract error; it never replaces that anchor.

Keep the existing room channel and its system-ok/readiness/refetch semantics.
Candidate acquisition does not await a candidate-specific event. An assignment
UPDATE is just another harmless room invalidation; stable ID/state dependencies
avoid another candidate request loop. No polling or second channel.

**Failure decisions:** before assignment, explicit retry can establish it;
after commit/response loss, retry returns the persisted assignment; poster-only
retry remounts the identical source without RPC. Reconnect preserves an already
displayed card and existing room synchronization retry. No replacement Auth user
is created during recovery.

**Rejected:** using assignment Realtime as the sole trigger, polling fallback,
global candidate cache, another state framework, automatic retry loops, and
clearing a successful candidate when the room channel temporarily degrades.

## Decision 6 — Compatibility and Safe Acceptance

The existing code, rather than old architecture prose alone, determines
integration work:

| Current assumption | Necessary future adaptation |
| --- | --- |
| pgTAP expects only rooms, eight room columns, and old FK/constraint sets | Add catalog/column/FK/invariant assertions while preserving existing membership/RLS tests |
| E2E roomSnapshot validates the full old row | Accept the new nullable field; retain checked shape |
| E06 counts one rooms UPDATE; some E12 trials compare entire rows during Ready | Prove one membership transition separately from one candidate assignment; settle acquisition before full-row baselines |
| acceptance testMatch names only room-session.spec.ts | Explicitly add first-movie-candidate.spec.ts |
| C1 ordinary UI assertion uses screenshot eligibility and rejects all images | Add a separate bounded text/attribute assertion for normal UI; retain the strict image-free screenshot guard and controlled probe |
| Safe locations/case labels/budget messages know only existing tests | Add fixed F01–F08/file names and N=65; preserve sanitizer, registry, scanner, and capture bans |
| createWaiting starts a fresh-signup helper | F06 creates its second room through already authenticated contexts |

No poster screenshot is required. No scanner exception or sensitive artifact
capture is approved. Run the unfiltered real-Auth C1 gate before ordinary
acceptance. It deliberately exercises the controlled failure and the wrapper's
successful safety result; retain its current semantics.

## R02 — Binding Identity Budget

Existing committed acceptance allocation is 47 (24 cases including Auth smoke).
C1 separately costs 1. Current defaults: one worker, repeatEach 1, retries 0.
The following eight new independently runnable cases are the binding design:

| Case | Coverage | Spec scenarios | Distinct fresh contexts | Maximum new signup attempts/identities |
| --- | --- | --- | ---: | ---: |
| F01 | Waiting absence and direct not_ready; automatic Ready acquisition held at a two-request barrier; shared loaded poster/data; repeated reads; local traffic | 1, 2, 3, 4, 5, 8, 12 | 2 | 2 |
| F02 | Host/guest reload and separate real socket reconnects after successful display | 9, 10, 11 | 2 | 2 |
| F03 | Host loses connection in Waiting; guest joins/loads; original host reconnects | 15 | 2 | 2 |
| F04 | Two unrelated Ready rooms with four distinct members; foreign/missing outcomes across access/recovery variants | 6 | 4 | 4 |
| F05 | Both first requests fail before server; Ready/NULL preserved; concurrent explicit retries | 7, 13 | 2 | 2 |
| F06 | Two fresh-room subtrials within the same two authenticated contexts, reversing which participant fails before seeing the other's assigned candidate | 14 | 2 | 2 |
| F07 | Both real committed first responses discarded; neither sees a candidate; concurrent retries recover the existing assignment | 16 | 2 | 2 |
| F08 | One local poster request fails, then same candidate/source retry succeeds | 17 | 2 | 2 |
| Feature 002 subtotal | All 17 scenarios; no identities shared between independent cases | 1–17 | 18 | 18 |

F06 must not call a helper that creates or waits for a new identity for its second
room. Reload, reconnect, retry, repeat access, and a second room in the same
authenticated context add zero. Before navigation, attach the existing signup
observers and enforce per-case caps; count dispatched failed attempts too.

Each fresh context signs in once. F06 creates a second room with a fresh creation
request ID through the retained session and validates the returned room ID;
shared helpers must not assume that this participant now owns only one room.
The existing `anonymousBudget` allocations were independently summed as
3+2+4+4+3+3+5+4+2+2+1+11+3=47, matching the current 24-case design.

| Validation block | Maximum |
| --- | ---: |
| Phase 6: C1 + existing 24 cases + F01 | 1 + 47 + 2 = 50; acceptance N=49 |
| Targeted Feature 002 | 18 |
| C1 + targeted Feature 002 | 19 |
| Complete acceptance: 47 + 18 | 65 |
| C1 + one complete run / fresh checkout | 66 |
| C1 once + two complete runs on one continuously started stack | 131 |
| Two separate C1 + full pairs | 132 |
| Three complete runs | 195; exceeds 150 |
| Repeatability block + fresh-checkout block | 197; requires separately sufficient recovered allowance |

**Decision:** retain local anonymous_users=150. Required one/two-run blocks fit;
do not imply the old three-full-run allowance covers the combined suite.
Workers partition these cases and do not multiply one run; another worker-profile
invocation costs another 65. repeat-each=2 costs 130 before C1; repeat-each=3 costs
195 and is outside this allowance. The existing wrapper's accepted options need
not be broadened.

Reserve allowance before a block. Prior targeted/security/manual/failed signups
count. Database reset and test cleanup do not reset the hourly Auth counter;
do not restart or clear storage to evade it. No rate-limit configuration change
or automatic sign-in recovery loop is selected.

**Admission/wait semantics:** follow the existing Feature 001 R02 boundary.
Before launching a block, use sanitized counts/timestamps to establish sufficient
remaining allowance for its full cap. If prior usage is unknown or the remaining
allowance is insufficient, postpone the block and wait outside the application,
Playwright tests, and E2E wrapper. A full signup-free hour after the last counted
attempt is a conservative recovery boundary; account for other local users of
the same IP. No test Auth probe, in-suite sleep, hidden retry, reset, or restart
is quota recovery. An actual HTTP 429 fails the run with the existing safe
environment-budget diagnosis and counts its attempt. The 131 and 66 blocks
cannot both be admitted against one unrecovered allowance of 150.

## R01 — Canonical Types

Retain `scripts/database-types.mjs` byte-for-byte. Intentional final schema
change uses db:reset → db:types → db:types:check; the new canonical generated
artifact is then reviewed/committed during implementation. Normal/fresh-checkout
validation uses db:types:check only. No new type-generation command or hand-edited
database definition is introduced.

## Official Sources

All sources below were accessed on **2026-09-09**. They support technical
verification; fixture names and architecture constraints come from this project's
planning decision and user request.

| ID | Source title and URL | Decision supported |
| --- | --- | --- |
| S1 | [React Native 0.86 — Images](https://reactnative.dev/docs/0.86/images) | Literal static asset names and bundled source handling |
| S2 | [Expo SDK 57 — Metro asset imports](https://docs.expo.dev/versions/v57.0.0/config/metro/#asset-imports) | Native/web imported asset forms and Image source use |
| S3 | [React Native 0.86 — Image](https://reactnative.dev/docs/0.86/image) | onLoad, onError, onLoadEnd semantics |
| S4 | [PostgreSQL 17 — Explicit Locking](https://www.postgresql.org/docs/17/explicit-locking.html) | Room-row serialization through transaction end |
| S5 | [PostgreSQL 17 — Transaction Isolation](https://www.postgresql.org/docs/17/transaction-iso.html) | READ COMMITTED locking-read behavior after a competing commit |
| S6 | [PostgreSQL 17 — System Information Functions](https://www.postgresql.org/docs/17/functions-info.html) | Actual backend/blocker evidence, including queued blockers |
| S7 | [Supabase — Database Functions](https://supabase.com/docs/guides/database/functions) | Definer hardening and explicit execution grants |
| S8 | [React — Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state#option-2-resetting-state-with-a-key) | Local Image remount for explicit retry |
| S9 | [React Native Web 0.21.2 — Image implementation](https://github.com/necolas/react-native-web/blob/0.21.2/packages/react-native-web/src/exports/Image/index.js) | Visible CSS background, hidden img, callback stability; also inspected locally |
| S10 | [Playwright — Network](https://playwright.dev/docs/network) | Real request observation, forwarding, and one-shot fault interception |
| S11 | [Expo — Publish websites](https://docs.expo.dev/guides/publishing-websites/) | Web export and bundled output assets |
| S12 | [Expo SDK 57 — Image](https://docs.expo.dev/versions/v57.0.0/sdk/image/) | Separate image package considered and rejected as unnecessary |

## Resolution

No unresolved technical or product decision remains. Runtime correctness,
packaging, concurrency, security, and budget consumption must still be proven
by implementation using [quickstart.md](quickstart.md).
