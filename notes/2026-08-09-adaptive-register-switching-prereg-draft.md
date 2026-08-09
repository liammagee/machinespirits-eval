# Does switching into an edged register at the right moment help? — Frozen Pre-Registration

Status: **FROZEN — no model calls made.** Frozen plan SHA-256:
`da2723e47de143305e88a9a7b26688f6f58e4958e0b310ed4d7e147cd9734845`.
The apparatus and zero-call plan are built; Stage 1 remains locked pending the
operator's explicit approval of that hash. Stage 2 is not authorized.

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
- Stage-1-only runner: `scripts/run-adaptive-register-switching.js`.
- Adaptive arm: `cell_204_id_director_adaptive_edged_register_switching`.
- Router-warm control: `cell_205_id_director_router_warm_register_control`.
- Always-edged comparator: existing
  `cell_197_id_director_sarcastic_challenge_breakthrough_dynamic_verified`.
- The runner has no Stage-2 launch mode. Every paid Stage-1 mode requires
  `--launch-approved --expected-sha <clean-commit>`; `--report-run` is a
  zero-call read-only report.

## Deviations

The draft called the never-edged arm "pinned warm" while specifying an
unchanged, unpinned router menu. The frozen design names it **router-warm
control** to match the actual policy; its architecture is unchanged from the
draft description. Further deviations are recorded, not patched around, in
the workplan card and the paper.
