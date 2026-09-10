# Otteroom Product Vision

**Status:** Normative product intent. Established 2026-09-10.

## Purpose

Otteroom is an application for a group of people choosing a movie to watch
together. The minimum meaningful group is two voting participants, and rooms
support more than two voters. Otteroom is not a game.

“Tinder for choosing a movie together” is a useful short analogy. The precise
product behavior is that people configure their own movie filters, consider
eligible shared candidates, and independently swipe to find a movie acceptable
to the group. Mutual or group agreement produces the shared choice.

## Authority and use with Spec Kit

- The [constitution](../.specify/memory/constitution.md) remains authoritative
  for engineering principles, process and quality constraints.
- This document, `docs/product-vision.md`, is authoritative for stable product
  intent and the domain invariants below.
- The [MVP roadmap](mvp-roadmap.md) is authoritative for current feature
  sequencing and decomposition; it can be deliberately revised.
- Individual `specs/NNN-*/spec.md` files define the exact observable requirements
  and release boundary of one feature.
- Implementation plans and tasks must not silently override product intent.
  A deliberate evolution of existing behavior must be explicit in its feature
  specification, with affected contracts, tests and other dependent artifacts
  reconciled according to the constitution before dependent implementation.

Future `$speckit-specify` prompts must read the constitution, this vision, the
roadmap and the immediately relevant completed feature specifications. These
documents establish context; they do not authorize implementing a future feature
without its own specification and acceptance criteria.

## The intended movie-selection flow

1. The creator configures the required voting participant count (default **2**)
   and chooses whether to vote, then creates a room and presents its invitation,
   including a QR code.
2. People join from their own clients as voters. The room waits until the
   configured voting group is assembled; that group is then fixed for the
   selection session.
3. After assembly, each voter configures their own movie filters before candidate
   browsing begins. Initial examples are genres and a release-year range;
   additional criteria may follow in later features.
4. The room resolves the compatibility/intersection of the assembled voting
   group's filters. Every movie presented as a candidate must satisfy
   those resolved common constraints.
5. Voters consider the room's current candidate and decide independently:
   **swipe right means wants to watch; swipe left means does not want to watch**.
6. Authoritative progression and agreement lead to a shared movie choice.

Both filters and normal candidate browsing require the configured voting group
to be assembled. Assembly alone does not establish that filters are complete or
that eligible candidates can be presented. Non-voting creators and displays do
not contribute voter filters. An incompatible common filter result requires
explicit user-visible handling rather than ignoring a voter's constraints.

Independent swiping concerns each person's decision, not separate, potentially
conflicting current movies for the room. A participant can record a decision
without waiting for another person's swipe. The exact filter-resolution,
decision-completion, progression and match semantics belong to the corresponding
feature specifications. For two voters, both swiping right constitutes
agreement. The agreement policy for more than two voters must be resolved
**before or during Feature 008 specification**, before progression rules depend
on it. Feature 008 must distinguish continued browsing from agreement and stop
advancing on agreement; Feature 009 consumes that policy for the match
experience. This vision does not choose the larger-group policy or algorithms.

## People, membership and devices

Membership must be conceptually independent of a fixed host/guest pair. Filters,
swipes and matches must not assume exactly one host and one guest. Two voters
are the minimum meaningful group. The creator configures a required voter count
when creating the room, with a default of **2** and support for larger groups.
This is the number of people required to vote, not the total number of people,
clients or connected devices present. No exact maximum is set here; the future
Feature 003 specification may define the supported UI range.

The following concepts are distinct even when one mobile client serves several
purposes:

| Concept | Product meaning |
| --- | --- |
| Room creator | The person or client that initiates a room and chooses whether to participate as a voter |
| Voting participant | A person occupying one required voter slot and participating in the room's filter and movie-decision process |
| Host/display client | A client that hosts or presents the shared room experience and need not vote |
| Device | The phone, web client or future TV through which a person or display client accesses the room |

For current mobile/web usage, the creator chooses at creation whether to vote.
A voting creator occupies one required voter slot; a non-voting creator occupies
zero slots. Neither mode changes the configured required voter count.

| Required voter count | Creator votes | Voter slots occupied by creator | Additional voters the room waits for |
| --- | --- | --- | --- |
| 2 | Yes | 1 | 1 |
| 3 | Yes | 1 | 2 |
| 2 | No | 0 | 2 |
| 3 | No | 0 | 3 |

For the first MVP, membership readiness means that joined voting participants
equal the configured required voter count. A non-voting creator, host or display
does not count toward that target. Once assembled, the voting group is fixed
for that selection session: additional voters are not admitted. Filters, common
eligibility, candidates and swipe decisions operate on that assembled group.
An active voter is a member of this decision process, not merely a currently
connected device; reload/reconnect preserves existing membership.

Dynamic mid-session voting membership is outside the first MVP. Removal,
replacement, late-voter migration and changing the required voter count during
the session are future scope, with no behavior designed here. The fixed-group
rule governs voting membership; it does not decide which future display or
spectator devices may access a session. Detailed identity and recovery contracts
belong to feature specifications, starting from the verified existing guarantees.

A future TV client may create/host/display a room and contributes **zero votes
and zero voter slots**. The required voter count refers to people voting on
their own devices: they scan the TV's QR code with their phones, join as voters,
then configure filters and swipe after the group is assembled. The TV waits for
the configured voter count and acts as a shared display. A future TV-specific
client may automatically select non-voting creator participation and hide that
choice. This is an optional future platform behavior, not an MVP requirement.
The creator/voter distinction supports it without redesigning the product model;
no TV framework or speculative TV infrastructure is selected here.

