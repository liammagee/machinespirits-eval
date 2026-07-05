---
id: lemma-map-sonnet-smoke
title: Lemma-map Sonnet smoke — does the bookkeeping artifact help a mid-tier inner loop?
status: done
type: experiment
priority: P2
owner: unassigned
source: manual
created: 2026-07-04
updated: 2026-07-04
branch: worktree-strategy-ledger-followups
verification: "4 canary-gated Sonnet runs complete (or an instrument-limited stop is recorded); the pre-stated read rules below produce a propose/no-go, never a claim."
claim_status: exploratory
links:
  notes: LEMMA-DISPLAY-CONFIRMATORY-PREREGISTRATION.md
  items:
    - proof-lemma-layer
    - strategy-ledger-model-confound-smoke
tags:
  - adaptive-tutor
  - derivation
  - lemma-layer
  - model-confound
  - smoke
---

Operator question (2026-07-04, after the display confirmatory closed): the
lemma map is a STATE artifact, not a judgment prompt — the one category the
bookkeeping-vs-judgment framework predicts should help precisely the model
that cannot maintain even a small closure reliably. The cross-model
plan-mode test does NOT cover this (it probed a judgment layer, where weak
egos churn). This smoke asks the smallest version on a mid-tier model:
`DERIVATION_PROVIDER=claude`, `DERIVATION_MODEL=sonnet` (CLI quota, zero
marginal dollars), world-019-marrick-resistant, seed-paired
baseline/lemma-display at seeds 101 and 103 — the same seeds as the codex
display confirmatory, giving within-seed cross-model comparators (codex
r1/101: both arms aporia 29; codex r2/103: baseline grounded 23, display
disengagement 29). Four runs, concurrency 1, canary-gated.

**Pre-stated read rules (BEFORE the data):**

1. **Instrument gate (canary):** baseline-r1 must complete with parseable
   role JSON throughout, >=5 releases on the record, non-empty
   tutor/learner dialogue. Failure -> recorded instrument-limited (the
   GLM-5.2 precedent); stop; the question stays open on this stack.
2. **Floor read:** does Sonnet baseline differ markedly from the codex
   baseline at the same seeds (different failure texture = the model
   matters to the floor)?
3. **Map read (the question):** is display minus baseline on T*/grounded
   at least directionally favorable where codex's was flat? Both (2) and
   (3) favorable -> licenses PROPOSING a powered mid-tier contrast
   (display-primary, new prereg, operator decision). One alone ->
   ambiguous, default no-go.
4. n=2/arm is directional color ONLY (the flash smoke's 2/2 -> 0/2
   inversion is the standing warning). No claims from this smoke under
   any outcome; the lemma line stays closed per its frozen consequences.

2026-07-04 Claude: SMOKE COMPLETE (4/4, CLI quota, ~80 min sequential, zero
parse failures — Sonnet holds every role contract). Table (seed | Sonnet
base/display | codex base/display): 101 | aporia 29 / **GROUNDED 23** |
aporia 29 / aporia 29; 103 | disengagement 29 / disengagement 29 |
grounded 23 / disengagement 29. READ (per the pre-stated rules): (1)
instrument PASS; (2) floor read YES — Sonnet baseline 0/2 where codex went
1/2, opposite textures per seed; (3) map read FAVORABLE — Sonnet
display-minus-baseline = one grounded win + one tie (mean T* delta −3.0)
at seeds where codex's map delta was flat-to-negative (+3.0). Both rules
met → **PROPOSE-GO recorded**: a powered mid-tier display-primary
contrast is licensed for proposal (new prereg, operator decision). NOT A
CLAIM: n=2/arm; the flash smoke inverted from this exact posture, and
today's display confirmatory flattened a U=40.5 exploratory to U=67 —
the winner's-curse warning applies at full strength. RECOMMENDATION
recorded with the go: run the exploratory-confirmatory-shrinkage-audit
FIRST and size any Sonnet contrast against a shrunken effect estimate
(bar not set at the smoke's point estimate), per the audit card.
