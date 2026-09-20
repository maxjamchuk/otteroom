# Requirements Traceability: Candidate Progression

**Feature**: 008 — Candidate Progression
**Date**: 2026-09-18
**Gate result**: PASS — owner-approved on 2026-09-18. All five stories, 30
acceptance scenarios, 45 functional requirements, 10 non-functional requirements
and 12 success criteria map to implementation and planned executable evidence.

Abbreviations used below:

- **DB**: migration/pgTAP/dblink authority tests;
- **Edge**: Deno `room-candidate` and TMDB search tests;
- **Client**: strict parser/state/hook/component/route tests;
- **Browser**: controlled real-stack L01/L02 or permanent smoke; and
- **Migration**: protected nonempty Feature 007→008 cutover runner.

## User Stories

| Story | Design path | Independent evidence |
| --- | --- | --- |
| US1 — Resolve a Complete Group Decision | Existing decision RPC resolves a full occurrence atomically with private integer threshold helper | DB boundaries `N=2..10`, no-early/order tests; Browser L01 exact-two plus L02 three- and four-voter subflows |
| US2 — Advance Everyone to One Next Candidate | Rejected occurrence -> durable advancing step -> existing Edge search -> sequence-CAS successor | DB proposal races/history/fresh decisions; Edge exclusion/eligibility; Browser L01/L02 convergence |
| US3 — Progress Exactly Once Under Concurrency and Retry | Room lock + occurrence decision key + expected rejected sequence + unique next ordinal | DB dblink final-voter/commit races; Edge loser adoption; Browser L01 response loss/stale retry |
| US4 — Recover the Shared Progression State | Safe room status/sequence on existing Realtime invalidation plus canonical refetch | Client out-of-order/re-entry tests; Browser L01/L02 reload/reconnect/stale tab; G08 isolation |
| US5 — Stop Safely When Browsing Cannot Continue | `search_incomplete` leaves advancing; only `completed_empty` CAS creates exhausted; agreed bypasses source | Edge complete/incomplete taxonomy; DB terminal CAS; Browser L01/L03 subflows and no Match checks |

## Functional Requirements

