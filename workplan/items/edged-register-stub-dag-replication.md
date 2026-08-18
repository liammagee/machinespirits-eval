---
id: edged-register-stub-dag-replication
title: Re-ask the edged-register question inside the tutor-stub proof-DAG harness
status: active
type: experiment
priority: P2
owner: unassigned
source: manual
created: 2026-08-18
updated: 2026-08-18
verification: One stub-harness block contrasts a sharp delivery policy against
  the warm policy on the same worlds and the same proof-DAG, with completion
  taken from the DAG rather than from a model reader, and reports whether the
  sharp policy changes how much of the proof debt the learner discharges. A
  null is a result. Any paid stage runs only after its own committed GO note
  and explicit human approval.
claim_status: planned
depends_on:
  - edged-register-outcome-study
links:
  notes:
    - notes/2026-08-16-edged-register-calibration-draft.md
  items:
    - edged-register-outcome-study
    - tutor-stub-headroom-contrast
    - refactor-tutor-stub-register-palette
    - tutor-stub-fallback-register-and-uptake-guard
tags:
  - registers
  - tutor-stub
  - proof-dag
---

## Why this card exists

The edged-register main block (312 rows, `batch-main-2-2026-08-17`) has
gone as far as reading can take it, and the readings do not settle the
question. §3.10 to §3.10.4 of
`notes/2026-08-16-edged-register-calibration-draft.md` record the state:

- The primary endpoint drops under a sharp register — 0.601 pooled over
  the two sharp versions against 0.712 warm — but the block has 48% power
  against that drop, so it neither lands nor dies.
- The whole gap sits in one scenario of four (the bored learner holding a
  claim). Three scenarios are flat.
- Inside that scenario the warm tutor is the one that behaves oddly: it
  eases its ask from 3.06 parts per turn elsewhere to 2.50 there, while
  the sharp tutor asks the same amount everywhere.
- Matched transcripts show no learner-side difference in length, in
  naming a verdict, or in refusing. Not one learner in 226 turns answers
  the tutor's manner.
- The one surviving lead is that the sharp learner supplies less backing —
  making the case 0.333 against 0.700, naming the deciding feature 0.767
  against 0.962 — while stating its position at the same rate.

Every one of those numbers comes from a model reader that could see the
tutor's sharp text inside the read window. So the surviving lead has a
confound built into the instrument: a case that follows a sarcastic prompt
may simply read as weaker. Nothing in this design can separate "the
learner argued less" from "the reader marked the argument down". Two paid
reads of the same 312 transcripts have now hit that wall.

## What the stub harness would change

The tutor-stub harness scores completion against the proof-DAG the learner
has to discharge, not against a reader's verdict. It already carries a
register palette and register policies, and
`tutor-stub-headroom-contrast` established the outcome-only score as a
confound-free way to rank policies. That is the missing channel: the same
question — does a sharp delivery cost the learner anything — asked where
"did the learner do the task" is a machine check.

## What the next session should do

1. Read §3.10 to §3.10.4 of the draft note first. Do not re-run any read
   of `batch-main-2`; that ground is exhausted and the note says so.
2. Find out what the stub harness can already express: which register
   policies exist, whether a sharp or ironic policy can be pinned per
   turn, and what the outcome-only score counts as discharged proof debt.
   Say plainly what is missing before proposing to build it.
3. Design the contrast on the stub side — sharp policy against warm
   policy, same worlds, same DAG, learner held fixed. Decide up front what
   counts as the outcome and register it. Include a same-treatment control
   (two runs of the same policy) so a false positive can be caught the way
   §3.10.3 caught one.
4. Power it off a real baseline. The edged block was powered at 0.479 and
   the control came in at 0.712, which is why it could not resolve its own
   effect. Measure the stub baseline before sizing the block.
5. Write a GO note headed DRAFT FOR HUMAN REVIEW. It licenses nothing
   until the operator signs, commits, and separately approves the launch.

## Constraints that carry over

- Generation on `codex.gpt-5.6-luna` both seats and judging on claude-code
  Sonnet 5, unless the operator rules otherwise. Never nemotron/kimi.
- Work in a worktree, commit there, never push.
- Commit trailer `Workplan-item: edged-register-stub-dag-replication`.
  Never commit `workplan/BOARD.md` or `workplan/board.json` on a branch.
- The operator rules on any confirmed harm signal, never the agent.
