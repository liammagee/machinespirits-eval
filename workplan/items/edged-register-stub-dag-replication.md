---
id: edged-register-stub-dag-replication
title: Re-ask the edged-register question inside the tutor-stub proof-DAG harness
status: active
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-08-18
updated: 2026-08-27
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
    - resistance-action-register-integration
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

## Log

- 2026-08-27: Raised to P1 and taken by claude on operator instruction
  ("super high priority now"). Work starts at the card's own step 1:
  read §3.10-§3.10.4 of the draft note, then survey the stub harness's
  register machinery before designing the contrast. Zero-call until a
  signed GO.
- 2026-08-29: Stage-2 block closed on the fixed guard. The leak guard had
  read its compound word lists as any-word: bare "die" beside the answer
  name ("die-flaw", "die marks") fired the private-conclusion kill with no
  real leak. All 8 recorded kills were that defect; none showed a leak.
  Fixed in d74969e0: component lists now need every word in one sentence,
  variant lists keep any-of, and a quoted "whether" clause counts as
  withholding the conclusion. 26 new tests pin the 8 kill sentences.
  Re-runs on the fixed code (resume machinery, sealed sibling roots):
  diligent 24/24, resistant 24/24, all 8 killed dialogues recovered
  clean, 3 codex CLI timeouts healed on a second pass. Two turn-18
  learner-analysis classifier calls failed all retries in the diligent
  cell; both sit past the 16-turn endpoint horizon, so the endpoint is
  untouched. One re-run launch was killed by a background-agent sweep;
  relaunched detached and completed. Fidelity read on the resistant cell
  (Sonnet 5, sealed context): pin check 0 violations in 946 turns; sharp
  arm 432 present of 480, rate 0.90 over the 0.8 floor; one turn refused
  by the API with a harms label every time (counterfeit-die content read
  without tutorial framing); operator accepted the arm at 479/480. Warm
  arm: 50 of 466 turns read as edged, report-only. Report:
  `qa-matrix-2026-08-29T12-21-26-240Z/fidelity-resistant-final.md`.
  Artifacts archived (private repo 0af1573c). Known residual: a
  negated-existential sentence joined by "but no" can still trip the
  final check; the only recorded case is in a void superseded root.
- 2026-08-29 (endpoint): Final primary endpoint computed over the full
  72-row roster on the fixed guard (memo §9). Null in every cell:
  turn-16 coverage sarcastic vs warm — resistant 0.250/0.292, diligent
  0.486/0.472, proof_skipper 0.444/0.486; area under the curve equally
  flat. §8's resistant-cell sarcastic advantage came from the voided
  pin-leak block and did not survive the clean re-run. With the teaching
  held fixed by the scripted core, the manner alone moves nothing the
  endpoint can see. The Stage-1 leak ordering (resistance pulls edge
  into a warm-pinned voice) stands as the surviving finding.
