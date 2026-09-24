# Feature Specification: Selection Rules and Candidate Ordering

**Feature Branch**: `main` (existing branch; no feature branch created)

**Feature Number**: 009

**Feature Slug**: `selection-rules-candidate-ordering`

**Created**: 2026-09-20

**Status**: RELEASE-COMPLETE; READY TO COMMIT. The owner's latest-product-source
manual live-TMDB mixed-clause browser recheck PASSED after the source correction;
no Feature 009 release blocker remains. T096/T097 passed for their earlier
tested source at 45 charged identities; T100 G5 passed for that source. Those
receipts do not certify the later correction. The owner waived
and discontinued T098 fresh-checkout certification; it did not pass, its planned
additional 17 identities were not spent, and its diagnostics remain historical.
Feature 010 Discovery and Feature 011 Match remain unstarted.

**Input**: User description: "Add startup-validated external selection rules for
candidate eligibility, ordering, within-voter genre matching and larger-group
agreement; retain the effective rules per room, preserve pre-Feature-009 room
behavior, and reuse the Feature 006 source and Feature 008 progression contracts
without Match presentation or early resolution."

## Scope

### Goals

- Establish one explicit, validated server rule configuration before rooms can
  be created or candidate selection can run.
- Give each newly created room an immutable effective rule set covering
  candidate ordering, minimum vote count, optional minimum average rating,
  metadata language, within-voter genre matching and larger-group agreement.
- Make candidate retrieval and final eligibility validation apply the same
  cutoff, language and genre meanings while continuing to satisfy every fixed
  voter's filters.
- Order eligible, not-yet-presented candidates by one supported rule while
  preserving Feature 008's authoritative no-repeat progression.
- Preserve exactly-two agreement, introduce an exact configurable fraction for
  larger rooms, and continue waiting for every fixed voter to decide.
- Keep existing rooms on the rules that governed them before or at creation,
  even after configuration changes and server restarts.
- Preserve the existing distinction among an assigned candidate, incomplete or
  failed source work, and a completed search that genuinely found no eligible
  unpresented candidate under the room's retained rules.

### Terminology and Rule Meanings

- **Server rule configuration**: The external, operator-controlled selection
  settings read and validated when the server starts. Participants do not edit
  these settings, and a running server does not reload them.
- **Effective room rule set**: The complete selection semantics retained by a
  room at creation: ordering, cutoffs, metadata language, within-voter genre
  mode and larger-group agreement fraction. It is room application state, not
  mutable participant preference.
- **Pre-Feature-009 room**: A room created before Feature 009 rules could be
  retained. It continues under the legacy behavior established by Features
  005, 006 and 008 rather than inheriting the configuration present at upgrade
  or restart.
- **Minimum vote count**: A non-negative whole-number eligibility cutoff. A
  candidate is eligible only when its source vote count is at least this value.
  The initial `500` value is historical. The current YAML value is `100`; it is
  editable deployment configuration, not an immutable product constant.
- **Minimum average rating**: An optional eligibility cutoff. When configured,
  a candidate is eligible only when its source average rating is at least this
  value; when absent, average rating imposes no eligibility restriction. The
  approved initial operational value is no cutoff, encoded by omitting the
  optional YAML field rather than supplying explicit `null`.
- **Metadata language**: The configured language variant used consistently for
  candidate retrieval and the existing TMDB-authored candidate presentation.
  It does not make Otteroom the authority for translated movie metadata.
- **Within-voter genre mode**: How one voter's nonempty selected genres are
  interpreted. `OR` means the candidate has at least one selected genre; `AND`
  means it has every selected genre. An empty selection remains Any genre and
  imposes no genre restriction in either mode.
- **Across-voter rule**: Every fixed voter's filter predicate must be true. The
  within-voter mode never changes this cross-voter requirement and never permits
  a voter or constraint to be omitted.
- **Candidate ordering rule**: The primary comparison used to choose among
  eligible, not-yet-presented movies. It affects sequence, not eligibility.
- **Required source metric**: A TMDB numeric field consumed by at least one active
  retained cutoff or by the retained primary comparator. `vote_count` is required
  when a minimum vote count or vote-count ordering applies; `vote_average` is
  required when a minimum average rating or average-rating ordering applies; and
  `popularity` is required only for popularity ordering. A metric not consumed by
  the active retained rules is irrelevant to source completeness.
- **Exact agreement fraction (`p/q`)**: A positive rational value no greater
  than one, represented without converting it to an approximate percentage.
  For `N >= 3`, the required yes count is `ceil(N * p / q)`.
- **Complete required decision set**: The unchanged Feature 008 condition of
  one accepted decision from every voter in the fixed assembled group for the
  same current candidate.
- **Source failure**: Incomplete, malformed, unavailable or otherwise failed
  candidate-source work. It remains retryable where the established source
  contract permits and cannot establish exhaustion.
- **Genuine exhaustion**: A stable no-candidate or no-further-candidate outcome
  reached only when one bounded, error-free source attempt completes all work
  required by the approved search contract and observes no eligible,
  not-yet-presented movie under the room's complete retained rules.

### Supported Rules and Defaults

