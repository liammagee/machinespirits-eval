# Does switching into an edged register at the right moment help? — Frozen Pre-Registration

Status: **FROZEN — Stage 2 complete; no primary evidence; stopped before Stage 3.** Frozen plan SHA-256:
`da2723e47de143305e88a9a7b26688f6f58e4958e0b310ed4d7e147cd9734845`.
The operator approved exactly that hash. The attended Stage 1 pilot and its
fail-closed report completed without restart or widening. On 2026-08-10 the
operator separately authorized the frozen 105-row Stage 2 batch; this changed
authorization only, not the design, measures, power table, or plan hash. The
attended run, bounded network recovery, scoring-path correction, and completed
Stage 2 result are recorded below. Stage 3 remains unauthorized.

## Where this comes from

The mock-praise probe (`eval-2026-08-09-bb402d97`, paper v3.0.282) closed the
generation question: a strong writer delivers an assigned negative register
near ceiling, the withdrawn compliment is how sarcasm is realized and read on
this stack, and asking for the device adds nothing. What no run has measured
is *switching*: every register cell so far pins one register for the whole
dialogue. The one outcome reading we have — the pinned sarcastic arm
converting resistance least in the exploratory grid — is evidence about the
costume worn all day, not about the right manner at the right moment.

The operator's counter to the down-pointing prior, recorded here as the
motivating hypothesis: manner is frequently the difference between a piece of
content taking or not, with human and synthetic learners alike. Costume has
effects. The untested claim is that *timed* edge — sarcastic exactly when the
learner goes flat, warm again on uptake — improves uptake over never-edged
and over always-edged.

## The claim to be tested

**A tutor free to switch into an edged register on resistance converts
resistance better than one that never can — and better than one that always
does.** The second comparison is what makes it a timing claim: if free-switch
and always-edged tie, the edge (not the timing) is doing the work.

## Design

Three tutors, one batch, one stack (`codex.gpt-5.5` both tutor seats — never
nemotron/kimi), the same five controlled resistance targets.

- **Adaptive (cell 204)**: a new cell whose engagement router may select the edged
  registers. Today the router (`services/engagementModeRouter.js`) picks a
  register per turn from the learner signal but the edged registers carry
  `router_selectable: false` in `config/engagement-registers.yaml`; the one
  build item is a cell-scoped menu widening (`router_register_menu: [ironic,
  sarcastic]`) that admits named edged registers to the router's menu, NOT a
  global registry flip. No register pin.
- **Router-warm control (cell 205)**: the same cell block with no register pin
  and the router menu unchanged (edged excluded). The never-edged control.
- **Pinned sarcastic**: cell 197 unchanged. The always-edged control; also
  anchors continuity with the stored batches.

Stage 1 uses two repeats per scenario in the adaptive arm: 10 rows. Stage 2,
if separately approved after Stage 1, uses seven repeats per arm-scenario: 35
rows per arm, 105 rows total. Scoring: tutor v2.2 by
`claude-code/claude-sonnet-5` (cross-family from the codex writer), learner
rubric by the same judge, register rubric `claude-code.sonnet-5` on edged
turns. Manner reading: the pinned reader on the unchanged question
`manner-presence/1.0` — no version bump, so readings pool with the stored
strong-stack batches. Each edged turn is scored under the gate for the
register actually selected. Cue-compliance counts stay within register and are
never differenced across registers.

## Registered measures (all fail closed)

1. **Provenance** — every tutor-seat call on the plan model, read off the
   dialogue traces.
2. **Manipulation check A (does it switch?)** — the adaptive arm's per-turn
   register choices, read off the router's own trace entries. If it never
   selects an edged register, the primary is void; reported before any
   verdict.
3. **Manipulation check B (does it switch at the right moments?)** — edged
   choices on resistance turns vs uptake turns. A router that goes edged
   uniformly is the always-edged arm wearing a different name.
4. **Fidelity on edged turns** — stance gate (each register under its own
   gate, no cross-register differencing) plus the manner reading. An edged
   choice whose turn reads flat is a delivery failure, counted separately
   from a routing failure.
5. **Primary: conversion** — positive local outcome at the post-resistance
   fold, adaptive vs router-warm. Verdict keyed to this contrast only.
6. **Secondary: timing vs edge** — adaptive vs pinned-sarcastic, same
   measure.
7. **Continuous secondary** — learner-rubric change across the dialogue
   (the within-test change instrument), to buy power the binary primary
   lacks.
