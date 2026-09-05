<!--
Sync Impact Report
- Version change: unratified scaffold -> 1.0.0
- Modified principles:
  - Scaffold Principle 1 -> I. Working Behavior Is the Primary Evidence
  - Scaffold Principle 2 -> II. Small Verifiable Vertical Slices
  - Scaffold Principle 3 -> III. Specification and Implementation Consistency
  - Scaffold Principle 4 -> IV. Explicit and Authoritative State Transitions
  - Scaffold Principle 5 -> V. Security, Secrets, and Least Privilege
- Added principles:
  - VI. Reproducible Development and Schema Evolution
  - VII. Tests Are Executable Acceptance Evidence
  - VIII. Explicit Scope and Simplicity
- Added sections:
  - Quality Gates and Evidence
  - Development Workflow and Artifact Consistency
- Removed sections: none
- Deferred placeholders: none
-->
# Otteroom Constitution

## Core Principles

### I. Working Behavior Is the Primary Evidence

An implementation milestone or task is complete only when it has an actual,
reproducible, and verifiable result. For every executable slice, the applicable
validation set MUST cover installation from a fresh clone, build, typecheck,
automated tests, documented local startup, and reproduction of the claimed user
or system scenario. Any omitted check MUST be identified as not applicable with
a concrete reason before the task can be completed.

Files, generated code, checked task boxes, agent commentary, and successful
generation commands are not evidence that behavior works. Codex MUST record the
commands it actually ran and their outcomes before declaring executable work
complete. This rule prevents artifact presence from being mistaken for working
software.

### II. Small Verifiable Vertical Slices

Development MUST proceed through small vertical slices. Each slice MUST have one
clear observable result, contain only the scope necessary for that result,
include the required contracts, implementation, and validation, and be
verifiable before another slice begins. A slice MUST NOT depend on an
unimplemented future feature or introduce infrastructure or abstractions solely
for anticipated use.

One implementation pass for an entire MVP or similarly broad scope is
prohibited. A new slice MUST NOT begin until the current slice is in a verified
working state or is explicitly cancelled and its dependent artifacts are
updated. This keeps failures local and progress independently demonstrable.

### III. Specification and Implementation Consistency

Project artifacts MUST form one consistent system with the following authority
boundaries:

- this constitution governs process and mandatory quality constraints;
- a feature specification defines what is created and why;
- clarification records the resolution of ambiguity;
- an implementation plan defines the technical approach;
- data models and contracts define applicable system boundaries and invariants;
- tasks derive from the approved upstream documents;
- tests provide executable evidence for acceptance criteria; and
- implementation MUST NOT silently redefine the specification.

Every requirement change MUST trigger an impact check across all dependent
artifacts and the affected artifacts MUST be updated together. A blocking
conflict among the specification, contracts, data model, tasks, tests, and
implementation MUST be resolved before implementation continues. An unanswered
question MUST be marked `UNRESOLVED`; Codex MUST NOT replace it with an
assumption. This hierarchy prevents contradictory documents from presenting
multiple sources of truth.

### IV. Explicit and Authoritative State Transitions

Every shared state element MUST have an explicitly documented authoritative
owner. Operations that constitute one logical state change MUST be atomic at the
system layer capable of enforcing that guarantee under concurrent access.

Applicable contracts MUST define input validation, authentication,
authorization, retry behavior, duplicate request handling, idempotency,
concurrency, stale-state handling, partial failure, and recovery. Client input
MUST be treated as untrusted until authoritatively validated. Critical invariants
MUST be enforced by the component that can guarantee them rather than by caller
convention. These requirements make state transitions deterministic under
failure and concurrency.

### V. Security, Secrets, and Least Privilege

Secrets, privileged credentials, and server-only tokens MUST NOT appear in
client code, client-visible environment variables, the repository, generated
artifacts, logs, screenshots, or test fixtures. Authentication and authorization
boundaries MUST be defined before any protected operation is implemented.

Each component MUST receive only the permissions necessary for its approved
responsibility. Data access MUST be denied by default and granted explicitly.
Security-sensitive behavior MUST have automated tests or an explicitly
documented, reproducible validation procedure when automation is not feasible.
These rules reduce both credential exposure and unintended authority.

### VI. Reproducible Development and Schema Evolution

Every executable part of the repository MUST have a reproducible, documented
setup. A fresh clone MUST contain enough non-secret information for a developer
or Codex to install the declared toolchain and dependencies, create a local
environment without copying secrets, apply required migrations, run all required
checks, and start the system.