| Rule | Supported meaning | Default or omission behavior |
| --- | --- | --- |
| Candidate ordering | Vote count descending; average rating descending; popularity descending; title ascending | Vote count descending |
| Minimum vote count | Candidate vote count is greater than or equal to the configured non-negative whole number | Required; initial historical value `500`, currently `100`, editable on a later restart/redeploy |
| Minimum average rating | Candidate average rating is greater than or equal to the configured value | Optional; initially omitted, meaning no rating cutoff |
| Metadata language | One valid language selection used for source retrieval and candidate metadata | Required; initial canonical value `en-US`, with no new participant-facing choice |
| Within-voter genres | `OR` for at least one selected genre; `AND` for every selected genre | `OR` |
| Agreement for exactly two voters | Exactly two yes decisions | Always fixed; configuration cannot weaken it |
| Agreement for three or more voters | `ceil(N * p / q)` using an exact positive fraction at most one | Exactly `2/3` |
| Resolution timing | Resolve only after all `N` fixed voters decide | Always full-set; no early resolution |

Descending ordering means larger values precede smaller values. Ascending title
ordering means titles from the configured metadata language are considered in
alphabetical order. Movies equal under the configured primary comparison are
tied; Feature 009 makes no product promise about their relative order, but any
chosen candidate must satisfy every eligibility rule and established authority,
retry and no-repeat guarantees.

Fields with an approved default may be omitted and receive that exact default.
An explicitly supplied unsupported or malformed value is invalid and MUST NOT
be silently replaced by a default. The configuration format and representation
of exact fractions and language identifiers are planning decisions.

The current operational YAML sets `minimum_vote_count: 100`,
`metadata_language: en-US`, `ordering: popularity_desc`, `genre_mode: or`, and
`larger_group_agreement: 2/3`; `minimum_average_rating` is omitted. These
editable values apply to newly created rooms after startup, while existing rooms
retain their snapshots. The supported modes and rule semantics above are the
product requirements; the current values are not fixed product requirements.

### Deliberate Evolution from Features 005, 006 and 008

Feature 005 established OR within each voter's genres and AND across voters.
Feature 009 keeps the across-voter requirement and deliberately makes only the
within-voter operator configurable for new rooms. Filter combination,
candidate retrieval and final eligibility validation must all use the same
retained mode. A valid AND predicate with no catalog match is genuine source
exhaustion after complete search, not filter incompatibility and not permission
to fall back to OR.

Feature 006 established the authoritative TMDB source, exact year and genre
validation, metadata ownership, candidate privacy, failure taxonomy and one
stable room assignment. It deliberately promised no ranking and used `en-US`
with no vote-count, average-rating or popularity eligibility rule. Feature 009
adds explicit ordering, vote/rating cutoffs and configurable metadata language
for newly created rooms while retaining Feature 006's authority, bounded-search,
recovery and safe presentation contracts.

Feature 008 established full-set resolution, exactly two yes votes for two
voters, a fixed exact two-thirds threshold for larger rooms, no-repeat
progression, and the distinction between failed source work and stable
exhaustion. Feature 009 preserves all of those contracts except that rooms
created under Feature 009 retain the configured exact fraction for `N >= 3`.
The two-voter rule and complete-decision-set timing do not become configurable.

Pre-Feature-009 rooms preserve the completed baseline: Feature 005 OR-within /
AND-across genres, Feature 006 `en-US` metadata and any-eligible selection with
no vote-count or average-rating cutoff, and Feature 008's exact `2/3`
larger-group fraction. Feature 009 does not reinterpret historical room
creation under a newly deployed configuration.

### Release Boundary and Non-Goals

This release begins when the server validates external selection configuration
at startup and when a room is created under the resulting effective rules. It
ends when candidate acquisition, eligibility, ordering, progression and
agreement consistently honor the room's retained rules across normal use,
restart, recovery, retry and legacy-room access.

This feature explicitly excludes:

- Match screens, cards, navigation, celebration, confirmation, post-match
  actions or any other Feature 011 presentation;
- early agreement or non-agreement resolution before all fixed voters decide;
- hot reload, live configuration mutation, an administration UI, a
  configuration service or any new participant-facing setting;
- creator- or voter-selected ordering, cutoffs, genre mode, language, threshold
  fraction, difficulty or room mode;
- a second movie source, recommendation model, personalized ordering, random
  ordering, provider availability or a synchronized local movie catalog;
- Feature 010 Discovery or randomized recommendations; Seen/watched history and
  a candidate traversal cursor remain separate deferred ideas, not prerequisites;
- weakening filters, lowering cutoffs, changing AND to OR, ignoring a voter or
  using fixtures when no eligible movie remains;
- changes to Feature 003 fixed membership, required voter count, creator voting
  role, admission, removal, replacement or late-join behavior;
- filter editing after Feature 004 freeze, decision editing, decision-value
  changes or progression after agreement; and
- configuration syntax, file/environment layout, persistence schema, migration
  mechanics, transaction design, source request encoding, collation/tie-breaking
  mechanics, component boundaries or deployment topology.

## User Scenarios & Testing *(mandatory)*

Scenario numbers are unique across stories. Unless stated otherwise, rooms use
the completed fixed-membership, filter, candidate, decision and progression
flows from Features 003–008. Re-entry means same-local-identity recovery under
the established contracts, not permanent-account or cross-device recovery.

