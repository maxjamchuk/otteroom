# Contract: Feature 002 Candidate Compatibility under Generalized Membership

This document changes only the membership/readiness dependencies of the
completed [candidate RPC](../../002-first-movie-candidate/contracts/candidate-rpc.md)
and [display contract](../../002-first-movie-candidate/contracts/candidate-display.md).
Those historical artifacts, fixtures and poster assets remain unchanged.

## Exact preserved interface

`public.ensure_room_candidate(p_room_id uuid)` returns one row with outcome text,
candidate_id text, title text, release_year smallint and poster_key text.
Available has four non-null candidate fields; not_ready/not_found have four
NULLs. No outcome, argument, metadata or client-visible identity is added.

The function remains postgres-owned SECURITY DEFINER with empty search_path,
explicit PUBLIC/anon revocation and authenticated EXECUTE. auth.uid() is required;
objects remain schema-qualified with no dynamic SQL or client service role.

## Deliberate changes

After locking the exact room FOR UPDATE, authorize by its room_members row for
auth.uid(), including is_voter=false for the creator. Nonexistent/NULL room and
an unrelated existing room return identical not_found shapes. No roster,
ownership UUID or private configuration is disclosed.

Waiting is voter_count < required_voter_count: return not_ready without reading
a selectable movie or changing anything. Ready is equality: return an existing
FK's exact record with no UPDATE; otherwise choose the lowest sort_order row and
assign it once with updated_at. Empty catalog or broken referenced integrity
raises an exception, with no reselection/business fallback. The generalized
rooms_candidate_requires_ready_check prevents Waiting assignment.

Membership, required count, creator flags and room state are never changed by
candidate calls. Candidate and join use the same room lock. No new concurrency
mechanism is introduced. A migrated Ready room retains its existing assignment.

## Preserved behavior and evidence

All three voters, or three voters plus a non-voting creator, automatically acquire
the same fixture after authoritative Ready. Waiting issues no automatic candidate
RPC and shows no candidate. Existing `src/candidates/` behavior and static source
registry stay; update only actual room-type coupling if compilation requires it.
No candidate selection, retry or card redesign is authorized.

Keep one assignment, deterministic selection, idempotent repeated/concurrent
calls without a second UPDATE, recoverable pre-assignment failures and committed
response loss, title/year/poster equality, existing non-lowest FK handling,
isolated foreign/missing response shape, generation guards and reconnect retention.
Poster retry preserves metadata and retries the same local image with zero
candidate RPC calls. No external movie resource or future movie interaction.

Evolve `supabase/tests/database/room_candidate.test.sql` room/member fixtures and
the readiness/security assertions. Retain empty/broken-catalog and rollback
faults, independent authenticated candidate races, lock evidence, per-session
UPDATE counts, xmin and cleanup. Add non-voting creator and three-voter coverage.

F01–F08 retain all eight candidate acceptance classes with explicit two-voter
configuration and generalized room snapshots. G03/G04 add synchronized first
acquisition for three/four authorized clients and recovery/visible-poster proof.
Extend `e2e/support/candidate-harness.ts` only for bounded variable participant
arrays (test cases use 2–4), preserving each request/fault/counter/cleanup rule.
Hold candidate requests when membership-only mutation counters are inspected;
candidate's legitimate UPDATE must not be mistaken for a duplicate admission.

Full 36-scenario and quota mapping is in [quickstart.md](../quickstart.md).
