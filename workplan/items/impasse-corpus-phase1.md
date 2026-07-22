---
id: impasse-corpus-phase1
title: "Impasse program Phase I: candidate-episode corpus from the user's own sessions"
status: active
type: research
priority: P1
owner: claude
source: manual
created: 2026-07-17
updated: 2026-07-22
verification: "Zero-model-call extraction over the ~25 human + 2 mixed interactive tutor-stub sessions in .tutor-stub-traces/: candidate impasse episodes detected by seven text/state heuristics (clarification markers, /clarify usage, learner restatement, tutor re-gloss, coverage stagnation, comprehension pressure, abrupt exit/abandonment), emitted as a machine sidecar plus a human labeling sheet (impasse y/n; type; tutor-addressed; resolved-within-2) capped at 60 ranked episodes. Phase gate: the sheet is annotated by the user; Phase II then tests the stub's computed signals as impasse detectors against those labels before any repair-move design."
claim_status: planned
depends_on: []
links:
  notes:
    - PLAN_4_0/2026-07-17-continue-or-fold.md
    - notes/impasse/2026-07-17-phase1-labeling-sheet.md
  items:
    - tutor-stub-side-coaching-gate
    - consolidated-labelling-game-harness
tags:
  - impasse-program
  - human-sessions
  - tutor-stub
  - ground-truth
milestone: impasse-program-v1
---

The corrected target of the preconscious fold's forward door (user, 2026-07-17):
show purposeful and effective adaptation to communicative impasses. The ground
truth nobody built before exists already — the user's own interactive sessions
(25 human + 2 mixed, 166 turns, including abandonments). Phase I converts them
into a labeled corpus: candidate episodes extracted mechanically, labeled by
the user (the person who experienced the impasse), giving the program its
first non-authored, non-synthetic interiority reference.

Program shape (memo forward-doors section): Phase I corpus → Phase II detector
test (existing computed signals vs the labels) → Phase III repair moves
delivered point-of-action (Step 4 machinery; standing prompts and typed form
contracts are closed routes) → Phase IV on/off demonstration in live sessions,
endpoint = impasse resolution. A1/IRB only after the n=1 loop works. The one
confirmed generation-side defect in the whole system — verbatim learner echo,
which is impasse-blindness in miniature — is Phase III's first target.

2026-07-17 Claude: Card created at Phase I launch (user go). Extraction agent
running: seven heuristics, zero model calls, outputs under notes/impasse/.
Board discipline applied from birth this time — the V-series ran 37 iterations
without a card; this program will not.