### User Story 1 - Start Only with a Valid Rule Configuration (Priority: P1)

As an operator, I can start the server only with a complete, valid selection
configuration so rooms never run under ambiguous or silently corrected rules.

**Why this priority**: Every later room and candidate decision depends on one
known rule set; accepting invalid input would undermine all observable results.

**Independent Test**: Start with valid configurations covering every supported
ordering and genre mode, then try malformed, unsupported and out-of-range rule
values and verify that valid settings become effective while invalid settings
produce explicit startup failure and no fallback server behavior.

**Acceptance Scenarios**:

1. **Given** a valid configuration with all required tuning values, **When** the
   server starts, **Then** startup succeeds and the exact configured rules and
   approved defaults are available for new-room creation.
2. **Given** ordering is omitted from an otherwise valid configuration, **When**
   the server starts, **Then** the effective ordering is vote count descending.
3. **Given** within-voter genre mode or the larger-group fraction is omitted,
   **When** the server starts, **Then** the effective values are respectively
   `OR` and exact `2/3`.
4. **Given** minimum average rating is omitted, **When** the server starts,
   **Then** startup succeeds with no average-rating eligibility cutoff.
5. **Given** a required tuning value is missing, a number is invalid, the exact
   fraction is non-positive or greater than one, or an ordering, genre mode or
   language value is malformed or unsupported, **When** startup is attempted,
   **Then** startup fails explicitly and no value is silently corrected,
   weakened or replaced.
6. **Given** a server is already running, **When** its external configuration is
   edited without a restart, **Then** its effective rules do not change.
7. **Given** an operator wants different rules, **When** the configuration is
   edited and the server restarts successfully, **Then** only rooms created
   under the new effective configuration receive the new rules.

---

### User Story 2 - Retain Each Room's Effective Rules (Priority: P1)

As a room member, I receive consistent selection and agreement behavior for the
life of my room even when the server configuration changes or the server
restarts.

**Why this priority**: A room whose rules drift mid-session could change which
movies are eligible or how many yes votes are needed after people have already
filtered or voted.

**Independent Test**: Create a room under rule set A, restart under distinct
rule set B, create another room, and verify that the first room still uses A,
the second uses B, and a pre-Feature-009 room retains the legacy baseline.

**Acceptance Scenarios**:

8. **Given** a new room is created under valid rule set A, **When** its filters,
   candidate source and decisions are later processed, **Then** every stage uses
   A even if the external configuration has since changed.
9. **Given** a room created under A and a successful restart under B, **When**
   both that room and a newly created room continue, **Then** the older room
   uses A and the newer room uses B without cross-room rule leakage.
10. **Given** a room created before Feature 009, **When** it is opened or
    progresses after Feature 009 deployment, **Then** it retains the legacy
    Feature 005/006/008 behavior and does not inherit the current configuration.
11. **Given** a voter reloads, reconnects or re-enters with the same identity,
    **When** room state is recovered, **Then** the room uses the same retained
    rules without requiring the voter to choose or confirm them.
12. **Given** a client supplies or manipulates local ordering, cutoff, genre,
    language or fraction values, **When** it interacts with the room, **Then**
    those values cannot replace or amend the authoritative retained rule set.
13. **Given** a room's retained rule set is absent or internally inconsistent
    where Feature 009 rules are required, **When** selection or resolution is
    attempted, **Then** the operation fails closed and does not apply the current
    startup configuration as a silent repair.

---

### User Story 3 - Apply Consistent Candidate Eligibility (Priority: P1)

As a fixed voting group, we see only candidates that satisfy every voter's
filters and the room's retained global cutoffs under one consistent genre rule.

**Why this priority**: Ordering has value only after the complete, unweakened
eligibility predicate is applied consistently.

**Independent Test**: Use controlled candidate data around year, vote-count and
rating boundaries with multi-genre filters in both OR and AND rooms; verify
that resolution, retrieval and final validation accept exactly the same movies.

**Acceptance Scenarios**:

14. **Given** a candidate whose vote count equals the room minimum, **When** it
    is validated with every other rule satisfied, **Then** it is eligible; a
    candidate one vote below is not.
15. **Given** an optional average-rating cutoff, **When** candidates equal and
    fall below it, **Then** the equal candidate may be eligible and the lower
    candidate is not; when the cutoff is absent, rating alone excludes neither.
16. **Given** an OR-mode voter selected multiple genres, **When** a candidate
    contains at least one selected genre, **Then** that voter's genre predicate
    is satisfied; a candidate containing none does not satisfy it.
17. **Given** an AND-mode voter selected multiple genres, **When** a candidate
    is considered, **Then** it satisfies that voter only if it contains every
    selected genre, and the system never changes the predicate to OR.
18. **Given** one voter selected Any genre, **When** eligibility is resolved and
    checked, **Then** that voter contributes no genre restriction under either
    mode and every other voter's restrictions still apply.
19. **Given** several voters with different genre and year filters, **When** a
    candidate is considered, **Then** it must satisfy each voter's predicate,
    the common inclusive year range, both configured cutoffs and all unchanged
    Feature 006 content rules.