| Requirement | Planned mechanism | Primary evidence |
| --- | --- | --- |
| FR-001 | Use existing fixed `room_members.is_voter` and `rooms.required_voter_count`; no membership write | DB membership/decision joins |
| FR-002 | Completion/threshold read persisted fixed `N`, never connection/device/observer count | DB role/count tests; L02 creator observation |
| FR-003 | Occurrence complete only when same-room fixed-voter detail count equals `N` | DB integrity and boundary tests |
| FR-004 | Submit resolves only on newly verified count exactly `N`; source preflight requires advancing | DB no-early; Edge no-call; Client/L02 |
| FR-005 | No inevitable/impossible shortcut; collecting constraint permits only count `< N` | DB N=4 early-yes/early-no; Client/L02 |
| FR-006 | Private threshold helper returns 2 for `N=2` | DB truth table; L01 |
| FR-007 | Helper uses `((2 * N::bigint)+2)/3` for `N>=3` | DB exact values 3..10 |
| FR-008 | Final transaction counts authoritative yes rows and compares `Y >= T` | DB `T-1`/`T` boundaries |
| FR-009 | No threshold field/input/UI; one private fixed helper | Catalog/contract tests; Client absence |
| FR-010 | Same-room composite FKs plus fixed-voter validation and current occurrence binding | DB RLS/integrity/stale tests |
| FR-011 | Room lock and server count make client/order/final identity irrelevant | DB permutations/dblink |
| FR-012 | One-way occurrence transition under the final-decision transaction | DB exact transition/write counts |
| FR-013 | Room/occurrence `agreed`, retained TMDB/sequence/decisions/resolved timestamp | DB handoff tests; Client neutral stop |
| FR-014 | Agreed fails every source/decision transition predicate and is client terminal | DB late-action tests; Edge no search; L01 |
| FR-015 | One neutral progression-status component; explicit Match absence | Client route/component; Browser L01/L02 |
| FR-016 | Final below-threshold transaction marks occurrence rejected and room advancing | DB transition tests |
| FR-017 | Existing Edge plus expected-sequence commit installs one room winner | DB/Edge races; Browser convergence |
| FR-018 | Reuse Feature 006 search/evidence validation unchanged, adding exclusions only | Edge regression and DB evidence validation |
| FR-019 | Unique `(room_id, tmdb_movie_id)` plus server exclusions | DB uniqueness; Edge skip history |
| FR-020 | Accept first eligible non-excluded source result; no queue/ranking field/UI | Edge traversal; Client absence |
| FR-021 | Step key `(room_id,k)`, exact `k+1`, unique ordinal and room lock | DB competing commits |
| FR-022 | New occurrence inserts with room count 0; decision PK includes occurrence | DB freshness; Browser `0/N` |
| FR-023 | Decision rows/accepted timestamps preserved and never updated/deleted/reassigned | Migration snapshots; DB xmin/write tests |
| FR-024 | `search_incomplete` has no commit; room remains advancing; Retry is local/client | Edge failure tests; Browser L01/L03 |
| FR-025 | Retry preflight returns existing winner or same advancing step | DB/Edge lost-response tests; L01 |
| FR-026 | Only `completed_empty` calls expected-sequence empty commit | Edge exhaustive traversal; DB commit gate |
| FR-027 | Durable `exhausted`, no acquisition Retry, existing new-room action, no fallback | DB/Client; Browser L01/L03 |
| FR-028 | Initial `inactive/no_candidates`, sequence 0, no occurrence/progression trigger | Migration/DB/Client tests |
| FR-029 | Assigned identity committed before metadata; retry preflight loads same ID | Edge metadata tests; Client generation tests |
| FR-030 | Room lock serializes distinct final voters while preserving both occurrence rows | DB dblink; Browser concurrent dispatch |
| FR-031 | Decision PK, one-way outcome and sequence-CAS make duplicate/replay/loss no-write | DB write/xmin tests; L01 |
| FR-032 | Expected sequence+ID rejects old target; client canonical refetch | DB stale tests; Client/L01 stale tab |
| FR-033 | Edge results update metadata only; canonical room refetch owns status/count; sequence-aware retirement prevents assumed `0/N` | Edge/Client delayed-winner matrices, including successor already decided/progressed |
| FR-034 | One safe room projection/current Edge winner for voters and creator | Realtime/Client; Browser L02 |
| FR-035 | Canonical re-entry reconstructs sequence, candidate metadata and own current decision | Client hooks; Browser L01/L02 |
| FR-036 | Complete transitive projection lattice adopts reachable forward states, ignores reverse-reachable stale states and fails closed for incomparable branches | Exhaustive Client merge matrix; Browser missed update |
| FR-037 | Migration resolves complete assigned rooms to agreed/advancing without new vote | Migration fixture proof |
| FR-038 | Existing `is_voter` gate; creator role unchanged | DB role tests; Browser L02 |
| FR-039 | Evolve only Feature 007 get/submit RPCs/table; no new decision channel/API | Catalog tests; structure review |
| FR-040 | Protected tables grant-free/RLS; service-only source commits; client uses RPC/Edge | DB ACL/RLS; G08 |
| FR-041 | Only own decision plus safe aggregates; occurrence/detail/history private | DB exact result/ACL; strict Client parsers |
| FR-042 | Member checks, masked `not_found`, room RLS, same-room FKs | DB cross-room/lock tests; G08/L02 probe |
| FR-043 | Every RPC validates detail/count/member/occurrence/room state and raises on mismatch | DB corruption/rollback tests |
| FR-044 | Migration and operations read but never mutate membership/filter/resolution facts | Migration snapshots; DB write-set tests |
| FR-045 | Threshold helper independent from count=`N` eligibility; occurrence-bound decisions stable | DB timing/order tests; design review |

## Non-Functional Requirements

| Requirement | Implementation tasks | Evidence tasks |
| --- | --- | --- |
| NFR-001 — Atomic authority | T006–T009, T021, T039 | T003, T018, T026, T035–T036, T043 |
| NFR-002 — Convergence | T042, T047–T049, T058 | T044–T045, T050, T059–T060, T066–T067 |
| NFR-003 — Recoverability | T031–T032, T041–T042, T047–T048, T054–T055 | T037–T038, T044–T045, T052–T053, T059–T060, T066–T068 |
| NFR-004 — Determinism | T007, T021–T023 | T003, T018, T025, T035 |
| NFR-005 — Source and sequence correctness | T008, T030–T033, T039–T040 | T026–T029, T034, T036–T037, T043 |
| NFR-006 — Failure safety | T007–T009, T039–T042, T054–T055 | T003, T035–T038, T043, T051–T053, T057 |
| NFR-007 — Security and privacy | T007–T009, T022, T030, T049, T064 | T002–T003, T019, T046, T050, T063–T066, T068 |
| NFR-008 — Usability and accessibility | T024, T049, T056 | T020, T045, T050, T053, T057, T059–T060, T066–T067 |
| NFR-009 — Bounded scope | T024, T030, T056, T062 | T020, T027, T053, T057, T061, T069 |
| NFR-010 — Future timing compatibility | T007, T021, T023 | T018, T020, T025, T069 |

## Success Criteria

