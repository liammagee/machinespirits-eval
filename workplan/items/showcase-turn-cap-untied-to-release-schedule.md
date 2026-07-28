---
id: showcase-turn-cap-untied-to-release-schedule
title: Showcase turn caps are hand-set and untied to the world's release schedule
status: active
type: infra
priority: P2
owner: claude
source: review
created: 2026-07-28
updated: 2026-07-28
verification: >-
  A showcase config whose scenario `max_turns` exceeds its world's
  `release_schedule` length plus a declared closing allowance fails at config
  load, naming the scenario, the world and both numbers; `riverside_clinic`
  either drops to a cap its four-item chain can fill or carries an explicit
  opt-out field saying the overrun is deliberate; the existing showcase config
  tests cover both the passing and the failing shape.
links:
  code:
    - config/tutor-stub-showcase.yaml
    - services/tutorStubShowcase.js
    - config/drama-derivation/world-029-riverside-clinic.yaml
    - config/drama-derivation/world-016-ai-syllabus-af1.yaml
    - tests/tutorStubShowcase.test.js
  items:
    - tutor-instrumentation-showcase
tags:
  - tutor-stub
  - showcase
  - config
---

## Problem

`config/tutor-stub-showcase.yaml` sets `max_turns` per scenario by hand, with no
relation to how much authored evidence the world carries. The two current
scenarios pull apart:

| scenario | world | `release_schedule` | `max_turns` | turns with nothing to release |
|---|---|---:|---:|---:|
| campus_faq | world-016-ai-syllabus-af1 | 7 | 10 | 2 |
| riverside_clinic | world-029-riverside-clinic | 4 | 8 | 4 |

Riverside is configured to spend its material by turn 4 and then run four more
turns. In the 2026-07-26 showcase run that is exactly what happened, on both
arms. Questions and evidence release move together across all four dialogues —
every turn that releases an exhibit asks a question, every turn without one asks
none:

```
campus_faq  bare    Q ..........    E ----------
campus_faq  instr   Q .QQQQQQQ..    E -EEEEEEE--
riverside   bare    Q QQQ.....      E --------
riverside   instr   Q QQQQ...       E EEEE---
```

Past the last release the tutor has no move except restatement, and the rubric
reads the last turn as the end of the transcript. Both Riverside arms fall on
v2.2 (bare 67.5 → 28.7, instrumented 61.3 → 17.5) and both fall on v3.0 as well
(71.7 → 52.8, 81.1 → 52.8), so this is not an artifact of one rubric's
dimension list.

The scenario summary already calls Riverside "a contemporary clinic scheduling
inquiry with a short authored chain". The short chain is the point of the
scenario; the cap is what fails to respect it.

## Why a validator rather than a new number

Hand-editing `riverside_clinic.max_turns` to 6 fixes this run and leaves the
next world free to reintroduce it. The showcase config already fails loudly on
other incoherent shapes (`safety_turns` below `max_turns`, a flag outside the
declared parity set), so the same treatment fits: read the world's
`release_schedule`, and refuse a cap that outruns it by more than the declared
closing allowance.

The allowance has to exist and be named — a dialogue needs a turn to close on
after the last exhibit, and a check-in variant needs two. The point is that the
overrun becomes a stated number rather than an accident.

## This is the weaker of the two fixes, and second

Campus has 3 turns of slack past its last release, Riverside 4. Any allowance a
validator could reasonably declare separates them by a single turn, so the check
is a thin guard rather than a cure — it would have caught Riverside at 8 and let
it through at 7, and 7 still runs 3 turns past the evidence.

`tutor-redeclares-close-lifecycle-has-not-accepted` is the one that matters, and
it holds whatever the cap is: it stops the post-evidence turns being three copies
of the same close. Do that first. This card keeps the config honest, which is
worth having on its own terms and is not what rescues a dialogue.

## Not in scope

Deepening the Riverside world. The contrast between a long chain and a short one
is worth keeping in the demo; what is not worth keeping is a cap that pretends
the short chain is long.