20. **Given** candidate retrieval proposes a movie, **When** final eligibility
    is validated, **Then** both steps use the same room-retained mode, cutoffs,
    language and fixed-voter constraints; a mismatch cannot create an assignment.
21. **Given** the configured metadata language differs from the legacy language,
    **When** a candidate is acquired and displayed, **Then** retrieval and the
    existing title/year/poster-or-fallback presentation use the retained language
    while the assigned TMDB identity remains authoritative.
22. **Given** no movie satisfies the full predicate, **When** source work is
    incomplete or fails, **Then** the room reports source failure rather than
    exhaustion and does not weaken a filter or cutoff.
23. **Given** no movie satisfies the full predicate and one bounded source
    attempt completes all required work without error, **When** the result is
    committed, **Then** the room reaches the established stable exhaustion path
    without fallback, filter weakening or a claim beyond that completed attempt.

---

### User Story 4 - Receive Candidates in the Configured Order (Priority: P1)

As a room member, I receive eligible, not-yet-presented candidates according to
the room's retained ordering rule so progression follows a predictable policy.

**Why this priority**: Candidate ordering is the feature's primary change to
which eligible movie is considered next.

**Independent Test**: For each supported ordering, provide several eligible
unseen movies with distinct primary values and verify the room receives them in
the required order while ineligible and previously resolved movies are skipped.

**Acceptance Scenarios**:

24. **Given** eligible unseen movies with distinct vote counts and the default
    rule, **When** a candidate is acquired, **Then** the highest vote count is
    selected before every lower vote count.
25. **Given** average-rating ordering and eligible unseen movies with distinct
    average ratings, **When** candidates progress, **Then** higher average
    ratings precede lower averages regardless of their vote-count order, while
    the minimum vote and optional rating cutoffs still apply.
26. **Given** popularity ordering and eligible unseen movies with distinct
    popularity values, **When** candidates progress, **Then** higher popularity
    precedes lower popularity.
27. **Given** title ordering and eligible unseen movies with distinct titles in
    the configured language, **When** candidates progress, **Then** titles are
    considered in ascending alphabetical order.
28. **Given** movies tied under the primary ordering value, **When** one becomes
    current, **Then** either tied movie may precede the other, but the selected
    movie must be fully eligible and all authority and no-repeat rules still apply.
29. **Given** the highest-ordered movie is ineligible under any voter filter or
    global cutoff, **When** acquisition runs, **Then** it is not assigned and the
    next candidate must still satisfy the entire predicate.
30. **Given** the highest-ordered eligible movie was already resolved in this
    room, **When** Feature 008 progression requests another candidate, **Then**
    that movie is excluded and the next eligible unseen movie is considered.
31. **Given** concurrent acquisition, retry, a lost response or reload, **When**
    an assignment has become authoritative, **Then** every authorized member
    recovers that same identity and ordering never rotates it.

---

### User Story 5 - Resolve Agreement with the Room's Exact Fraction (Priority: P1)

As a voting group, we receive one authoritative agreement outcome from the
complete decision set using the exact threshold retained by our room.

**Why this priority**: Agreement controls whether candidate progression stops;
fraction approximation or rule drift could change the shared result.

**Independent Test**: Exercise two-voter and larger rooms under several exact
fractions at threshold-minus-one and threshold, including incomplete sets where
agreement is already inevitable or impossible.

**Acceptance Scenarios**:

32. **Given** exactly two fixed voters under any valid configuration, **When**
    both decisions are complete, **Then** agreement requires exactly two yes
    decisions and no configured fraction can reduce that requirement.
33. **Given** `N >= 3` and exact retained fraction `p/q`, **When** all voters have
    decided, **Then** the required yes count is exactly `ceil(N * p / q)` and
    agreement is true exactly when the yes count meets or exceeds it.
34. **Given** the default exact fraction `2/3`, **When** `N` is 3, 4, 5, 6 or 10,
    **Then** the respective thresholds are 2, 3, 4, 4 and 7, not values derived
    from a decimal approximation such as 66%.
35. **Given** an incomplete decision set whose current yes votes already meet
    the threshold, **When** one or more fixed voters have not decided, **Then**
    the room remains collecting and does not announce agreement early.
36. **Given** an incomplete decision set where agreement is no longer possible,
    **When** one or more fixed voters have not decided, **Then** the room remains
    collecting and does not progress early.
37. **Given** a voting creator or a non-voting creator, **When** completion and
    agreement are calculated, **Then** the fixed voting group alone supplies
    `N` and decisions exactly as established by Features 003 and 008.
38. **Given** a room created under one agreement fraction and a later restart
    under another, **When** the older room completes a decision set, **Then** it
    uses its retained fraction and does not reinterpret prior decisions.

---

### User Story 6 - Preserve Authority, Privacy and Failure Meanings (Priority: P2)

As an authorized room member, I can recover the shared candidate and progression
state without learning another voter's filters or decisions and without a
failure being mislabeled as no eligible movies.

**Why this priority**: The new rules must not weaken the privacy, authority or
recovery guarantees already proven by Features 003–008.

