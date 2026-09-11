# Otteroom MVP Roadmap

**Status:** Normative current sequencing and directional feature decomposition.
Established 2026-09-10. Features 001–003 are complete; 004–009 are planned.

## Authority and feature boundaries

- The [constitution](../.specify/memory/constitution.md) remains authoritative
  for engineering principles, process and mandatory quality constraints.
- The [product vision](product-vision.md) is authoritative for stable product
  intent and domain invariants.
- This document, `docs/mvp-roadmap.md`, is authoritative for the current feature
  sequence and decomposition. It can be deliberately revised rather than
  changed implicitly by a plan or implementation.
- Individual `specs/NNN-*/spec.md` files define one feature's exact observable
  requirements, acceptance criteria and release boundary. This roadmap is not
  a substitute for those specifications.
- Implementation plans and tasks must not silently override the product vision.
  Changes to dependent contracts, tests and other artifacts follow the
  constitution's consistency and impact-review requirements.

Future `$speckit-specify` prompts must read the constitution, product vision,
this roadmap and the immediately relevant completed feature specifications.
**Feature boundaries may be refined during `$speckit-specify` as long as the
product-vision invariants are preserved.** Material changes to sequencing or
decomposition must be deliberately reflected here. Each feature still needs a
bounded, independently verifiable result before the next feature begins; the
roadmap does not authorize implementing the whole MVP at once.

## Sequence and completed baseline

| Feature | Name | Status | Main product result |
| --- | --- | --- | --- |
| 001 | Room Session | COMPLETE | Create/join a room with authoritative membership and reconnect |
| 002 | First Movie Candidate | COMPLETE | One shared authoritative fixture candidate and stable display/recovery |
| 003 | Generalized Room Membership & QR Join | COMPLETE | Configured required voter count, creator voting choice, fixed group assembly and QR joining |
| 004 | Participant Filters | COMPLETE | Each assembled voter configures recoverable genres and release-year filters |
| 005 | Common Filter Resolution | PLANNED | Resolve compatible candidate constraints across the assembled voting group |
| 006 | TMDB Candidate Source | PLANNED | Real eligible TMDB candidates with stable room assignment |
| 007 | Swipe Decisions | PLANNED | Independent, persistent right/left decisions per voter and candidate |
| 008 | Candidate Progression | PLANNED | Recoverable progression governed by resolved agreement semantics; stop advancing on agreement |
| 009 | Match | PLANNED | Authoritative shared choice and match experience using the established agreement rule; first useful MVP boundary |

The current order is **001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009**.
Generalized membership precedes filters, swipes and matches so those concepts do
not inherit fixed host/guest seats. The configured voting group assembles and
becomes fixed before filters begin. Individual filters precede common resolution;
resolution precedes production candidate acquisition; independent decisions
precede progression. The agreement policy for more than two voters must be
resolved before or during 008 specification so progression can distinguish
continuing from agreement. Feature 009 then delivers the completed match
experience using that already-resolved policy.

### 001 — Room Session — COMPLETE

Proved room creation, invitation link/code, a second participant joining,
Waiting → Ready, authoritative membership, privacy and reconnect continuity.
See its [specification](../specs/001-room-session/spec.md),
[plan](../specs/001-room-session/plan.md) and
[completed tasks](../specs/001-room-session/tasks.md).

Its exactly two host/guest seats are a temporary feature limitation, not the
long-term room model. This small verified slice remains the foundation for safe
creation, joining and membership recovery.

### 002 — First Movie Candidate — COMPLETE

Proved one authoritative shared candidate, convergence of both clients, title /
release year / poster display, reload/reconnect stability, and concurrency,
retry and failure safety. See its
[specification](../specs/002-first-movie-candidate/spec.md),
[plan](../specs/002-first-movie-candidate/plan.md) and
[completed tasks](../specs/002-first-movie-candidate/tasks.md).

The four synthetic local fixtures and movie display immediately after Ready are
temporary development/acceptance scaffolding. They are not the intended
production catalog or final workflow. Feature 002 demonstrated authority and
recovery before integration with external movie data; future work carries those
guarantees into the filter-first TMDB flow.

## Proposed MVP features

### 003 — Generalized Room Membership & QR Join — COMPLETE

**Goal:** Assemble a configured voting group without fixed host/guest seats,
support voting or non-voting creators, and make QR invitation/join a working
product flow.

Expected product result:

- At creation, the creator configures the **required voting participant count**,
  default **2**, and chooses whether to participate as a voter. Both creator
  modes are available for mobile/web usage.
- The minimum meaningful voting group is two, with support for more than two
  voters. No maximum is chosen here; the 003 specification defines the allowed
  UI range. The configured count refers to required voters, not the total
  people, clients or connected devices in the room.
- A voting creator occupies one required voter slot; a non-voting creator
  occupies zero. Required 2 / creator voting means waiting for 1 additional
  voter; required 3 / voting means waiting for 2; required 2 / non-voting means
  waiting for 2; required 3 / non-voting means waiting for 3.