8. **Cost** — tutor v2.2 means per arm.

## Frozen power table

Known going in: on 15-row draws of one cell, the between-draw spread of a
binary count is about 3 in 15 (the plain sarcastic arm read 11/15 then 14/15
on consecutive days). So 15 per arm cannot answer the primary and is not
proposed.

Exact unconditional power for a two-sided Fisher test at α = .05, with
independent Binomial(n, .50) warm-control and Binomial(n, p) adaptive counts:

| Warm | Adaptive | Difference | First n/arm with power ≥ .80 | Balanced n/arm | Exact power at balanced n |
|---:|---:|---:|---:|---:|---:|
| .50 | .65 | .15 | 183 | 185 | .8102 |
| .50 | .70 | .20 | 102 | 105 | .8153 |
| .50 | .75 | .25 | 64 | 65 | .8090 |
| .50 | .80 | .30 | 44 | 45 | .8154 |
| .50 | .85 | .35 | 32 | 35 | .8522 |
| .50 | .90 | .40 | 23 | 25 | .8326 |

The frozen Stage-2 proposal is the .50-versus-.85 row, rounded from the exact
minimum 32 to 35 per arm so each of the five resistance targets receives seven
repeats. That is 105 rows, about 8.75 hours at the measured five minutes per
row. This is a large minimum detectable policy effect; the table is part of
the operator's later Stage-2 decision, not authorization to run it.

## Staging

- **Stage 1, cheap kill (10 rows, adaptive arm only):** does the router,
  given the widened menu, ever choose an edged register, and at plausible
  moments? Measures 1–4 only; no outcome claim. If it never switches or
  switches indiscriminately, stop and fix routing before buying outcomes.
- **Stage 2, the three-arm batch**, only after Stage 1 passes and the frozen
  power table is accepted by the operator.

## Stage 1 result — 2026-08-09

Run `eval-2026-08-09-b09e5a10` completed all 10 planned adaptive-arm rows. The
fail-closed report returned `COMPLETE / PASS_STAGE1` with no missing registered
Stage 1 measures and `stage2Authorized: false`.

| Registered check | Result | Disposition |
|---|---:|---|
| Tutor-seat provenance | 90/90 `codex/gpt-5.5` | pass |
| Router switching | 18 register switches across 30 turns | pass |
| Resistance timing | edged on 10/13 resistance turns | pass |
| Uptake timing | edged on 0/7 uptake turns | pass |
| Other-turn leakage | 0 edged choices | pass |
| Ironic fidelity | 4/4 cue-compliant; 4/4 manner-present; register-rubric mean 95.125 | pass |
| Sarcastic fidelity | 6/6 cue-compliant; 5/6 manner-present; register-rubric mean 84.333 | one delivery miss, reported separately |

This passes the **technical manipulation check only**: the cell-scoped router
can select edged registers during resistance, closes them on uptake, and
usually realizes the selected manner. It does not establish that timed edge
improves conversion or learning. Registered measures 5–8 were not collected
in Stage 1 and no Stage 2 row has been authorized.

The deterministic timing map is now exposed as an opt-in tutor-stub overlay,
`--register-policy field+edge_timing` (or `/settings policy add edge_timing`).
Its normal trace records the active menu, timing choice, final applied style,
and any later hard-guard override. This is an inspectable research seam, not a
validated default policy.

## Stage 2 attempt — 2026-08-10

Run `eval-2026-08-09-53421919` launched from clean commit
`cd9f0d675dc0d726606627cc5eb280a52cffc18d` against the unchanged frozen plan
SHA. The attended serial generation attempt ran for 595m39s and finished with
103 successful rows and two fixed-timeout failures out of the planned 105:

- adaptive: 35/35 stored;
- router-warm: 35/35 stored;
- pinned-sarcastic: 33/35 stored;
- both failures were pinned-sarcastic rote-parroting rows, one at
  `learner_ego` and one at `tutor_id`, each after the fixed 300,000ms Codex CLI
  timeout.

The run was not restarted, resumed, replaced, or widened. No paid tutor,
learner, register, or manner scoring was launched after the incomplete
generation grid. The zero-call report at
`exports/adaptive-register-switching/stage2/eval-2026-08-09-53421919.json`
returned `INCOMPLETE`, withheld the decision, and left registered measures
5–8 incomplete. The corrected zero-call artifact has SHA-256
`cd68ea71983d82b1c148f5804a8fff29a0c937c7bec989448d7de4c0cdafead5`.
Any partial classifier counts in that artifact are diagnostic
only and are not a Stage 2 result. Stage 3 was not started. Work pauses here.

