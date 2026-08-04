---
id: adaptation-plan-3-phase-j
title: "Plan 3.0 Phase J: judging as an instrument — state-shown standard,
  disclosure with estimated states"
status: done
type: experiment
priority: P2
owner: claude
source: manual
created: 2026-08-02
updated: 2026-08-04
verification: "Gate J2 quoted from ADAPTATION-PLAN-3.0.md: the alignment gain
  survives estimation error in measurable part; the degradation is itself the
  finding (it prices what live judging inherits from the trigger)."
claim_status: methods
depends_on:
  - adaptation-plan-3-phase-q
tags:
  - tutor-stub
  - adaptation
  - judging
---

The disclosure result (§6.24): naming the learner's authored state to
the judge near-doubles judge–gold alignment in two judge families. Two
steps make that an instrument rather than a demonstration.

J1 — state-shown as a standard channel: the scoring pipeline gains a
disclosed pass beside the blind one (two readings stored separately,
per §6.23's two-readings convention). Infra, not an experiment.

J2 — disclosure with ESTIMATED states: rerun the disclosure design on
the stage-5 48-reply corpus, disclosing what the v2-era trigger
actually classified at each turn (in-trace) instead of the authored
state. Comparison against the authored-disclosure gaps (sol 1.91,
sonnet 1.13). The gap between authored- and estimated-disclosure
prices exactly what live judging inherits from trigger error — a
number the router and any deployment will need.

## Results (2026-08-02): J1 shipped; Gate J2 passes with the degradation priced

J1: `scripts/judge-planted-replies.js` — blind / authored / estimated
channels, stored separately; registered in ANALYSIS-SCRIPTS.md.

J2 (sol judge, stage-5 48-reply corpus, disclosed state = the v2
trigger's in-trace classification): on the 29 rows where all three
channels scored, judge–gold gaps are **blind 1.63, authored-disclosure
3.91, estimated-disclosure 2.03**. GATE J2 PASSES at its letter — the
gain survives estimation in measurable part (+0.40 over blind) — and
the degradation is the priced finding: ~82% of the authored gain is
lost at v2-trigger estimation quality, because 28/48 moments (and all
12 quiet plants) were estimated "neutral"/"concession" — live judging
inherits blindness exactly where detection is silent. Bound stated:
this prices the v2 trigger; today's v4 + typed quiet detector would
gloss more moments correctly, so the number is a floor, re-measurable
with the standing script at any detection version. (The card's earlier
0.98/1.91 headline used all valid pairs per channel; the three-way
comparison above uses identical rows — both readings stored in
`exports/tutor-stub-outcome/j2-estimated-disclosure.json`.)

PHASE J COMPLETE: state-shown judging is a standing instrument, and
what deployment inherits from detection error is now a number.
