---
id: adaptive-causality-crossed-effects
title: "Adaptive causality arc, phase 1: crossed two-state/two-action experiment with transfer"
status: blocked
blocked_by: [adaptive-causality-stabilization]
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-08-03
updated: 2026-08-03
verification: "Pre-registered before any run: the crossed interaction —
  action A beats B in state 1 AND B beats A in state 2 — on a transfer
  outcome, with sensing, delivery, and outcome reported separately, against
  fixed-A, fixed-B, random, and planted-state-oracle comparators. Null
  branches written both ways."
---

# Adaptive causality, phase 1: the crossed experiment

Source: `notes/2026-08-03-adaptive-causality-living-log.md` (the
"Decisive next experiment" section). The missing causal cell: every
gated result so far measures whether the right move was DELIVERED at a
planted moment; none measures whether the delivered move CAUSED a
better learner transition than an available alternative.

## Design skeleton (to be pre-registered in full before any run)

- Two learner states plantable in ≥2 worlds and detectable blind to the
  action assignment (candidates from the validated repertoire: the
  misremembered-exhibit state and the endgame-stake state — both have
  ratified plants, typed detection, and opposed gold moves).
- Two materially different teaching actions with opposed predicted
  advantages (candidate pair: reopen-the-record vs split-the-stake —
  each is the other state's wrong-but-tempting move).
- Fallible simulated learner (failure and recovery possible), action
  randomized within state.
- Outcome: the next learner transition AND transfer on a new task the
  learner has not seen — NOT surface compliance or dialogue closure.
  The transfer probe is the arc's one genuinely new build and is also
  the instrument the human door needs.
- Comparators: fixed-A, fixed-B, random, learned router, oracle given
  the planted state.
- Sensing, delivery (verified in shipped prompts), and outcome reported
  separately per the standing lesson.

Gate order from the log, kept verbatim: if state recognition fails
across worlds, fix the state instrument; if the crossed effect fails
under known planted state, fix the move repertoire; only after both
pass does routing optimization begin. Human study after that chain.

## Status

Blocked on: adaptive-causality-stabilization (phase 0). Full
pre-registration to be written on this card before any run.