**Independent Test**: Exercise authorized recovery, unauthorized and cross-room
access, source failure, completed exhaustion, stale clients and agreement stops
under different retained rule sets.

**Acceptance Scenarios**:

39. **Given** multiple authorized room members, **When** a candidate is assigned,
    progresses, exhausts or agrees, **Then** they converge on the same
    authoritative room outcome under the same retained rules.
40. **Given** another voter, a non-voting creator or an unauthorized client,
    **When** room state is observed, **Then** Feature 009 does not disclose
    individual voter filters, individual decisions, private resolved predicates,
    credentials or another room's state.
41. **Given** a transient source or metadata failure, **When** retry or recovery
    occurs, **Then** the established candidate identity and logical progression
    step are preserved and no alternative rule set or source is used.
42. **Given** an agreed candidate, **When** configuration changes, the server
    restarts or a stale request completes, **Then** the room remains agreed and
    no later candidate becomes current.
43. **Given** any Feature 009 flow, **When** participants use the application,
    **Then** they receive no Match presentation, configuration editor, threshold
    mode or early-resolution behavior.

### Edge Cases

- A configured minimum vote count of zero remains a valid cutoff and does not
  disable the other eligibility rules.
- The optional minimum average rating can be exactly at either accepted boundary
  of the source's rating scale; a value outside the accepted scale is invalid at
  startup rather than clamped.
- Equivalent exact fractions produce the same threshold arithmetic; their
  configuration representation and normalization are planning choices.
- `ceil(N * p / q)` may equal one or `N` for valid fractions; the room still
  waits for all `N` decisions, and exactly-two rooms still require two yes votes.
- One selected genre makes OR and AND equivalent for that voter; an empty genre
  selection remains neutral in both modes.
- A movie can meet global cutoffs but fail one voter's predicate, or meet every
  voter predicate but fail a global cutoff; either condition makes it ineligible.
- A source record lacking valid data required for an active retained cutoff or
  comparator makes the attempt incomplete and cannot prove eligibility or completed
  exhaustion. A missing or malformed metric that no active cutoff or comparator
  consumes is irrelevant and does not invalidate an otherwise valid record/search.
- Titles equal under the chosen alphabetical comparison remain tied and receive
  no product-promised relative order.
- Configuration changes during a running process take effect only after a
  successful restart and only for rooms created under the new effective rules.
- A failed restart with invalid configuration changes no existing room's
  retained rules and must not leave a newly started server using stale defaults.
- A pre-Feature-009 room may still be awaiting filters, candidates or decisions;
  its lifecycle stage does not opt it into Feature 009 rules.
- Exhaustion under strict AND or cutoff settings never triggers automatic OR,
  lower cutoffs, a different language, an alternate source or fixture fallback.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The server MUST read the external selection configuration and
  validate its complete semantic meaning at startup before serving room creation
  or candidate-selection work.
- **FR-002**: Changing selection configuration MUST require editing the external
  configuration and restarting the server; Feature 009 MUST provide no hot
  reload, administration UI, configuration service or participant-facing setting.
- **FR-003**: Invalid configuration MUST cause explicit startup failure. The
  server MUST NOT silently ignore, clamp, weaken or replace an invalid supplied
  value with a previous value or default.
- **FR-004**: Omitted ordering, genre mode and larger-group fraction MUST use
  vote-count descending, OR and exact `2/3` respectively; omitted optional
  minimum average rating MUST impose no rating cutoff.
- **FR-005**: A valid configuration MUST provide a non-negative whole-number
  minimum vote count and a valid metadata language. The initial canonical values
  were `500` and `en-US`; they are historical initial operational choices, not
  fixed product constants. The current YAML sets `100` and `en-US`, and valid
  values may be changed by YAML edit plus successful restart/redeploy.
- **FR-006**: A configured minimum average rating, when present, MUST be a valid
  value in the source's accepted average-rating domain. Missing, non-finite or
  out-of-domain numeric values required by the rule set MUST be invalid.
- **FR-007**: A configured larger-group fraction MUST represent an exact positive
  rational value no greater than one. A percentage approximation, floating-point
  substitution or invalid denominator MUST NOT change its meaning.
- **FR-008**: Every room created after Feature 009 activation MUST retain the
  complete effective rule set that existed at its creation.
- **FR-009**: A room's retained rule set MUST remain unchanged by external
  configuration edits, server restart, reload, reconnect, re-entry, candidate
  progression, retries, stale clients or local client manipulation.
- **FR-010**: After a successful restart with different configuration, existing
  rooms MUST continue with their retained rules and only newly created rooms
  MUST retain the new effective rules.
- **FR-011**: Pre-Feature-009 rooms MUST continue with the legacy Feature
  005/006/008 selection and agreement behavior. They MUST NOT silently receive
  the current startup configuration or a newly invented hybrid rule set.
- **FR-012**: If a Feature-009 room's retained rules are missing, corrupt or
  internally inconsistent, candidate selection and agreement resolution MUST
  fail closed rather than substituting current configuration or weaker rules.
