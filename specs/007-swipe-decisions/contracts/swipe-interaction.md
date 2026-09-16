# Contract: Swipe and Equivalent Controls

**Feature**: 007 — Swipe Decisions

**Platforms**: Expo Android, iOS and web

## Composition

`CandidateDecisionSurface` composes the existing Feature 006 `CandidateCard`.
It owns gesture translation, visible Yes/No controls and decision status, but
contains no Supabase calls. Persistence is injected by the decision hook.

The application root is wrapped in `GestureHandlerRootView` with a full-flex
style so native gestures have a valid root without changing route layout.

## Deterministic Gesture

Use one `Gesture.Pan()` with:

```text
maxPointers = 1
activeOffsetX = [-12, 12]
failOffsetY = [-24, 24]
acceptDistance = clamp(surfaceWidth * 0.25, 72, 120)
horizontalDominance = abs(translationX) >= 1.25 * abs(translationY)
```

At gesture end:

- if controls are not enabled, submit nothing;
- if horizontal dominance fails, spring to center and submit nothing;
- if `translationX >= acceptDistance`, animate right and request `yes` once;
- if `translationX <= -acceptDistance`, animate left and request `no` once;
- otherwise spring to center and submit nothing.

Cancelled/failed gestures always reset and submit nothing. A new gesture is
disabled while recovering, submitting or decided. Crossing a threshold during
movement is visual feedback only; submission occurs once on an accepted end.
The UI-thread callback schedules one JavaScript call only after acceptance.

## Motion

Horizontal translation and restrained rotation/feedback may run on the
Reanimated UI thread. Completion and reset use `withSpring` with system
reduced-motion support. Under reduced motion, avoid travel/rotation that is not
necessary to understand the result; textual status still changes.

Animation is never authority. A rejected, uncertain or conflicting request
settles to a stable surface and presents the corresponding textual outcome.

## Persistent Alternative Controls

Render visible controls below/alongside the card whenever the caller is an
eligible voter:

| Control | Label | Authoritative value | Minimum target |
| --- | --- | --- | --- |
| Left action | `No — don't want to watch` | `no` | 44×44 logical pixels |
| Right action | `Yes — want to watch` | `yes` | 44×44 logical pixels |

Both use native `Pressable`/button semantics, visible focus on web and standard
Enter/Space activation. They call the same one-flight submit path as gestures.
They remain visible (disabled with an explained state) during recovery and
submission so layout and discoverability do not jump.

## Accessibility

- Give the decision group and each control a descriptive accessible label.
- Use button role and disabled/busy state where supported.
- Announce confirmed choice, conflict recovery and actionable failure through
  accessible text/live-region semantics.
- Do not encode yes/no only with green/red, direction or motion; include words
  and distinguishable symbols only as supplements.
- Keep reading/focus order aligned with title/year, candidate description,
  controls and status.
- A completed decision remains readable after controls disable.
- Honor the operating system reduced-motion setting on native and web.

## Web Equivalence

Desktop web users can decide using focus navigation and Enter/Space without a
pointer gesture. Touch-capable/mobile-sized web users can use the same swipe
mapping or the buttons. Pointer drag is an enhancement, not the sole desktop
contract.

## Component Test Matrix

Tests use deterministic gesture callbacks/shared-value harnesses rather than
pixel timing:

- right threshold plus dominance submits exactly one `yes`;
- left threshold plus dominance submits exactly one `no`;
- below threshold, vertical intent, diagonal ambiguity, cancel and multi-touch
  submit nothing and reset;
- disabled/recovering/submitting/decided states submit nothing;
- repeated gesture-end delivery still reaches the hook's one-flight guard;
- both buttons map correctly and expose accessible names/roles/states;
- keyboard activation follows the same mapping;
- status meaning remains in text without color/motion; and
- reduced-motion mode avoids dependence on off-screen animation.

## Browser Acceptance Contract

- K01 includes one 390×844 touch-capable mobile context for swipe mapping and a
  separate desktop context for keyboard buttons in the same two-voter room.
- Candidate IDs are compared from controlled provider/harness evidence, not
  scraped from hidden presentation text.
- K02 proves the non-voting creator has no active decision control while fixed
  voters can act independently.
- Targeted historical J03 proves controls remain available for assigned
  candidates during poster loading, poster error and no-poster fallback.