A post-run, zero-call trace audit also found that the initial Stage-2 report
validator had interpreted the frozen note's "always-edged" shorthand too
literally. Existing cell 197 does not apply sarcasm on every turn: unchanged
engine semantics replace a charismatic router choice with the assigned
sarcastic register only under the resistance gate, while ordinary turns retain
the normal router choice. The validator was corrected after the run to require
`assigned_register_arm: sarcastic`, `register_assignment_source:
experiment_arm`, and the replaced charismatic router choice on assigned
resistance turns, while accepting normal-menu selections on unassigned turns.
No dialogue, score, registered measure, primary contrast, or frozen plan hash
changed. This correction narrows the secondary adaptive-versus-pinned
description; the sole decision-bearing adaptive-versus-router-warm contrast is
unaffected.

## Stage 2 network-recovery amendment — 2026-08-10

After returning online, the operator classified the two fixed CLI timeouts as
network failures and explicitly revoked the no-restart constraint. This is an
operational amendment only; it does not change the frozen design, plan hash,
arms, scenarios, repetitions, models, measures, gates, readers, tests, or
Stage-3 boundary.

The authorized recovery is one attended, serial invocation of the repository's
attempt-aware resume path against the existing run
`eval-2026-08-09-53421919`. Its preflight must prove all of the following:

- exactly 103 successful rows and zero empty rows are stored;
- adaptive and router-warm are 35/35, while cell 197 is 33/35;
- the only missing jobs are cell 197 × rote-parroting attempt indices 5 and 6;
- no tutor, learner, or register score has been written;
- stored overrides remain `codex.gpt-5.5` for tutor and learner;
- generation-critical code is unchanged from original launch commit
  `cd9f0d675dc0d726606627cc5eb280a52cffc18d`.

The resume may add only those two already-planned rows, at parallelism 1 and
with rubric scoring still skipped. It may not use `--force`, delete a row,
create a new run, add a repetition, or alter a model. If either recovery job
fails, the attended process reports the failure and stops without another
automatic retry. Frozen scoring begins only after a read-only check proves the
grid is 105/105. Stage 3 remains unavailable.

## Stage 2 recovery and learner-scoring path amendment — 2026-08-10

The one authorized attempt-aware recovery completed both missing jobs without
another retry: run `eval-2026-08-09-53421919` now contains 105/105 successful
rows, 35 per arm, with the pinned-sarcastic rote-parroting attempt indices
complete at 0 through 6. A read-only post-recovery gate found no empty rows and
no pre-existing scores.

Frozen tutor scoring then completed 105/105 rows with zero failures under tutor
rubric v2.2 and `claude-code/claude-sonnet-5`. The next serial command, learner
scoring, failed closed before making any model call: all 105 rows were skipped
as missing dialogue logs. Read-only diagnosis found all 105 logs intact in the
canonical shared data home. The active CLI scorer had instead constructed a
worktree-local `logs/tutor-dialogues` path, which does not exist in the clean
temporary launch worktree.

This is an operational data-path defect, not missing experimental data and not
a change to the frozen estimand. The scorer and its standalone counterpart are
corrected to use `resolveTutorDialoguesDir`, the same shared resolver used by
the writer and the rest of the evaluation stack. The regression test injects a
logs root and proves that scoring resolves its tutor-dialogue directory through
that rule. No transcript, score, model, prompt, rubric, register gate, manner
question, arm, scenario, repetition, or plan hash is changed.

Per the attended-run failure rule, register-rubric and manner-presence scoring
were not launched. Stage 2 remains incomplete, its decision remains withheld,
and Stage 3 remains unavailable. Restarting the paid learner scorer requires
separate operator approval of the corrected clean-commit SHA; it must use the
normal no-`--force`, serial command and score only the still-null learner
measures on the existing 105 rows.

## Stage 2 result — 2026-08-10

The operator approved corrected clean commit
`e8c6e401c93c4fe2e33243de13480c0f59c6fab0` for the remaining frozen scoring.
The attended continuation made no restart, deletion, new run, model change, or
grid change. Learner scoring completed 105/105; the register scorers completed
15/15 ironic turns and 86/86 sarcastic turns under their respective gates; and
the unchanged `manner-presence/1.0` reader completed 101/101 edged turns. Tutor
and learner rubrics used `claude-code/claude-sonnet-5`. All 945 tutor-seat
calls retained the frozen `codex/gpt-5.5` provenance. No nemotron or kimi model
was used.

