# Contract: Feature 002 Candidate Suppression during Feature 004

Feature 004 deliberately supersedes the current normal membership Ready → fixture
candidate flow. This is an authority change, not a presentation-only condition.

## Required cutover

The additive Feature 004 migration executes:

```sql
revoke execute on function public.ensure_room_candidate(uuid) from authenticated;
```

PUBLIC and anon remain revoked. The function remains postgres-owned and is not
granted to another client role. The migration also reloads the PostgREST schema
cache after all RPC/ACL changes.

The normal room route removes the `useRoomCandidate` and `CandidateCard` imports,
hook creation, retry path and rendering. No filter action calls a candidate
service. The existing candidate modules/assets may remain unimported historical
or isolated test infrastructure.

Together these rules close every participant path:

| Path | Feature 003 behavior | Feature 004 authority |
| --- | --- | --- |
| Final join / Ready Realtime update | Hook automatically calls ensure | No candidate consumer is mounted |
| Reload/reconnect/re-entry of Ready member | Hook calls ensure/recovery | Filter recovery only; no candidate call |
| Candidate retry | Calls ensure again | No candidate UI/retry exists |
| Direct authenticated RPC | Can assign or return fixture | EXECUTE denied; no assignment/result |
| Direct rooms/catalog SELECT | Hidden by grants/RLS | Remains hidden |
| Existing assigned candidate | RPC returns metadata | FK may persist internally; participant cannot read it |
| All filters complete | Not represented | N/N stops at Feature 005 handoff; no candidate authority |

Do not change the RPC predicate from membership Ready to filter N/N. That would
still bypass missing Feature 005 common resolution and Feature 006 eligible TMDB
acquisition. Do not introduce a placeholder resolved state or production source.

## Historical data and invariant classes

Keep the four fixture rows, local poster assets, `rooms.movie_candidate_id` FK,
and existing assigned values unless a later candidate feature explicitly evolves
them. The migration does not clear or rotate them. They are not evidence of
filter completion and cannot satisfy the Feature 005 handoff.

Meaningful current acceptance evidence:

- fixture relation/FK integrity and exact preservation through migration;
- no direct catalog or hidden candidate-column read;
- no client mutation/assignment privilege;
- missing/foreign room privacy and membership RLS;
- no candidate RPC call, assignment UPDATE or movie UI in every Feature 004 phase;
- a preassigned migrated fixture remains invisible to its authorized members.

Historical-only evidence, no longer a current normal browser oracle:

- membership Ready automatically causes first fixture assignment;
- authenticated members receive `available` metadata;
- clients converge on the same visible fixture card/poster;
- candidate acquisition/poster retry on reload/reconnect;
- candidate assignment browser races and lost-response recovery.

Retire F01–F08 from normal Playwright discovery rather than weakening their old
assertions into contradictory passing behavior. Preserve the completed Feature
002 spec/plan/tasks as history. Adapt SQL/client tests by invariant class. Remove
candidate harness/waits from G03, G04 and G07, remove G08's direct available
probe, retitle candidate-era G04, and adapt affected E helpers to assert
filter-first/no-candidate behavior.

## Required database/browser proof

Database tests use ordinary authenticated JWT/SQL roles and prove:

1. EXECUTE is absent for PUBLIC, anon and authenticated and present only for the
   intended owner/privileged historical boundary.
2. Direct member invocation fails before any room/catalog write for Waiting,
   Ready 0/N, partial and N/N rooms.
3. A Ready room with NULL candidate stays NULL after direct/normal/recovery paths.
4. A migrated Ready room with a valid non-lowest candidate retains its FK but
   neither authorized member can obtain metadata through SQL/RPC.
5. Create/join/refetch/filter recovery/filter submission cause no candidate FK
   or catalog mutation.

Browser tests count outgoing candidate RPCs and require zero at all phase states,
including reload, reconnect, QR/link/code re-entry, submission retries, final
completion and synchronization recovery. They also require no title/year/poster,
candidate error or candidate retry controls in the normal room UI.
