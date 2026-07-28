---
id: showcase-turn-cap-untied-to-release-schedule
title: Showcase turn caps are hand-set and untied to the world's release schedule
status: done
type: infra
priority: P2
owner: claude
source: review
created: 2026-07-28
updated: 2026-07-28
verification: >-
  `validateTutorStubShowcaseConfig` takes a per-scenario release schedule and
  refuses two shapes: a cap running more than `closing_allowance` turns past the
  world's last release, and a cap stopping before that release without a stated
  `truncates_release_schedule` reason. The loader reads the schedules off the
  worlds so the two numbers cannot drift apart by hand. Six tests in
  `tests/tutorStubShowcase.test.js` cover the shipped config, both failing
  shapes, the contradictory-declaration shape, and the no-schedule path.
links:
  code:
    - config/tutor-stub-showcase.yaml
    - services/tutorStubShowcase.js
    - scripts/run-tutor-stub-showcase.js
    - config/drama-derivation/world-029-riverside-clinic.yaml
    - config/drama-derivation/world-016-ai-syllabus-af1.yaml
    - tests/tutorStubShowcase.test.js
  items:
    - tutor-instrumentation-showcase
    - tutor-redeclares-close-lifecycle-has-not-accepted
tags:
  - tutor-stub
  - showcase
  - config
---

## Problem

`config/tutor-stub-showcase.yaml` sets `max_turns` per scenario by hand, with no
relation to the world's authored evidence. Past its last exhibit the tutor has no
move but restatement, and the rubric reads the last turn as the end of the
transcript. Both Riverside arms fall on v2.2 (bare 67.5 → 28.7, instrumented
61.3 → 17.5) and on v3.0 (71.7 → 52.8, 81.1 → 52.8), so it is not one rubric's
dimension list.

## The first reading of this was wrong

This card was written against the *number* of releases in each schedule, giving
campus 3 turns of slack and Riverside 4. A release schedule is not a count: it
carries explicit turn numbers, and reading them off the worlds says something
else.

| scenario | world | releases | last release at turn | `max_turns` |
|---|---|---:|---:|---:|
| campus_faq | world-016-ai-syllabus-af1 | 7 | 16 | 10 |
| riverside_clinic | world-029-riverside-clinic | 4 | 7 | 8 |

The two scenarios fail in opposite directions, and only one of them was visible
in the report. Riverside spends its schedule at turn 7 and runs one turn past it.
Campus is **stopped six turns before its last exhibit** — ten turns reach four of
its seven. Neither world's own `turnCap` (22 and 12) has any bearing on the
showcase caps either.

That reframes the comparison the showcase invites. Campus's arc is not a
completed dialogue that went well; it is a dialogue cut off while material was
still arriving, which is part of why its novelty stays high to the last turn. The
two scenarios were never the same kind of object.

## What was built

`validateTutorStubShowcaseConfig(config, { releaseSchedules })` now enforces two
rules, and stays a pure function — `loadTutorStubShowcaseConfig` does the world
reading and hands the schedules over, so tests can pass any schedule they like.

- A cap **past** the last release must sit within `closing_allowance` of it, or
  the tutor runs dry before the cap. Riverside at 8 passes against a last release
  of 7; at 11 it fails.
- A cap **short** of the last release must set `truncates_release_schedule` to a
  stated reason. Campus declares it. Declaring it while *not* truncating is also
  an error, so the field cannot be left behind as a stale rubber stamp.

`closing_allowance: 3` is global. No cap changed: Riverside's 8 is legitimate
under the rule, and campus's 10 is now a recorded truncation rather than an
accident. The value of the check is that the relation is stated and held, not
that it moved a number.

## What this does not fix

Riverside's fall. The cap was never the cause — one turn past the schedule is
within any allowance worth declaring, and the bare arm has no schedule at all yet
stalls from turn 4. `tutor-redeclares-close-lifecycle-has-not-accepted` and
`repetition-audit-misses-reworded-stall` are the fixes that bear on it.

## Not in scope

Deepening the Riverside world, or lifting campus's cap to 17 so it finishes. The
contrast between a long chain and a short one is worth keeping; whether the
showcase should run campus to its end is a separate call about run cost, and the
config now states the truncation instead of hiding it.
