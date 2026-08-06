---
id: sarcasm-determinate-negation-grid
title: Sarcasm as determinate negation — cargo-bearing cue contract
status: triaged
type: experiment
priority: P3
owner: claude
source: manual
created: 2026-08-06
updated: 2026-08-06
verification: A 15-row run (or an explicit drop decision) reports fidelity vs the parent sarcasm arm, faithful-row conversion, and negation recovery, with exclusions and invalid violations separate; any claim lands in paper §6.7 first.
claim_status: planned
links:
  notes:
    - notes/2026-08-06-sarcasm-determinate-negation-preregistration.md
    - notes/2026-07-26-negative-register-effect-estimation-preregistration.md
  paper:
    - docs/research/paper-full-2.0.md#67-architectural-extension-the-id-director-family-and-charismatic-pedagogy
  runs:
    - eval-2026-08-05-87fe3664
  items:
    - negative-register-effect-estimation-grid
depends_on:
  - negative-register-effect-estimation-grid
tags:
  - registers
  - negative-registers
  - stance-fidelity
  - determinate-negation
---

Follow-up to the negative-register effect grid. The grid found sarcasm holds
its assigned manner most often (8/15 faithful) and converts least (5/8
positive; 0 positive on its faithful question-flood and rote-parroting
rows), while irony — the register that compiles into propositional moves —
both survives and converts. Working diagnosis: the sarcasm contract
enforces tone without cargo.

The proposal treats sarcasm as a double negation with a determinate target:
each sarcastic utterance must name a learner claim P and implicate not-P,
so the manner marker is the warrant for derived content. New measure:
negation recovery — does the learner voice the implicated correction?

Design frozen in the linked pre-registration note. One new cell (ID to be
allocated per registry discipline), five targets, three repeats, 15 rows,
parent-grid stacks and judges unchanged. Paid run gated on the standard
frozen-plan dry-run SHA plus explicit operator authorization.

2026-08-06 Claude: Card created with the design pre-registration; no cell
allocated, no code changed, no spend authorized.

2026-08-06 Claude: Apparatus built and validated, zero paid rows. Cell 202
allocated (registry ratchet bumped 205→206); new register
`sarcastic_determinate` + arm mapping in the stance registry; gate extended
with a named-target-claim signal that withholds the faithful label without
it (plain sarcastic scoring unchanged, test-pinned); negation-recovery
measure added (deterministic path + judge path) and the register scorer
persists stance + recovery per slice for this register only. Fixture
(8 hand-authored slices) passes 8/8 deterministic and 8/8 on the sonnet-5
judge path, including echo-is-not-recovery and paraphrase-counts. Frozen
launcher clones the parent discipline; dry-run plan SHA-256
b954b0dfe089f6d783bb34d825e8050686015425926638b1820cac07096c08d7 (15 rows,
launch locked). Fixture recalibration note: three authored slices first
failed the gate on move-verb wording and one expectation was corrected
(pure warmth = not_instantiated, not costume). Paid run remains gated on
fresh operator authorization bound to the dry-run SHA above.
