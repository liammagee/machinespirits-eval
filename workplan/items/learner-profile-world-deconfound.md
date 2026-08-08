---
id: learner-profile-world-deconfound
title: "Deconfound the learner-profile recovery: cross personas and worlds"
status: active
type: experiment
priority: P1
owner: codex
source: manual
created: 2026-08-06
updated: 2026-08-09
branch: codex/learner-profile-world-deconfound-adjudication
verification: "Design-stage card. Before any paid dialogue: the transplanted
  persona briefs are user-adjudicated, the crossed cells and readings below
  are frozen unchanged, and the operator has explicitly authorized the paid
  run. The run is attended; delivery is verified per the golden contract
  before any reading."
claim_status: methods
links:
  config:
    - config/learner-profile-world-deconfound.yaml
  code:
    - scripts/review-learner-profile-world-deconfound.js
    - tests/learnerProfileWorldDeconfound.test.js
  notes:
    - notes/2026-08-03-adaptive-causality-living-log.md
  paper:
    - docs/research/paper-full-2.0.md#624-the-four-locks-why-nothing-beat-the-bare-tutor-and-what-opened-when-each-was-removed-post-hoc-except-the-claim-gate-development-tier
  items:
    - adaptive-causality-crossed-effects
tags:
  - tutor-stub
  - learner-profiles
  - deconfound
  - prereg
---

# Deconfound the 88% learner-profile recovery

The living log's most repeated caveat, still open after the arc closed:
conduct-derived state-frequency profiles classify the two authored
personas at 88% leave-one-out by turn six (bar 80%; paper §6.24, phase
L1) — but each persona is paired with one world. The record-keeper lives
in the assay world (world-033, alder row redoubt) and the quietly
resistant tenant in the flat-share world (world-030, rowan flat), so the
classifier may be reading the learner's pattern, the world's content and
schedule, or their interaction. The log's own rule: a learner profile
counts as transportable only if it can be recovered across crossings.
This card runs the recovery half of that rule. Routing moves by
recovered profile across crossings is explicitly out of scope — a
follow-up card if recovery passes, per the reuse rule.

## Design (to freeze before any paid call)

**D1 — transplant the personas (free, authoring).** Adapt each persona
brief to the other world: surface only (names, scene roles, domestic
detail); the authored conduct disposition — what the persona presses on,
concedes to, or goes quiet about — stays untouched. User adjudicates
both transplants before any run, as R1's re-authored directives were.
Option, decided at freeze: a third authored persona in one existing
world, the log's strongest version of the test.

**D2 — the crossed cells (paid, attended, local).** Tenant in world-033
and record-keeper in world-030, k=5 dialogues per cell (10 paid
dialogues; plus 5 per third-persona cell if authored). Frozen baseline
full stack from the manifest, same seats as the crossed experiment
(sonnet speaking, terra learner), worlds on their ratified schedules,
delivery verified in shipped prompts before any outcome is read. No
detector, card, or schedule changes — the instrument must meet the new
cells as it met the old.

**D3 — the recovery reading (free, replay).** Replay the standing
profile instrument (trigger plus quiet detector, per-dialogue
state-frequency estimates) over old and new dialogues together;
leave-one-out classification of PERSONA across all four cells.

**Readings, fixed now.** Persona recovered across worlds at or above the
original 80% bar = the signal travels with the learner pattern;
transportability claimed within scope (two personas, two worlds,
simulated learners). Classification tracking the WORLD instead = the
88% re-reads as a world artifact; the paper's L1 claim gains that bound
with the same prominence as the original number. Partial or
interaction = reported as the measured bound, unspun. Whatever the
branch, per-cell state-frequency profiles are published beside the
classification so the basis of the verdict is inspectable.

**Cost and venue.** About 10 paid dialogues (15 with the third persona)
plus free replays; attended; runs in a local session (the CLI bridges
and recorded artifacts live there). The paid launch needs explicit
operator authorization at freeze, like every paid run since the grid.

**Limits, stated now.** Simulated learners; one tutor stack; two
authored personas (three at most); transplanted briefs are adaptations,
not new blind authoring; no human-learning claim. A pass licenses the
publication closeout's crossed holdout design, not a routing policy.

## Log

- 2026-08-09 — Activated in an isolated worktree from post-PR-#588 main. The
  first slice is free design work only: locate the two ratified source persona
  briefs, author surface-only cross-world transplants, and expose the exact
  diff for user adjudication. No model call or paid run is authorized.
- 2026-08-09 — Recovered the exact private briefs from the sealed August
  traces, froze both originals, and authored the record-keeper-in-Rowan and
  tenant-in-Alder transplants. Each cell also overrides the target world's
  public learner voice so the original world-specific persona cannot leak back
  into the learner prompt. A zero-model review command validates the 2x2
  crossing, five repeats per new cell, model seats, schedules, source-surface
  exclusions, 80% reading, pending human adjudication, and absent paid
  authorization. The proposed scope omits a third persona: the full 2x2 already
  breaks the original confound and keeps the first run to ten dialogues.
- 2026-08-09 — Provenance audit found that the original 88% L1 reading used
  pressure trigger v4 plus quiet detector qd-v1, while the current tree contains
  qd-v2. The design now pins qd-v1 and both source commits and makes exact-v1
  restoration plus reproduction of 56/64 an explicit pre-certificate gate.
  Merging this design does not itself make the paid experiment launch-ready.
- 2026-08-09 — After reviewing the zero-model design output, the user approved
  both exact transplanted persona briefs and their public learner-voice
  overrides, and confirmed omission of a third persona. The approved prompt
  and voice hashes are now frozen in the design. Paid authorization remains
  absent; the next gate is exact qd-v1 restoration and 56/64 reproduction.
