# Does switching into an edged register at the right moment help? — Pre-Registration DRAFT

Status: **DRAFT — not frozen, no plan hash, nothing bought.** Numbers marked
"at freeze" are computed and pinned when the design freezes. This note exists
so the design argument is on record before any apparatus is built.

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

- **Adaptive**: a new cell whose engagement router may select the edged
  registers. Today the router (`services/engagementModeRouter.js`) picks a
  register per turn from the learner signal but the edged registers carry
  `router_selectable: false` in `config/engagement-registers.yaml`; the one
  build item is a cell-scoped menu widening (a cell flag that admits named
  edged registers to the router's menu), NOT a global registry flip. No
  register pin.
- **Pinned warm**: the same cell block with the router menu unchanged (edged
  excluded). The never-switch control.
- **Pinned sarcastic**: cell 197 unchanged. The always-edged control; also
  anchors continuity with the stored batches.

Repeats per arm-scenario: at freeze, from the power section. Scoring: tutor
v2.2 by `claude-code/claude-sonnet-5` (cross-family from the codex writer),
learner rubric by the same judge, register rubric `claude-code.sonnet-5` on
edged turns. Manner reading: the pinned reader on the unchanged question
`manner-presence/1.0` — no version bump, so readings pool with the stored
strong-stack batches.

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
   fold, adaptive vs pinned-warm. Verdict keyed to this contrast only.
6. **Secondary: timing vs edge** — adaptive vs pinned-sarcastic, same
   measure.
7. **Continuous secondary** — learner-rubric change across the dialogue
   (the within-test change instrument), to buy power the binary primary
   lacks.
8. **Cost** — tutor v2.2 means per arm.

## Power, to be pinned at freeze

Known going in: on 15-row draws of one cell, the between-draw spread of a
binary count is about 3 in 15 (the plain sarcastic arm read 11/15 then 14/15
on consecutive days). So 15 per arm cannot answer the primary and will not be
proposed. Sketch, to be exactly computed at freeze: detecting 50% vs 85%
conversion at two-sided α = .05 with power ≈ .8 needs roughly 30 rows per
arm; three arms ≈ 90 rows ≈ 7–8 h generation at the measured 5 min/row. If
the minimum detectable effect at an affordable size is implausibly large, the
design says so and does not run — that is what the freeze step is for.

## Staging

- **Stage 1, cheap kill (~10 rows, adaptive arm only):** does the router,
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
4. **One writer, one reader**, as throughout the arc.

## Deviations

Recorded, not patched around, in the workplan card and the paper.
