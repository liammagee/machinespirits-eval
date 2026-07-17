---
id: unreliable-learner-prereg-completion
title: "Close the completed unreliable-learner pre-registration (final-stretch Step 5)"
status: done
type: experiment
priority: P2
owner: codex
source: manual
created: 2026-07-13
updated: 2026-07-14
verification: "Independent mechanical re-score finds the amended set complete at 12/12, reproduces the archived scores byte-for-byte after removing scoredAt, and reports zero schedule violations and zero G2 breaks; prereg results addendum and paper §6.13.7 agree."
claim_status: scope-bound
depends_on:
  - adaptive-eval-immutable-provenance
links:
  notes:
    - UNRELIABLE-LEARNER-PREREG.md
    - notes/poetics/2026-06-11-unreliable-learner-results.md
    - PRECONSCIOUS-FINAL-STRETCH-PLAN.md
    - PLAN_4_0/2026-07-13-preconscious-arc-stocktake-and-final-stretch.md
  paper:
    - docs/research/paper-full-2.0.md#6137-the-unreliable-learner-harness-implemented-forgetting-and-the-first-load-bearing-explicit-channel
  exports:
    - exports/dramatic-derivation/unreliable-v1-scoring/scores.json
    - exports/dramatic-derivation/unreliable-v1-scoring/report.md
  runs:
    - exports/dramatic-derivation/loop/noc-decay-v1-{A,B}-s{1,2,3}
    - exports/dramatic-derivation/loop/wit-decay-v1-{A,B}-s{1,2,3}
tags:
  - unreliable-learner
  - explicit-state-channel
  - pre-registration
  - dramatic-derivation
milestone: adaptive-tutor-evidence-v1
---

The 2026-07-13 stocktake mistook the preregistration's amendment history for
current run state. The amended experiment had already completed 12/12, been
mechanically adjudicated, and been folded into paper §6.13.7. This closeout
adds the missing results addendum to the preregistration itself and makes the
workplan agree with the existing evidence.

2026-07-13 Claude: Card created at final-stretch sanction
(PRECONSCIOUS-FINAL-STRETCH-PLAN.md Step 5). Small paid run; order-independent
among Steps 3-5 after Step 2 completes. Launch requires an explicit go.

2026-07-14 Codex: Re-ran the mechanical scorer over the 12 registered artifacts
to an isolated output directory. The normalized result is byte-identical to
the archive: told 49/57, conduct 7/19, gap +0.491, bootstrap CI [0.313, 0.746],
zero schedule violations, zero G2 breaks. No paid rerun was warranted.
