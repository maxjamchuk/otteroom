# Requirements Traceability: Selection Rules and Candidate Ordering

**Feature**: 009 — Selection Rules and Candidate Ordering  
**Date**: 2026-09-20  
**Gate**: RELEASE-COMPLETE; READY TO COMMIT. The owner's latest-product-source
manual live-TMDB mixed-clause browser recheck PASSED after the source correction.
T096/T097 passed for their earlier tested source at 45 charged identities;
T100 G5 passed for that source. Those receipts do not certify the later
correction. The owner waived
and discontinued T098 fresh-checkout certification; it did not pass, the planned
additional 17 identities were not spent, and its receipts remain historical
diagnostics. Prior receipts are preserved and are not rewritten.

Abbreviations: **Cfg** shared startup/config tests; **Mig** protected migration
runner; **DB** pgTAP/dblink; **Edge** Deno source/orchestration tests; **Client**
Jest/component tests; **Browser** M01/M02 or permanent smoke.

## Functional Requirements

| Requirement | Design mechanism | Primary evidence |
| --- | --- | --- |
| FR-001–003 | Canonical server-only YAML, exact artifact bundling, strict module-level parser; handler construction fails; no environment/last-known-good fallback | Cfg process/module/packaging matrix |
| FR-004–007 | Exact approved omissions, required tuning fields, rating domain, BigInt `p/q` normalization | Cfg vectors; DB row checks |
| FR-008–010 | Atomic room/member/snapshot create; snapshot-only consumers; idempotent A/B retry | DB/Mig; Edge create; M01 |
| FR-011 | Explicit legacy snapshot tuple and legacy source/agreement branches | Mig; DB/Edge legacy regressions |
| FR-012 | Every consumer requires one coherent row; no process-config fallback | DB corruption/rollback tests |
| FR-013–014 | Cutoff/comparator-derived metric requirements plus Edge and locked commit cutoff/year/adult validation; irrelevant malformed metrics ignored | Edge required-versus-irrelevant metric matrix; DB commit tests |
| FR-015–017 | OR multi-clause / AND singleton compilation and recomputed handoff | DB resolution; Edge/DB predicate parity |
| FR-018 | Retained language in Discover and assigned/new Details | Edge URL/metadata tests; M02 |
| FR-019–021 | Closed ordering map and total comparator with TMDB-ID tie-break | Edge four-mode/tie/page/shard tests |
| FR-022–024 | Server occurrence exclusions, root re-search, expected-sequence CAS, assigned recovery | DB/Edge Feature 008 regressions; M01 |
| FR-025–029 | N=2 override, exact ceiling for N>=3, N/N-only transaction, fixed membership | Parameterized DB/dblink; M01/M02 |
| FR-030 | Existing immutable occurrence decisions and one-way agreed/rejected transitions | DB regression; Client/Browser |
| FR-031–034 | Required-metric/source failure is `search_incomplete` with no write; irrelevant metric defects do not fail; only full `completed_empty`; same-step retry | Edge conditional-metric/failure matrix; DB; M01 |
| FR-035 | Server snapshot recovery plus existing canonical room refetch | Client generation tests; M01/M02 |
| FR-036–038 | Trusted create, service-only source RPCs, grant-free rules/predicates/decisions, safe errors | DB ACL/RLS; Edge parser; G08/M02 |
| FR-039 | Explicit preservation of Features 003–008 outside named evolutions | Full DB/Edge/Client regression; smoke |
| FR-040 | No Match/early/config UI/alternate source | Client route/component tests; M01/M02 |

## Non-Functional Requirements

| Requirement | Planned evidence |
| --- | --- |
| NFR-001 determinism/consistency | Shared clauses, snapshot-only consumers, total comparator, DB threshold vectors |
| NFR-002 atomic authority | Atomic create; room-locked final decision; expected-sequence candidate commit |
| NFR-003 recoverability | A/B restart, duplicate/lost response, reload/re-entry, same-step retry tests |
| NFR-004 eligibility correctness | Edge/DB cutoff/genre/order matrices with decoys and boundaries |
| NFR-005 failure safety | Invalid startup, corrupt row, conditionally malformed provider metrics, partial traversal/no-empty tests |
| NFR-006 privacy/least privilege | ACL/RLS/catalog tests, safe responses, G08/M02 ordinary-JWT probes |
| NFR-007 backward consistency | Nonempty legacy migration and configured room retention matrix |
| NFR-008 bounded scope | Structure/client absence checks and Browser no-Match/config assertions |
| NFR-009 source continuity | Feature 006/008 Edge and DB regressions plus live TMDB contract |