- **FR-013**: Candidate eligibility MUST require the inherited Feature 006
  release-year, adult-content, source-integrity and metadata prerequisites plus
  the room's retained minimum vote count, optional minimum average rating and
  within-voter genre semantics. A TMDB metric MUST be present and valid whenever an
  active retained cutoff or comparator consumes it, but MUST NOT be required when no
  active rule consumes it; an irrelevant missing or malformed metric MUST NOT make an
  otherwise valid candidate or search incomplete.
- **FR-014**: Candidate vote count MUST be greater than or equal to the retained
  minimum; if a rating cutoff exists, average rating MUST be greater than or
  equal to it. Equality at either cutoff MUST be accepted.
- **FR-015**: Under OR mode, each voter with a nonempty genre selection MUST be
  satisfied by at least one selected genre. Under AND mode, each such voter MUST
  be satisfied by every selected genre. Empty Any-genre selection MUST remain neutral.
- **FR-016**: Every voter-specific genre predicate and the inherited inclusive
  year constraint MUST be combined so that every fixed voting participant's
  filters are satisfied. A non-voting creator MUST contribute none.
- **FR-017**: Common filter combination, candidate retrieval and final
  eligibility validation MUST use the same room-retained genre mode and MUST NOT
  reinterpret, omit or weaken any voter predicate.
- **FR-018**: Candidate retrieval and the existing TMDB-authored minimum
  presentation MUST use the room's retained metadata language consistently.
  Candidate identity and metadata ownership MUST remain governed by Feature 006.
- **FR-019**: The candidate ordering rule MUST be exactly one of vote count
  descending, average rating descending, popularity descending or title
  ascending; ordering MUST NOT add or remove eligibility.
- **FR-020**: Vote-count ordering MUST place an eligible unseen movie with a
  larger vote count before one with a smaller count. Average-rating and
  popularity ordering MUST do the same for their respective values. Title
  ordering MUST place distinct configured-language titles in ascending
  alphabetical order.
- **FR-021**: Movies equal under the configured primary ordering value MAY occur
  in either relative order. No tied movie may bypass eligibility, authority,
  recovery or no-repeat rules.
- **FR-022**: Candidate selection MUST consider only eligible movies not already
  resolved in the current room selection session and MUST preserve Feature 008's
  no-repeat behavior throughout progression.
- **FR-023**: One acquisition or progression step MUST still establish at most
  one authoritative current candidate, and all authorized members MUST converge
  on that identity under concurrency, retry, response loss and recovery.
- **FR-024**: Once a candidate identity becomes authoritative, a configuration
  change, ordering result, retry, metadata failure or stale response MUST NOT
  rotate it or create an extra progression step.
- **FR-025**: Exactly two fixed voters MUST require exactly two accepted yes
  decisions for agreement under every valid retained rule set.
- **FR-026**: For `N >= 3`, the agreement threshold MUST equal
  `ceil(N * p / q)` using the room's retained exact fraction `p/q`, and agreement
  MUST be true exactly when the complete set's yes count meets or exceeds it.
- **FR-027**: Agreement and non-agreement MUST continue to wait for one accepted
  decision from every one of the `N` fixed voters for the current candidate,
  including when the eventual outcome is already inevitable or impossible.
- **FR-028**: The fixed assembled voting group, not connection count, device
  count or observers, MUST define `N`, decision completion and the agreement
  threshold. Voting and non-voting creators retain their established meanings.
- **FR-029**: Decision arrival order, the identity of the last voter, local
  calculations and configuration changes after room creation MUST NOT alter the
  room-authoritative agreement outcome.
- **FR-030**: Feature 009 MUST reuse Feature 007's immutable private decision
  model and Feature 008's one-outcome, agreement-stop and progression contracts;
  it MUST NOT introduce decision editing or progression after agreement.
- **FR-031**: Source work that is incomplete, malformed, unavailable or otherwise
  failed MUST remain distinguishable from completed exhaustion and MUST NOT
  commit no-candidate or no-further-candidate. Missing or malformed metric evidence
  required by an active retained cutoff or comparator MUST fail closed as incomplete;
  it MUST NOT be skipped or misclassified as authoritative exhaustion.
- **FR-032**: No-candidate or no-further-candidate MUST become authoritative only
  after one bounded, error-free source attempt completes all required work under
  the room's full retained eligibility, ordering and exclusion rules and observes
  no eligible unseen candidate.
- **FR-033**: When no candidate is eligible, the system MUST NOT lower either
  cutoff, omit any voter filter, switch AND to OR, change language or ordering,
  use a second source, restore fixtures or otherwise broaden the search.
- **FR-034**: Retry after source failure or uncertain response MUST recover an
  already committed candidate or safely continue the same logical step under the
  same retained rules; it MUST NOT adopt current startup configuration.
- **FR-035**: Reload, reconnect, same-identity re-entry and missed-update recovery
  MUST restore the authoritative room state and behavior without requiring any
  participant to select or reconstruct the rule set.
- **FR-036**: Unauthorized, cross-room, non-voter and locally manipulated input
  MUST NOT read or change protected room rules, private filters, private
  decisions, source credentials, candidate authority or progression state.
- **FR-037**: Feature 009 MUST preserve individual-filter and individual-decision
  privacy. Participant clients need not receive the private resolved predicate
  or another voter's values in order to observe the shared candidate outcome.