- Membership is conceptually independent of a fixed host/guest pair; future
  filters, votes and matches are not forced to use those fixed seats.
- The room waits until **joined voting participants equal the configured
  required voter count**. Non-voting creator/host/display clients do not count
  toward assembly. Membership completion then means that the configured voting
  group is assembled, deliberately evolving Feature 001's two-seat Ready rule.
- Once assembled, the first-MVP voting group is fixed for that selection
  session. Later voting joins are not admitted; exact error wording and UI
  belong to the 003 specification. Filters and normal candidate browsing begin
  only after assembly, in the later features that own those flows.
- The creator sees the room's QR invitation, and voters scan it to join from
  their own clients. This includes the functional web development version and
  convenient real-device joining.
- Invitation links and room codes continue to work where useful, under the same
  approved invitation and identity semantics; QR does not introduce a new identity.
- Creator, voting participant and host/display remain distinct concepts, leaving
  room for a future TV creator/host/display that contributes zero votes and zero
  voter slots and waits for the configured voters to join from phones by QR.

Preserve Feature 001's working create/join, authorized membership, isolation,
duplicate/concurrent-operation safety and reconnect behavior. The exact-two-seat
constraint and membership completion condition are the explicit subjects of
evolution. Feature 001 remains a valid completed constrained slice and is not
rewritten retrospectively.

Feature 003 does not implement filters, swipes, candidate progression or TV.
Dynamic mid-session voting membership is outside the first MVP: removal,
replacement, late-voter migration and changes to the configured voter count are
not designed here. Fixed voting membership does not settle access rules for
every possible future display/spectator device. No UI widget, schema,
membership API, Realtime mechanism, QR library/encoding or TV implementation is
selected here.

### 004 — Participant Filters

**Goal:** After the configured voting group is assembled, each voter configures
their own movie filters before candidate browsing begins.

Expected product result:

- At least genres and a release-year range are available in the MVP filter surface.
- Filters belong to individual members of the assembled voting group and are
  persisted/recoverable. Non-voting creators and displays contribute no voter
  filters.
- Each configured voter completes their own filter input. Whether and when
  existing voters may edit it is a decision for the future 004/005 specifications.
- The room determines whether every voter in that configured, assembled group
  has completed the input needed for common resolution; membership Ready alone
  is insufficient for candidate browsing.
- Late-voter filter invalidation is outside this slice because new voting
  members are not admitted to an already assembled first-MVP session.

The feature owns the minimal filter vocabulary/reference needs of its own
usable slice, without depending on unimplemented candidate acquisition in 006.
Production movie candidates are not fetched or shown here unless the future
004 specification deliberately includes an extremely small validation slice;
any such slice must still preserve filter-first eligibility. The feature
specification must make the transition from 002's immediate fixture display
explicit. Filter algorithms and implementation choices are not decided here.

### 005 — Common Filter Resolution

**Goal:** Derive the room's common eligible filter constraints across the
assembled active voting group defined by the room session.

Expected product result:

- Candidate eligibility reflects every assembled voter's filters through their
  compatibility/intersection; no voter's constraints are silently ignored.
- The group remains the one assembled for this selection session; current
  connection status does not redefine it. Non-voting clients supply no filters,
  and late voting joins do not trigger dynamic membership re-resolution.
- Incompatible or empty intersection has explicit user-visible behavior.
- If the future 004/005 specifications permit existing voters to edit filters,
  those changes must not silently leave stale resolved constraints in use.
  Those specifications define the editing policy and observable resolution
  lifecycle; neither is chosen here.

This feature owns common resolution, not a particular SQL query or algorithm.
Its result supplies the eligibility prerequisite for the TMDB candidate source.

### 006 — TMDB Candidate Source

**Goal:** Replace Feature 002's synthetic fixtures as the normal product
candidate source with real TMDB movies that satisfy resolved room filters.

Expected product result:

- Real candidates come from TMDB according to the room's common constraints.
- Otteroom may store `tmdb_movie_id` for authoritative candidate/application state,
  together with useful stable external references such as genre or provider IDs.
- Title, release year, poster and other displayed descriptive movie metadata
  come from TMDB, normally looked up using the movie ID.
- There is no separately synchronized local canonical movie catalog. Any future
  caching is a technical concern and does not change metadata ownership.
- The room's candidate remains authoritative and its identity stable across
  reload/reconnect and recovery. Mutable TMDB metadata is not made permanently
  immutable by the fixture-era display contract.
- Synthetic Feature 002 fixtures cease to be the normal product source; they
  remain development/acceptance infrastructure where appropriate.

During 006 planning, research TMDB API access, authentication, rate limits,
attribution and image requirements using official current sources. Do not infer
an endpoint, secret-handling design or cache lifetime from this roadmap. The
constitution's credential and least-privilege requirements continue to apply.

