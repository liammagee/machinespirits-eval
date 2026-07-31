---
id: manner-trigger-tuning
title: Tune the manner switch's trigger against planted gold — staged, gated
status: active
type: experiment
priority: P2
owner: claude
source: manual
created: 2026-07-31
updated: 2026-07-31
verification: "Each stage's gate is numeric and recorded in this card before
  the next stage starts. Trigger versions ship as config artifacts with
  training-set hashes; every trace records its trigger version; no pooling
  across versions."
claim_status: methods
depends_on:
  - adaptation-planted-stress-bench
tags:
  - tutor-stub
  - adaptation
  - manner-switch
---

The one unsolved component after the 2026-07-31 arc: the switch's trigger
(hand patterns, guessed thresholds). The plants make it a measured problem:
recall over planted states, false alarms on quiet turns, arming latency.
Plan for 2026-08-01, cheapest rung first, offline replay before any paid
dialogue. The user's effort is confined to gates.

## Stage 0 — scorecard v0 (morning, free)

Score the CURRENT trigger offline over tonight's three frozen-pacing bench
arms plus the fifteen organic dialogues on disk: per-plant recall, false
alarms per dialogue (organic set gives the live base rate), latency. Pure
replay — the classifier is text-in, no model calls.

**Gate 0**: plants landed ≥ 9/11 in each bench arm (else the sim is
disobeying directives — fix the schedule's realize texts before anything
else), and the scorecard is deterministic across two runs.

## Stage 1 — dials and patterns (morning, free)

Sweep arm/stand-down/cap thresholds; edit patterns from the miss list
(known miss: "the first thing to write down" as demand). Re-score on the
same recorded turns. Tuning set: the bench arms; report also on the
organic dialogues.

**Gate 1**: recall ≥ 9/11 with ≤ 2 false alarms per organic dialogue and
latency ≤ 1 turn. If met, SKIP stages 2–4 (deliberate coarseness: do not
train what patterns solve) and go to stage 5.

## Stage 2 — labeled corpus (afternoon, cheap)

Only if Gate 1 fails. Harvest labeled utterances without full dialogues
(context + plant directive → utterance): ≥ 30 per state per sim, two sim
families (terra + one claude model) for the cross-sim layer, directives
from at least two authors (existing fable + sol variants).

**Gate 2**: corpus balance met, and a 20-utterance spot check (cross-family
model, user sees disagreements only) reads ≥ 90% state fidelity.

## Stage 3 — small classifier (afternoon, free)

Logistic regression / tiny tree over cheap features (pattern hits, length
vs the learner's own running average, punctuation, tutor-vocabulary echo).
Train on one schedule-set; evaluate on a held-out schedule AND a held-out
world (port the schedule pattern to another persona).

**Gate 3**: beats the tuned patterns on held-out recall without exceeding
their false-alarm rate on the organic dialogues. If not met: keep
patterns, record the margin, stop the ladder here.

## Stage 4 — the 9B mini rung (evening, local)

Only if Gate 3 passes and graduation numbers are still unmet. Retrain the
Program-2 SFT pipeline on (utterance, state); serve via ollama.

**Gate 4**: same numbers as Gate 3 plus ≤ 2s/turn local latency.

## Stage 5 — the payoff run (evening, paid, attended)

Separate question, pre-registered here before results: with the graduated
trigger, butler vs switch on the frozen bench, k = 3 dialogues per arm.
Scored on repair delivery at planted moments (sol move-tagger first pass,
user review sheet for the contested calls), miss types tallied as liturgy
vs capitulation.

**Gate 5 (the claim gate)**: the switch arm delivers strictly more
adjudicated right-repairs at planted moments than the butler arm across
k = 3, with no increase in leak/closure violations. Only past this gate
does any "adaptation helps" sentence enter the paper, and then with the
standing limits (simulated learner, one speaking family, n as run).

## Standing constraints

Overfitting ledger (HOW-TO-BUILD-A-TUTOR.md): vocabulary → held-out world;
author → two directive authors; simulator → cross-sim gold, human transfer
unclaimable; base rate → organic-dialogue false alarms. Trigger versions
are config artifacts with hashes; traces record the version; no pooling.