| Criterion | Measurement plan |
| --- | --- |
| SC-001 | Parameterized DB tests for `N=2..10`, both `T-1` and `T`, exact expected vector `2,2,3,4,4,5,6,6,7`; 100% pass |
| SC-002 | DB/Edge call-count tests for inevitable/impossible incomplete sets plus L02 visible check; zero outcomes/source/terminals before `N/N` |
| SC-003 | Deterministic decision/source race, duplicate/replay/lost-response suite asserts one occurrence outcome, successor count <=1 and exact sequence delta 1 in every case |
| SC-004 | L01/L02 measure every already-open authorized page reaching identical status/candidate meaning within 5 seconds, no manual refresh, zero conflicting cards |
| SC-005 | L01/L02 reload/reconnect/re-entry/lost-response checks recover one outcome/candidate with unchanged decision/occurrence write counts |
| SC-006 | DB/Edge late-action counters and L01 agree flow assert retained identity and zero later acquisition/assignment/control/progression |
| SC-007 | DB/Edge evidence validation, exclusion uniqueness and Browser fresh progress assert eligible distinct successor at `0/N` with zero copied rows |
| SC-008 | DB stale write counts plus Client generation matrix and L01 stale tab assert zero old-state mutation/replacement/double step |
| SC-009 | Edge incomplete versus completed-empty tests and L01/L03 UI assert retryable versus stable terminal in every controlled case |
| SC-010 | DB ACL/RLS/cross-room matrix plus G08/L02 ordinary-JWT probes assert zero protected read/write/attributed-peer disclosure |
| SC-011 | Fixed profile receipt must contain exactly L01=2 and L02=4, total <=6, with every named behavior covered |
| SC-012 | Client/route text/navigation absence tests and L01/L02 browser assertions find zero Match/mode/early/edit/membership/alternate-source behavior |

## Acceptance Scenarios

| Scenario | Coverage |
| ---: | --- |
| 1 | DB exact-two threshold + Browser L01 yes/yes agreed stop |
| 2 | DB exact-two rejection + Browser L01 yes/no advancing |
| 3 | DB `N=3,T=2` + Browser L02 `2 yes + 1 no` agreed |
| 4 | DB `N=4,T=3`, complete two-yes rejected boundary + Browser L02 four-voter boundary |
| 5 | Parameterized DB `N=2..10`, `T-1` and `T` |
| 6 | DB N=4 three-yes incomplete + Client and Browser L02 four-voter no-early outcome/source |
| 7 | DB N=4 two-no incomplete + Client and Browser L02 four-voter boundary flow |
| 8 | DB permutations/final-voter identity matrix |
| 9 | DB/Edge exact `k+1`, distinct eligibility + Browser L01/L02 successor |
| 10 | Browser L02 all voters/non-voting creator same winner/no creator vote |
| 11 | DB no-repeat unique + Edge exclusion traversal |
| 12 | DB occurrence-bound rows/count 0 + Browser L01/L02 fresh `0/N` |
| 13 | Edge Feature 006 eligibility regression and commit evidence validation |
| 14 | Edge committed metadata failure/same-ID retry + Client presentation recovery |
| 15 | DB dblink distinct-final-voter race + Browser concurrent dispatch |
| 16 | DB duplicate/replay exact writes + Browser L01 replay |
| 17 | DB/Edge lost-response recovery + Browser L01 committed-response loss |
| 18 | DB/Edge different-proposal race; losing proposal never returned/rendered |
| 19 | DB stale target + Client generation refetch + Browser L01 stale tab |
| 20 | DB/Edge agreed late-action denial + Client/L01 terminal retention |
| 21 | Client missed-event refetch + Browser L01/L02 reconnect convergence |
| 22 | Client reload generation reset + Browser L01/L02 successor recovery |
| 23 | Client agreed reload + Browser L01 stopped recovery/no controls |
| 24 | Client role gating + Browser L02 creator recovery |
| 25 | DB ACL/RLS/masked result + G08/L02 cross-room ordinary JWT |
| 26 | Edge incomplete no-commit + Client Retry + Browser L01/L03 |
| 27 | Edge same-step retry commit + Browser L01/L03 one successor |
| 28 | Edge completed-empty + DB exhaustion CAS + Browser L01/L03 terminal/new-room action |
| 29 | DB terminal stale denial + Client reload + Browser L01/L03 recovery |
| 30 | DB agreed source denial + Client neutral UI + Browser L01 no Feature 009 UX |

## Quality Gate Conclusion

- **Requirements without a mechanism**: none.
- **Requirements without planned evidence**: none.
- **Proposed design contradictions**: none.
- **`[NEEDS CLARIFICATION]` / `UNRESOLVED` items**: none.
- **Former larger-group blocker**: fully resolved by the fixed integer threshold.
- **Owner approval**: recorded; the corrected specification and plan are approved
  for implementation.
- **Task status**: `tasks.md` exists and contains the dependency-ordered approved
  work; all tasks remain pending and no Feature 008 implementation has started.