## Movie data and application state

**TMDB is the external source of movie catalog data and the authority for movie
metadata.** Otteroom must not become a separately synchronized canonical movie
catalog. Descriptive movie metadata should normally be obtained from TMDB using
the TMDB movie ID.

Otteroom may persist references useful to its own state, including
`tmdb_movie_id`, TMDB genre IDs, provider IDs and other relatively stable external
reference IDs. It also persists its own product state: room membership,
participant filters, candidate/progression state, swipe decisions and matches.
An authoritative room candidate or match references a movie; it does not make
Otteroom authoritative for that movie's descriptive metadata.

Title, release year, poster, backdrop, overview, runtime, rating, cast/crew and
other mutable descriptive metadata must not become an Otteroom-owned canonical
movie database. Candidate and match identity can remain stable across recovery
while descriptive data continues to come from TMDB. The immutable synthetic
metadata used by Feature 002 does not establish permanent metadata-freezing
semantics for real movies.

Future performance or reliability needs may justify caching. Caching is a
separate technical concern whose scope and behavior must be specified when
needed; it must not change the movie-metadata source of truth. This vision
neither bans every cache nor selects a cache design or lifetime.

## Invitations and platforms

QR invitation is a first-class product flow: create a room, display its QR code,
scan it from another client, and join the represented room. QR joining is
required in the web development version as well, to support convenient
real-device/manual joining and prepare the mobile workflow. Invitation links
and room codes may coexist as alternatives. A QR code represents the approved
invitation/join target; it does not create a separate identity or authorization
model.

**Mobile is the primary platform and UX target**, especially for swipe
interactions. React, React Native / Expo and Supabase support the direction of
shared client code and minimal custom backend infrastructure. This direction
does not require adding backend services or client frameworks in advance.

Web remains functional for access and is especially important for development,
automated browser testing, debugging and manual validation. Desktop-web UX must
not define or constrain the final mobile interaction design. Current web
acceptance evidence is valuable without implying that native runtime behavior
has already been validated.

TV clients are an intended post-MVP direction. Their non-voting host/display
workflow must remain possible without redefining fundamental participant
semantics; the complete TV UI and framework are outside this vision's decisions.

Streaming-provider availability filtering is also a future direction. TMDB
provider/availability-related data and identifiers may support restricting
candidates to selected services, including regional selection in a later
feature. This capability is outside the first MVP unless the roadmap is
deliberately revised to promote it. No provider-filter behavior is authorized now.

## Completed slices and deliberate evolution

[Feature 001](../specs/001-room-session/spec.md) proved create/join, invitations,
authoritative membership and reconnect with exactly two host/guest seats.
[Feature 002](../specs/002-first-movie-candidate/spec.md) proved a shared,
authoritative candidate, display and recovery with four synthetic local movies
shown directly after Ready. They are intentionally small verified slices.

Their fixed seats, direct Ready-to-movie workflow and four synthetic movie
fixtures are temporary constraints. The fixtures are strictly development and
acceptance infrastructure, not the production catalog, intended metadata source
or evidence for a future local canonical movie catalog. Later features are
expected to replace that temporary candidate source with TMDB.

Feature 001's Ready condition remains valid for its completed two-seat slice.
Feature 003 deliberately evolves membership completion to mean that the
configured required voting group has been assembled. The roadmap subsequently
introduces filters after assembly and before real candidate
browsing and replaces the fixture source. These documents do not rewrite
completed features or change current runtime behavior. Later feature work must
explicitly evolve the relevant boundaries while preserving the verified
membership, privacy, concurrency, retry and reconnect foundations.

## Product and domain invariants

1. Otteroom helps people choose a movie together; it is not a game.
2. A meaningful voting room has at least two voters.
3. Rooms support more than two voters; no arbitrary maximum is set here.
4. Room creation includes a configured required voter count, defaulting to 2.
5. Room creator and voting participant are separate concepts; the creator
   chooses at creation whether to vote, including on mobile/web.
6. A voting creator occupies one required voter slot; a non-voting creator
   occupies zero slots.
7. Membership completion is based on the required voters, not raw client/device
   count. A host/display client need not be a voter.
8. For the first MVP, the voting group becomes fixed when the configured voter
   count is assembled; additional voting joins are not admitted to that session.
9. Dynamic mid-session voting membership is outside the first MVP.
10. Filters begin after assembly and candidate browsing follows filter completion
    and common resolution; eligibility reflects the assembled voters' compatible
    common constraints. Non-voting clients contribute no voter filters.
11. Movie decisions belong to the assembled voting group and are independent
    right/left swipes: wants/does not want to watch.
12. TMDB is authoritative for movie metadata.
13. Otteroom may persist external reference IDs and its own application state.
14. Feature 002 fixture movies are temporary development/acceptance infrastructure.
15. Mobile is the primary UX target.
16. Web remains supported for development/testing and functional access.
17. QR joining is a first-class product flow, including on development web.
18. Future TV host/display creators contribute zero votes and voter slots,
    without redefining fundamental participant semantics. TV remains post-MVP.

## Decisions outside this document

This vision does not choose an exact database schema, room-member table design,
role enum, maximum voter count, agreement threshold for more than two
voters, filter-intersection SQL or algorithm, TMDB endpoint, caching TTL, swipe
animation library, mobile navigation, TV framework or provider-filter algorithm.
Those details belong to the relevant feature specifications and plans, subject
to the product invariants and constitutional scope rules. The larger-group
agreement decision has a mandatory deadline: before or during Feature 008
specification, before dependent progression rules are approved.