The zero-call report for run `eval-2026-08-09-53421919` returned
`COMPLETE / NO_PRIMARY_EVIDENCE`, with 105/105 rows, all registered measures
1–8 present, no report errors, and `stage3Authorized: false`.

| Registered result | Adaptive | Router-warm | Pinned-sarcastic | Contrast |
|---|---:|---:|---:|---|
| Positive local conversion | 29/35 (.829) | 33/35 (.943) | 30/35 (.857) | primary adaptive − warm = −.114; Fisher two-sided p = .2595 |
| Timing-vs-edge conversion | 29/35 (.829) | — | 30/35 (.857) | secondary adaptive − pinned = −.029; Fisher two-sided p = 1.000 |
| Learner-rubric change | 20.893 | 20.357 | 20.107 | descriptive only; no preregistered continuous test |
| Tutor v2.2 mean | 75.274 | 74.083 | 72.893 | descriptive cost measure |

The primary does not support the registered claim that adaptive switching
improves conversion over the router-warm control. It does not establish harm:
the observed difference is imprecise and non-significant. All three arms
converted at high rates, including a .943 router-warm rate rather than the .50
design anchor used in the frozen power table. The policy therefore remains an
inspectable, opt-in research seam in tutor-stub and is not promoted to a
validated default.

Fidelity is reported within register only. Ironic turns were 15/15
cue-compliant, 12/15 manner-present, with register-rubric mean 91.167 under
`ironic@stance-gate/2.0`. Sarcastic turns were 86/86 cue-compliant, 72/86
manner-present, with register-rubric mean 82.564 under
`sarcastic@stance-gate/2.0`. These cue counts are not differenced across
registers.

Canonical zero-call artifact:
`exports/adaptive-register-switching/stage2/eval-2026-08-09-53421919.json`,
SHA-256 `86294c623ffbb71eaed217c86e2205da19101655f6a0e03f4fceb24b2a87af56`.
Stage 2 stops here. Stage 3 was not started.

## Registered limits, stated now

1. **Policy-level estimand only.** Adaptive and pinned dialogues diverge in
   content as well as manner from the switch turn on; no turn-level causal
   claim about any single switch is licensed. The timing-pair result stands
   as the warning: an apparent timing effect dissolved into a coherence
   confound when switch turns were not matched. This design compares whole
   policies and does not claim turn-level effects.
2. **Synthetic learner.** The learner is the repo's LLM learner; a
   conversion gain here says the *simulated* learner takes content better
   under timed edge. No human claim.
3. **One writer, one reader**, as throughout the arc.

## Frozen apparatus

- Plan and fail-closed measures: `services/adaptiveRegisterSwitching.js`.
- Frozen Stage-1-only runner: `scripts/run-adaptive-register-switching.js`.
- Separately gated Stage-2 runner and report:
  `scripts/run-adaptive-register-switching-stage2.js` and
  `services/adaptiveRegisterSwitchingStage2.js`.
- Adaptive arm: `cell_204_id_director_adaptive_edged_register_switching`.
- Router-warm control: `cell_205_id_director_router_warm_register_control`.
- Always-edged comparator: existing
  `cell_197_id_director_sarcastic_challenge_breakthrough_dynamic_verified`.
- The Stage-1 runner has no Stage-2 launch mode. Every paid Stage-1 mode requires
  `--launch-approved --expected-sha <clean-commit>`; `--report-run` is a
  zero-call read-only report.
- The Stage-2-only runner requires the approved plan SHA, the completed
  Stage-1 report, and its own clean-commit SHA before every paid mode. It
  carries no Stage-3 launch mode.

## Deviations

The draft called the never-edged arm "pinned warm" while specifying an
unchanged, unpinned router menu. The frozen design names it **router-warm
control** to match the actual policy; its architecture is unchanged from the
draft description. Further deviations are recorded, not patched around, in
the workplan card and the paper.

The Stage-2 runner was added only after the separate 2026-08-10 authorization.
It reuses the frozen 105 jobs and registered measures unchanged, requires the
stored `COMPLETE / PASS_STAGE1` artifact as launch evidence, and makes the
adaptive-versus-router-warm Fisher contrast the sole decision-bearing test.
The adaptive-versus-pinned contrast remains secondary; learner change remains
descriptive because no continuous inferential test was preregistered. This is
an execution seam, not a design deviation.