## Acceptance Scenarios

| Scenarios | Coverage |
| --- | --- |
| 1–7 | Cfg valid/default/invalid/no-reload/restart matrix; DB new A/new B snapshot checks |
| 8–13 | DB atomic retention/idempotency/corruption tests; Mig legacy backfill; Client local-manipulation absence; M01 reload |
| 14–15 | Edge + DB equality/just-below vote and rating boundaries, rating absent case, conditional required-versus-irrelevant metric vectors |
| 16–18 | DB/Edge OR, AND and Any compilation/evaluation |
| 19–20 | Multi-voter year/genre/cutoff predicate and Edge/commit parity |
| 21 | Edge Discover + Details retained-language tests; M02 localized presentation |
| 22–23 | Edge incomplete versus completed-empty plus DB no-write/terminal CAS; M01 visible retry/terminal |
| 24–27 | Edge pairwise four-order matrices, including configured-language title |
| 28 | Edge ties across pages/shards with deterministic secondary order; product allows either primary tie |
| 29–30 | Edge ineligible/excluded top skip plus DB no-repeat constraint |
| 31 | DB/Edge concurrent proposals, response loss, assigned metadata retry; M01 convergence |
| 32 | DB all fractions with N=2 forced threshold 2; M01 |
| 33–34 | DB exact ceiling vectors including default N=3,4,5,6,10 |
| 35–36 | DB incomplete inevitable/impossible sets remain collecting; M02 representative flow |
| 37 | DB voting/non-voting creator count source; M02 |
| 38 | DB A/B fraction retention and final decision under old row |
| 39 | Existing Realtime lattice plus M01/M02 convergence |
| 40 | DB ACL/RLS, G08 and M02 privacy probes |
| 41 | Edge same-ID metadata/source retry and M01 reload |
| 42 | DB agreed late action/config restart denial and M01 stopped state |
| 43 | Client/route absence tests and M01/M02 no Match/config/early UI |

## Success Criteria

| Criterion | Measurement |
| --- | --- |
| SC-001 | All invalid Cfg fixtures fail before handler construction; zero fallbacks |
| SC-002 | A/B restart matrix: old rooms A, new rooms B, zero cross-room drift |
| SC-003 | Every seeded pre-009 state has exact legacy behavior |
| SC-004 | Full cutoff/OR/AND/Any/multi-voter matrix has zero predicate disagreement |
| SC-005 | Four ordering pair matrices choose required unequal-primary winner and skip ineligible/excluded rows |
| SC-006 | Parameterized N=2..10 fractions pass threshold-minus-one/threshold; N=2 always 2 |
| SC-007 | Inevitable/impossible incomplete sets create zero outcomes/source calls |
| SC-008 | Failure/empty matrix has zero weakened predicates or false terminal commits |
| SC-009 | Concurrency/retry/reload/stale matrix yields one candidate and one progression outcome |
| SC-010 | ACL/RLS/ordinary-JWT matrix yields zero unauthorized writes/disclosures |
| SC-011 | Static/client/browser scan finds zero Match, early, hot reload, admin/config UI, participant rules or alternate source |

## Reconciliation Result

- Six user stories: all mapped.
- 43 acceptance scenarios: all mapped.
- 40 functional requirements: all mapped.
- Nine non-functional requirements: all mapped.
- 11 success criteria: all mapped.
- Requirements without a mechanism or evidence: none.
- `NEEDS CLARIFICATION` or `UNRESOLVED`: none.
- Feature 010 Discovery or Feature 011 Match behavior introduced: none.
- Release closure: T102 owner live-TMDB browser recheck PASSED on the latest
  product source. T096/T097 and T100 remain scoped to their earlier source.
  No unresolved Feature 009 functional requirement or release blocker remains;
  Discovery is outside this requirement inventory.