- **FR-038**: Participant-facing failures MUST remain understandable and MUST NOT
  expose raw configuration, source payloads, credentials, internal identifiers,
  private predicates or another room's state.
- **FR-039**: Feature 009 MUST preserve Feature 003 fixed membership, Feature 004
  filter ownership/freeze, Feature 005 all-voter compatibility, Feature 006
  candidate authority and Feature 008 sequence/no-repeat behavior except for the
  explicit rule evolutions defined by this specification.
- **FR-040**: Feature 009 MUST add no Match presentation, early resolution,
  user-configurable mode, provider filter, alternate source, recommendation or
  unrelated product behavior.

### Non-Functional Requirements

- **NFR-001 - Determinism and consistency**: The same authoritative room state,
  retained rules and source evidence MUST yield the same eligibility and
  threshold meaning across server operations; all authorized clients MUST
  converge on one room outcome.
- **NFR-002 - Atomic authority**: Room creation MUST associate one complete rule
  set with the new room as one authoritative logical result, and candidate or
  agreement transitions MUST remain governed by the boundary capable of
  enforcing existing concurrency guarantees.
- **NFR-003 - Recoverability**: Retained rules and their candidate/agreement
  effects MUST survive restart, reload, temporary disconnection, same-identity
  re-entry, missed updates, request replay and response loss.
- **NFR-004 - Eligibility correctness**: Cutoff boundaries, both genre modes,
  every-voter combination and ordering comparisons MUST be verifiable without
  relying on client calculations or exposing private filter data.
- **NFR-005 - Failure safety**: Invalid startup configuration, corrupt retained
  rules, incomplete source traversal, source data malformed in a field required by
  the retained rules, and partial failure MUST fail explicitly or safely without
  fallback, broadening or false exhaustion. Irrelevant metric defects remain ignored
  as required by FR-013.
- **NFR-006 - Privacy and least privilege**: Access MUST remain denied by default
  outside approved room and source operations. Credentials, private filters,
  individual decisions and protected rule state MUST not be disclosed.
- **NFR-007 - Backward consistency**: Every tested pre-Feature-009 room MUST
  preserve its legacy observable rules, and every Feature-009 room MUST preserve
  its creation-time rules across later restarts and configuration changes.
- **NFR-008 - Bounded scope**: The release MUST contain only external startup
  rule validation, room rule retention and their effects on filtering, candidate
  ordering and agreement, with zero Match, early-resolution or configuration-UI behavior.
- **NFR-009 - Source continuity**: The existing candidate source, bounded-search
  meaning, assignment authority, metadata recovery and no-repeat progression
  contracts MUST remain intact under each supported rule set.

### Key Entities

- **Server rule configuration**: The startup input defining supported ordering,
  cutoffs, language, within-voter genre mode and larger-group fraction.
- **Effective room rule set**: The immutable creation-time selection semantics
  belonging to one room and used throughout its selection session.
- **Legacy room rule classification**: The explicit recognition that a room
  predating Feature 009 continues under Feature 005/006/008 behavior instead of
  inheriting newly configured rules.
- **Candidate eligibility predicate**: The complete combination of inherited
  year/content rules, every fixed voter's genres, global cutoffs, metadata
  prerequisites and session-local no-repeat exclusions.
- **Candidate ordering policy**: The room-retained primary comparison applied
  among eligible unseen candidates.
- **Agreement policy**: The fixed two-voter rule plus the room-retained exact
  fraction used to calculate the larger-group ceiling threshold after the full
  decision set exists.
- **Candidate source outcome**: Assigned candidate, retryable incomplete/failure
  meaning, or stable completed exhaustion under the room's complete rules.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of invalid-configuration acceptance cases, startup fails
  explicitly before room creation or selection work is served, with zero silent
  defaulting, clamping or fallback.
- **SC-002**: In 100% of room-stability cases spanning configuration edit and
  restart, older rooms use their creation-time rules and newly created rooms use
  the new effective rules, with zero cross-room rule drift.
- **SC-003**: In 100% of pre-Feature-009 room cases, the legacy OR, `en-US`,
  any-eligible/no-new-cutoff and exact-two-thirds behavior is preserved rather
  than replaced by current configuration.
- **SC-004**: Across cutoff-boundary, OR, AND, Any-genre and multiple-voter
  acceptance cases, 100% of assigned candidates satisfy the complete retained
  predicate and zero candidates pass retrieval but fail a differently interpreted
  final rule.
- **SC-005**: For each of the four ordering policies, every tested pair of
  eligible unseen movies with unequal primary values appears in the required
  order, and no ineligible or previously resolved movie is assigned first.
- **SC-006**: For every tested fixed voter count from 2 through 10 and each
  tested exact fraction, threshold-minus-one and threshold cases resolve
  correctly; every two-voter case requires two yes decisions.
- **SC-007**: In every inevitable-agreement and impossible-agreement incomplete
  case, zero agreement or progression occurs before all fixed voters decide.
- **SC-008**: In 100% of source-failure and completed-exhaustion cases, the two
  outcomes remain distinct and zero filters, cutoffs, genre modes, languages,
  sources or no-repeat exclusions are weakened or replaced.