Database schema changes MUST be represented only by versioned migrations, and
each migration sequence MUST be validated against a clean database. Schema,
generated types, contracts, and runtime expectations MUST remain consistent.
Local state, generated caches, and secrets MUST NOT be treated as part of the
reproducible repository. This ensures that success does not depend on an
unrecorded workstation state.

### VII. Tests Are Executable Acceptance Evidence

Acceptance criteria MUST be expressed in verifiable terms. Tests MUST exercise
observable behavior and system invariants; checks limited to file presence,
component presence, invocation of a mock, rendering of static text, or existence
of an endpoint handler are insufficient evidence of the associated behavior.

Mocks MAY isolate a unit, but MUST NOT replace integration or end-to-end evidence
when the requirement concerns cooperation among components. Before
implementation begins, every slice MUST define its minimum validation set. Once
an executable core user flow exists, that flow MUST receive an end-to-end check.
This makes tests evidence of acceptance rather than evidence of scaffolding.

### VIII. Explicit Scope and Simplicity

Every feature specification MUST explicitly state goals, non-goals, user-visible
acceptance criteria, functional requirements, applicable non-functional
requirements, unresolved decisions, and its release boundary.

Codex MUST NOT independently add features, platforms, integrations,
infrastructure, abstractions, compatibility layers, speculative extensibility,
or future roadmap items. The implementation MUST begin with the minimum
architecture sufficient for the approved slice. New functionality requires an
explicit specification change before planning or implementation. This rule
prevents unapproved scope and premature complexity.

## Quality Gates and Evidence

- Before implementation, the active slice MUST have approved, testable
  acceptance criteria and a recorded minimum validation set.
- A validation record MUST identify the environment, commands executed, their
  results, and any check classified as not applicable with its rationale.
- A failed required check blocks completion. It MUST NOT be relabeled as success
  or bypassed by checking a task box.
- Fresh-clone setup, build, typecheck, automated tests, local startup, and
  scenario reproduction MUST be re-evaluated whenever a change can affect them.
- Security and state-transition invariants MUST be validated at the boundary
  responsible for enforcing them.
- Evidence MUST be reproducible by another developer or Codex session using only
  versioned repository instructions and separately provisioned secrets.

## Development Workflow and Artifact Consistency

1. A feature specification establishes scope and acceptance criteria without
   selecting implementation details prematurely.
2. Material ambiguity MUST be resolved through clarification before the final
   implementation plan is accepted. Any intentionally open decision remains
   marked `UNRESOLVED` and blocks dependent work.
3. The implementation plan MUST include a Constitution Check and identify which
   data models, contracts, migrations, security boundaries, and validation types
   are applicable.
4. Tasks MUST be derived from the approved specification and plan, remain small
   enough to produce verifiable vertical progress, and carry their required
   evidence conditions.
5. Before implementation, a consistency analysis MUST cover this constitution,
   the feature specification, plan, applicable data model and contracts, and
   tasks. A blocking conflict stops dependent work.
6. During implementation, requirement or design changes MUST update affected
   upstream and downstream artifacts before dependent work resumes.
7. A task or slice may be marked complete only after its required evidence has
   been produced and recorded.

## Governance

This constitution is the normative authority for all subsequent Spec Kit
artifacts and engineering work in Otteroom. If another artifact or practice
conflicts with it, dependent work MUST stop until the conflict is resolved.

Amendments require an explicit proposal that states the rationale, affected
principles and artifacts, compatibility impact, and any required migration of
existing work. An amendment takes effect only after explicit approval by the
project owner, an update to this document and its Sync Impact Report, and
validation of all affected artifacts.

Constitution versions follow semantic versioning:

- MAJOR for a backward-incompatible governance change or removal or
  redefinition of a principle;
- MINOR for a new principle or material expansion of governance; and
- PATCH for wording clarification that does not change mandatory behavior.

Every implementation plan MUST contain a Constitution Check. Every feature with
material ambiguity MUST complete clarification before its final implementation
plan. Before implementation begins, consistency analysis MUST cover the
constitution, feature specification, plan, applicable data model and contracts,
and tasks. Reviews MUST verify both constitutional compliance and the recorded
validation evidence.

When a violation is found, the responsible agent MUST: (1) stop dependent work;
(2) describe the violation explicitly; (3) correct the affected artifacts or
obtain an approved constitution amendment; and (4) repeat all required checks.
A task MUST NOT be marked complete until this process and its validation have
succeeded.

**Version**: 1.0.0 | **Ratified**: 2026-09-05 | **Last Amended**: 2026-09-05