### 007 — Swipe Decisions

**Goal:** Each member of the assembled voting group independently decides on the
current candidate.

Expected product result:

- The primary interaction is swipe right to express wanting to watch and swipe
  left to express not wanting to watch.
- There is one authoritative decision per participant/current candidate,
  preserved through reload/reconnect.
- A participant does not need to wait for another voter before recording their
  own swipe. Independent decisions do not imply separate current candidates.
- The interaction is designed primarily for mobile; web provides an equivalent
  usable interaction for development, testing and functional access.

Feature 007 owns authoritative independent left/right decisions. It need not
resolve the larger-group agreement policy unless its future specification
deliberately requires that decision. Decision lifecycle details and any
implementation library belong to the 007 specification and plan. Agreement
semantics must be established by 008 specification; final match UX belongs to 009.

### 008 — Candidate Progression

**Goal:** After the required decisions for the current candidate are resolved,
advance the room to another eligible TMDB candidate when appropriate.

**Product decision point:** The agreement threshold/policy for more than two
voters must be resolved **before or during Feature 008 specification**, before
any dependent progression rule is approved. This roadmap chooses no
larger-group rule. The decision must be explicit in the relevant specification,
rather than inferred from the original host/guest model. For two voters, both
swiping right constitutes agreement.

Expected product result:

- Using the resolved agreement semantics, a current candidate that does not
  satisfy agreement may allow progression when the feature's other decision
  completion conditions are met.
- A current candidate that satisfies agreement must not advance to another
  candidate; progression stops and hands off to Match behavior.
- All members of the assembled voting group converge on the same current candidate.
- Clients do not diverge into independently chosen candidates.
- Already-resolved candidates are not accidentally re-presented within the
  session according to the feature's explicit contract.
- Progression is authoritative and recoverable through reload/reconnect.

The 008 specification defines the observable conditions for appropriate
progression, the agreement handoff and a verifiable release boundary using the
resolved policy. Stopping and handing off must be demonstrable without an
unimplemented 009 UI. Feature 008 does not implement Match UI; Feature 009 adds
the shared-choice experience using the same semantics. Queue/database mechanics
are not decided here.

### 009 — Match

**Goal:** Produce the successful shared movie choice.

Expected product result:

- The already-resolved agreement condition produces one authoritative match.
- All participants converge on the same matched `tmdb_movie_id`.
- The match screen presents current movie metadata from TMDB.
- Reload/reconnect preserves the match; no participant receives a contradictory one.

Feature 009 consumes the agreement semantics established before or during 008
specification; it is not the first feature to determine whether agreement
happened. It owns the authoritative matched `tmdb_movie_id`, convergence, match
presentation and recovery. The two-voter rule remains both swiping right; the
exact larger-group policy is left for the mandatory 008 decision point above.

## First useful MVP boundary

The first MVP is complete after **Feature 009 Match**, provided all prior feature
acceptance remains green under the explicitly evolved contracts. It supports:

- Creating rooms with a required voter count (default 2) and a creator voting
  choice, and joining them through QR or the invitation alternatives.
- At least two voters and support for more than two. A voting creator occupies
  one voter slot and a non-voting creator zero; connected devices do not define
  membership readiness.
- A fixed voting group once the configured voter count is assembled, followed
  by recoverable voter filters and common filter resolution before browsing.
- Real TMDB candidates, independent left/right swipes, authoritative candidate
  progression and one shared match.
- Reload/reconnect, a functional web version and mobile-compatible architecture
  with mobile as the primary interaction target.

Preserving acceptance means retaining the verified safety and continuity
guarantees while deliberately specifying changed capacity, eligibility, source
and progression behavior. It does not freeze obsolete two-seat, fixture-only or
immediate-Ready-display assertions. The feature performing each evolution must
reconcile affected requirements and acceptance evidence; this document neither
rewrites completed features nor licenses weakening unrelated guarantees.

Dynamic mid-session voting membership is outside the first MVP. The first MVP
does not require a TV client, streaming-provider availability filtering,
permanent user accounts, a social graph, recommendation ML, production
analytics, notifications, advanced movie details, watch history or monetization.
Native UX polish and production platform rollout are not implied by a passing
web acceptance suite.

## Post-MVP direction

The following are non-binding directions, not current feature requirements:
polished native mobile UX; production QR/deep-link flows; a non-voting TV
host/display application; streaming-provider availability filters and provider
selection by region; richer room controls; and other later product improvements
approved through their own specifications. Production QR/deep-link polish builds
on the working QR joining already required by 003, rather than deferring that
MVP flow. TV compatibility likewise does not bring a TV client into the first MVP.
A future TV client may automatically choose non-voting creator participation and
hide that choice; it still waits for the configured phone voters and contributes
zero voter slots or votes. Future dynamic voting membership would require its
own approved scope; no removal, replacement or late-join behavior is designed here.
