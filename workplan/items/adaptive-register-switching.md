---
id: adaptive-register-switching
title: Does switching into an edged register at the right moment help?
status: active
type: experiment
priority: P3
owner: codex
source: manual
created: 2026-08-09
updated: 2026-08-10
branch: codex/adaptive-register-switching-stage2
verification: Stage 1 is COMPLETE / PASS_STAGE1. Stage 2 stored 103/105 rows
  before two network-classified fixed timeouts. The operator has now
  authorized one bounded serial recovery of exactly missing attempt indices 5
  and 6 in the cell-197 rote-parroting slice; no scoring starts until a
  read-only check proves 105/105.
claim_status: exploratory
depends_on:
  - register-mock-praise-probe
links:
  notes:
    - notes/2026-08-09-adaptive-register-switching-prereg-draft.md
  exports:
    - exports/adaptive-register-switching/plan.json
    - exports/adaptive-register-switching/stage2/eval-2026-08-09-53421919.json
  code:
    - services/tutorStubEdgeTimingPolicy.js
    - docs/tutor-stub-cli.md
    - services/adaptiveRegisterSwitchingStage2.js
    - scripts/run-adaptive-register-switching-stage2.js
  runs:
    - eval-2026-08-09-b09e5a10
    - eval-2026-08-09-53421919
tags:
  - register
  - manner
  - router
  - adaptivity
---

The mock-praise probe closed the generation question for negative registers on
the strong stack; what no run has measured is switching. The pinned sarcastic
arm converting least is evidence about the costume worn all day, not about the
right manner at the right moment — the operator's counter (manner is often
what makes content take, with human and synthetic learners alike) is the
motivating hypothesis.

Frozen design, in the note: three tutors in one batch — router free to choose
edged registers on resistance, router-warm control, pinned sarcastic (cell 197). The
third arm separates timing from edge. Primary is conversion at the
post-resistance fold; manipulation checks come first (does the router switch,
and at the right moments); each register scored under its own gate; the manner
question stays unbumped so readings pool. Staged: a 10-row router-behaviour
pilot with a kill condition before any powered outcome batch. The exact table
pins the proposed Stage 2 at 35 rows per arm (105 total; exact power .8522 for
.50 versus .85).

2026-08-09 Codex: froze the design at plan SHA
`da2723e47de143305e88a9a7b26688f6f58e4958e0b310ed4d7e147cd9734845`.
Built the cell-scoped router-menu seam and cells 204/205; edged registers stay
`router_selectable: false` globally. Added a Stage-1-only SHA-gated runner and
zero-call fail-closed report carrying registered measures 1-8, with measures
1-4 collected in Stage 1 and 5-8 explicitly withheld for Stage 2. No model
calls made at freeze time; the item then stopped at the explicit
operator-approval gate.

2026-08-10 Codex: the operator approved the frozen SHA and the attended Stage 1
pilot completed as `eval-2026-08-09-b09e5a10`, 10/10 rows, without restart or
widening. The fail-closed report returned `COMPLETE / PASS_STAGE1`: all 90
tutor-seat calls used `codex/gpt-5.5`; the router made 18 switches, chose an
edged register on 10/13 resistance turns and 0/7 uptake turns, and leaked no
edged choice onto other turns. Ironic delivery was cue-compliant and
manner-present on 4/4 turns; sarcastic delivery was cue-compliant on 6/6 and
manner-present on 5/6, with the miss retained as a delivery failure. Measures
Measures 5-8 remained uncollected and Stage 2 remained unauthorized at that
checkpoint.

2026-08-10 Codex: folded the frozen timing map into tutor-stub as the opt-in
`edge_timing` register-policy overlay. The normal selection trace and CLI now
show the active style menu, matched resistance/uptake phase, timing choice,
final applied style, and any later hard-guard override. It is explicitly not a
default or a validated learning policy.

2026-08-10 Codex: the operator separately authorized Stage 2 against the same
frozen plan SHA. Added a Stage-2-only runner that admits exactly the frozen 105
jobs (35 per arm; seven per arm-scenario) only when the stored Stage-1
`COMPLETE / PASS_STAGE1` artifact, approved plan SHA, and clean launch-commit
SHA all validate. Outcome scoring is serial on the frozen Claude Sonnet 5
judge; each edged register retains its own rubric and manner gate; the final
report fails closed on any missing measure, keys its decision only to
adaptive-versus-router-warm, and has no Stage-3 mode. No paid Stage-2 call was
made while adding this gate.

2026-08-10 Codex: attended Stage 2 generation from clean launch commit
`cd9f0d675dc0d726606627cc5eb280a52cffc18d` completed 103/105 rows in 595m39s.
Adaptive and router-warm stored 35/35 each; pinned-sarcastic stored 33/35. The
final two pinned-sarcastic rote-parroting attempts hit the fixed 300,000ms
Codex CLI timeout at `learner_ego` and `tutor_id`. Per the attended-run rule,
neither row was restarted, replaced, or widened. No paid scoring followed.
The zero-call report is `INCOMPLETE`, decision withheld, and registered
measures 5-8 remain incomplete. Stage 3 was not started; work is paused.

2026-08-10 Codex: after the pause, a zero-call persisted-trace audit found one
reporter-only defect: the validator treated cell 197 as sarcastic on every
turn. The unchanged engine actually applies the experiment arm only when the
normal router selects charismatic under the resistance gate; ordinary turns
keep their normal-menu selection. Corrected the report seam to validate the
persisted assignment, source, replaced router choice, and resistance phase,
without changing or re-running any dialogue. This narrows only the secondary
adaptive-versus-pinned description; the primary adaptive-versus-router-warm
contrast and frozen plan hash are unchanged. The regenerated fail-closed
artifact SHA-256 is
`cd68ea71983d82b1c148f5804a8fff29a0c937c7bec989448d7de4c0cdafead5`.

2026-08-10 Codex: the operator returned online, classified the two fixed CLI
timeouts as network failures, and explicitly revoked the no-restart
constraint. Recovery preflight found 103 successful rows, zero empty rows,
zero paid scores, and exactly cell 197 × rote-parroting attempt indices 5 and
6 missing. Stored tutor and learner overrides remain `codex.gpt-5.5`.
Generation-critical paths are unchanged from launch commit
`cd9f0d675dc0d726606627cc5eb280a52cffc18d`. Authorized one attended serial
attempt-aware resume of those two jobs only, without `--force`, deletion, a
new run, model change, or widened grid. Scoring remains gated on a read-only
105/105 verification; Stage 3 remains unavailable.
