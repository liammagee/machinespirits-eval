---
id: weights-level-conduct-subtraction
title: "Draft: can weights-level training subtract conduct that context cannot?"
status: triaged
type: research
priority: P3
owner: unassigned
source: manual
created: 2026-08-31
updated: 2026-08-31
verification: >-
  A zero-call design review either rejects the probe or produces a
  training-and-fielding plan naming the target conduct (the §6.30
  withholding arm), the training-data strategy that avoids restating a
  negated instruction, a fielding gate that reuses the defiant study's
  delivery instrumentation, replay guards showing untargeted conduct
  unchanged, and a spend ceiling — all fixed before any training run or
  paid call, neither of which this card authorizes.
claim_status: future
depends_on:
  - defiant-warrant-outcome-study
links:
  items:
    - program-2-context-vs-weights-finetune
    - defiant-warrant-outcome-study
  paper:
    - docs/research/paper-full-2.0.md
tags:
  - draft
  - under-review
  - tutor-stub
  - fine-tune
  - subtraction-limit
  - study-design
---

## Draft status

**Under review.** This card is deliberately `triaged`, not active. It
authorizes no training run, no model calls, and no fresh study. Promotion
requires an explicit human decision that the subtraction boundary is worth
probing at the weights level.

## Research question

The defiant-learner warrant study (§6.30) could not field its control arm:
a tutor that presses the test while withholding its epistemic grounds was
delivered in 0 of 8 dialogues by instruction and survived in 0 of 9 under
a gated repair that quoted the violating sentence back. §7.16 generalizes
this as the additive/subtractive asymmetry of prompt-level adaptation:
context can add conduct (hostile registers, resistant personas, moves,
warrant gates) but could not remove conduct that training installed. Is
that a limit of the medium (context) or of the model? Program-2
(§6.20–§6.22) showed the complementary positive — a targeted fine-tune
carried an added move into weights. This card asks whether a targeted
fine-tune can carry a *removal*: field the withholding arm that no prompt
could produce.

## Why retain the question

The subtraction limit is currently a boundary claim about prompt-level
adaptation only, and it is load-bearing: it bounds what any deployed
prompt-configured tutor can be made *not* to do. If weights-level training
also fails to subtract the conduct, the limit is about the model and the
literature's negation results generalize; if it succeeds, the limit is
about the medium and the §6.30 design regains its missing control arm.
Either answer sharpens §7.16.

## Design requirements

- Do not restate the negation as training text: negated instructions are a
  known failure mode. Train on positive exemplars of the target conduct
  (turns that press the test and give no grounds), not on prohibitions.
- Reuse the §6.30 fielding gate unchanged as the success measure: the arm
  exists only if the delivery instrumentation says it was delivered.
- Replay-guard the rest of the repertoire: the fine-tuned tutor must
  reproduce the warrant-serving arm and the unrelated moves on frozen
  probes, so the subtraction is targeted rather than a general degradation.
- Keep the conduct benign and scoped: the target is a pedagogical control
  arm (withholding grounds while pressing a test), not a general
  capability-removal method.
- Any training corpus, base model, and spend ceiling are named in the
  registered design, not improvised.

## Decision gate

The zero-call review ends in one of two dispositions:

- **Drop:** no training-data strategy plausibly avoids the negation trap,
  or the replay guards cannot be made strong enough to interpret a
  success. Record that and close; §7.16 stands with its scope note.
- **Advance to design:** name the corpus strategy, base model, fielding
  gate, replay guards, floors, estimated cost and ceiling. Any training
  run or paid evaluation remains a separate registered study requiring the
  operator's GO.
