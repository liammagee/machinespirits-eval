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

## Results — Stages 0 and 1 (2026-08-01)

**Gate 0 PASSED**: plants landed in all three bench arms (20 should-fire,
6 quiet); scorecard (`scripts/score-manner-trigger.js`) deterministic.
v1-builtin baseline: classification 6/20, arming 1/20, wrong-fires 0/6.

One scorecard correction en route: the contemporary record-keeper presses
ORGANICALLY, so her unplanted dialogues are not a negative set — her
"false alarms" were real mockery and demands. The base rate moved to the
CALM set (the five diligent-learner gate-1 dialogues).

**Gate 1 PASSED** with `config/manner-trigger/v2.json` (miss-list-driven
patterns, concession checked last so barbed concessions read as pressure,
armAt 1): classification 17/20, arming 18/20, wrong-fires at quiet plants
0/6, calm-set false alarms 1.80/dialogue (bar: ≤2). Threshold sweep
recorded: armAt 2 gives 11/20 arming at 0.71 calm alarms
(`v2-arm2.json`) — kept as the conservative alternative. Per the skip
rule, stages 2–4 are NOT run: patterns solved it; nothing gets trained.
CLI selection: `TUTOR_STUB_MANNER_TRIGGER=config/manner-trigger/v2.json`;
the version travels in every trace advance.

## Stage 2 — labeled corpus (afternoon, cheap) — SKIPPED (Gate 1 met)

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

## Stage 5 result (2026-08-01): GATE 5 FAILED — reported as registered

sol move-tagger over all 48 planted replies (k=3 per arm, v2 trigger, card
covered 16/24 switch plants): **butler 8/24 right-repairs, switch 5/24,
zero capitulations both arms.** The switch did not beat the butler; no
"adaptation helps" claim enters the paper from this run.

Two readings recorded WITH the fail, for the user's adjudication pass:

1. **Tagger-taste contamination on two plant families.** t3 was tagged
   slow_down in 5/6 dialogues — the exact move sol preferred at gold
   adjudication and the user overruled; t16 was tagged change_tone in 5/6.
   Where the tagger's own pedagogy lost the adjudication, its tags recreate
   it. The contested list goes to the user; the headline number may move
   but the direction is not presumed to.
2. **The real design lesson: the card grants a manner, the gold demands
   moves.** The armed schoolmaster converts pressure into firmness, but
   most planted gold is quiet (probe, credit-then-test, backtrack, fewer
   words) — and an armed schoolmaster is WORSE at quiet repairs (switch
   t11/t18 tagged reinforce_and_test where gold wanted probe/backtrack).
   Manner-contingency is not move-contingency. The v3 mechanism this
   implies: per-pressure MOVE cards (the conduct-card lesson again —
   inject the move, not the temperament), e.g. mockery→register shift,
   grievance→credit-then-test, settled-claim→reopen-the-record.

3. **The repertoire gap is nameable.** Five plants missed in nearly every
   dialogue in BOTH arms: the oblique probe, the terse reply, and
   credit-before-test are moves this model rarely makes under any prompting
   tested. The bench's first discovery about the model rather than the
   harness.

## User adjudication (2026-08-01): six tags corrected, verdict unchanged

The user ruled YES on the six-flip recommendation: five turn-16 replies
re-marked as reinforce_and_test hits (the tagger under-read
credit-then-test as change_tone: butler d1, d2; switch d0, d1, d2) and one
turn-3 reply (switch d2, "Bring me that answer and I'll set pen to paper"
— condition named, task assigned). **Final tally: butler 10/24, switch
9/24. GATE 5 FAILS under every ruling considered** — the adjudication
narrowed the gap and confirmed its direction. The five remaining turn-3
misses stand: refusing the tempo without setting the Thursday test is
slow_down, as tagged.

## v3 result (2026-08-01): GATE 5 PASSED at the floor reading

Move cards replaced the manner card (five typed cards keyed to the
classified pressure; fired per turn). k=3, same world, learner, judge, and
scoring as the failed v2 attempt. **v3 switch: 15/29 right-repairs (52%;
card-covered plants 12/19 = 63%) vs butler 10/24 adjudicated (42%) and
v2-switch 9/24 (38%). All three dialogues closed grounded; zero delivered
leaks; zero capitulations.** The comparison is taken at its weakest
reading: v3's tally is pre-adjudication (its three t3 misses are the same
disputed slow_down family the user previously flipped), so adjudication
can only widen the margin.

Claim licensed, with the standing limits attached verbatim: timed,
typed move-injection lifts adjudicated repair delivery above the
never-adapting baseline — n=3 per arm, one world, one learner persona,
one tutor family, simulated learner, sol-tagged with the known t3 taste
caveat. The uncovered-plant rate (3/10) and the bored/lost plants (no
card by design — boredom is not pressure) mark the mechanism's current
boundary.

## The disclosure result (2026-08-01): judges can see adaptation when asked

The user's reframe — adaptation as an end the judge is asked about, not a
means it must infer — tested on the 48 Stage-5 planted replies, each judged
twice by sol: blind ("how good is this reply?") and state-shown ("the
learner at this moment is bored/frustrated/…; how well does the reply
address that person?"). Result: **disclosure doubles alignment with the
adjudicated gold** — gold-hit replies outscore gold-miss replies by 0.98
blind and 1.91 state-shown — and the arm ordering under disclosure matches
the gold's (butler above v2-switch), where blind judging saw them as equal.
Disclosure also lowers all scores: a judge who can see what the moment
demanded grades against it. Converges with the clue-shown pairwise
precedent: what a judge is SHOWN, not the judge's taste, sets what it can
reward. The turn-local rubric's blindness to adaptation is therefore a
correctable instrument choice, not a fixed limit of LLM judging. Sonnet replication landed (24/48 valid pairs; the rest
returned unparseable scores): blind gap 0.64 → shown gap 1.13, the same
near-doubling — and sonnet's blind pass had PREFERRED the v2 switch (the
wrong ordering per gold), correcting to the gold ordering under
disclosure. Two judges, different blind errors, converging when shown the
state.

## Standing constraints

Overfitting ledger (HOW-TO-BUILD-A-TUTOR.md): vocabulary → held-out world;
author → two directive authors; simulator → cross-sim gold, human transfer
unclaimable; base rate → organic-dialogue false alarms. Trigger versions
are config artifacts with hashes; traces record the version; no pooling.