- **SC-009**: In every concurrent acquisition, retry, response-loss, reload,
  reconnect and stale-client case, authorized clients recover one authoritative
  candidate and one progression outcome under the same retained rules.
- **SC-010**: Across all unauthorized, cross-room and privacy acceptance cases,
  there are zero unauthorized changes and zero disclosures of credentials,
  private voter filters, individual decisions or foreign room state.
- **SC-011**: The complete Feature 009 acceptance evidence contains zero Match
  presentation, early resolution, hot reload, administration/configuration UI,
  participant rule selection, alternate source or unrelated feature behavior.

## Assumptions

- Features 003–008 are complete and remain the authority for fixed membership,
  private frozen filters, compatible handoff, TMDB candidate sourcing,
  immutable decisions and candidate progression except where this specification
  explicitly evolves rule semantics for newly created rooms.
- The minimum vote count and any minimum average rating are operational tuning
  values. The historical initial canonical generation used vote count `500` and no
  average-rating cutoff; later generations may change them by YAML edit plus
  successful restart/redeploy without changing existing room snapshots.
- Metadata language must be explicitly configured. The approved initial canonical
  generation uses `en-US`; pre-Feature-009 rooms independently retain their legacy
  Feature 006 `en-US` behavior.
- The source supplies localized title and the metric evidence consumed by the
  retained rules. Metric validation is conditional: vote count is required by a
  vote-count cutoff/order, vote average by a rating cutoff/order, and popularity by
  popularity ordering; irrelevant metric absence or malformation is ignored.
- Feature 008's established full-set timing remains independent of threshold
  arithmetic, so configurable fractions do not authorize early resolution.
- Equal primary ordering values are product-level ties. A deterministic
  implementation detail may be selected during planning, but it must not alter
  eligibility, no-repeat, authority or the absence of a promised tied order.
- Existing local participant identity remains the recovery boundary; permanent
  accounts and cross-device identity transfer remain out of scope.

## Dependencies and Preserved Guarantees

- The [constitution](../../.specify/memory/constitution.md),
  [product vision](../../docs/product-vision.md) and
  [MVP roadmap](../../docs/mvp-roadmap.md) govern this specification.
- [Feature 003](../003-generalized-room-membership-qr/spec.md) supplies the fixed
  voting group, creator roles, room authority and same-identity recovery.
- [Feature 004](../004-participant-filters/spec.md) supplies private, frozen
  per-voter genres and inclusive year ranges, including neutral Any genre.
- [Feature 005](../005-common-filter-resolution/spec.md) supplies the complete
  all-voter compatibility handoff and privacy boundary; Feature 009 evolves only
  the within-voter genre operator for new rooms.
- [Feature 006](../006-tmdb-candidate-source/spec.md) and its
  [query and eligibility contract](../006-tmdb-candidate-source/contracts/tmdb-query-and-eligibility.md)
  supply the sole candidate source, metadata authority, stable assignment,
  bounded search, exact validation, privacy and failure taxonomy.
- [Feature 007](../007-swipe-decisions/spec.md) supplies immutable private
  decisions bound to the fixed voters and current candidate.
- [Feature 008](../008-candidate-progression/spec.md) and its
  [candidate-source sequencing contract](../008-candidate-progression/contracts/candidate-source-sequencing.md)
  supply full-set timing, one authoritative outcome, no-repeat progression,
  convergence, recovery and exhaustion semantics. Historical references in
  completed Feature 008 artifacts to Feature 009 Match describe the Match feature
  now sequenced as Feature 011; their validation receipts are not rewritten.

## Planning Handoff

The approved [implementation plan](plan.md) fixes the configuration format and
location, semantic validation boundary, exact room-retention and pre-Feature-009
compatibility representation, source request mapping, complete-search strategy,
title comparison and deterministic tie handling, migration/transaction boundaries,
and cross-component contract changes. Implementation must follow those decisions and
this specification's observable rules. The approved initial operational values are
implementation inputs, not immutable product constants.

## Resolved Product Decisions

- Configuration is external, startup-read and startup-validated; changes require
  edit plus restart, with no hot reload or configuration UI/service.
- Ordering defaults to vote count descending and supports average rating
  descending, popularity descending and title ascending.
- Minimum vote count is configurable, minimum average rating is optional, and
  metadata language is configurable. The current YAML uses `100`, no rating
  cutoff and `en-US` with `popularity_desc` ordering; these are editable tuning
  choices. The earlier `500`/`vote_count_desc` generation is historical.
- Within-voter genres support OR or AND, default OR; every fixed voter's filters
  must still be satisfied consistently from resolution through final validation.
- Exactly two voters require two yes decisions. Larger rooms use the ceiling of
  a retained exact fraction, default exactly `2/3`, only after all voters decide.
- New rooms retain creation-time rules. Pre-Feature-009 rooms retain the legacy
  completed behavior rather than silently inheriting new configuration.
- Invalid configuration fails startup. Empty results never broaden rules, and
  incomplete/failed source work remains distinct from genuine exhaustion.
- Feature 009 includes no Match presentation, early resolution, user-facing
  configuration, alternate source or unrelated feature.

## Unresolved Decisions

None. The approved plan resolves every technical Planning Handoff item; no product or
implementation-readiness decision remains open.
