---
id: adaptive-proof-dag-cross-world-validation
title: "Independently validate proof-DAG and release-gate semantics across worlds"
status: blocked
type: research
priority: P1
owner: human
source: review
created: 2026-08-29
updated: 2026-08-30
verification: "Independent reviewers complete a frozen, outcome-blind packet covering Rowan Flat plus at least two materially different authored worlds; for every sampled release turn they agree which premises are public, which proof rules can fire, and which conclusions remain forbidden; disagreement stays indeterminate; deterministic guard fixtures reproduce the rulings without changing sealed historical artifacts."
blocked_by: "Two independent proof/release reviewers must complete and freeze the prepared cross-world-v1 submissions; the zero-call packet, machine key, and comparison tooling are ready"
claim_status: planned
depends_on:
  - proof-dag-dramatic-derivation-assessment
  - adaptive-tutor-canonical-kernel-contract
links:
  notes:
    - notes/poetics/2026-08-29-adaptive-tutor-from-null-to-control.html
    - notes/2026-08-03-adaptive-causality-living-log.md
  paper:
    - docs/research/paper-full-2.0.md#624-the-four-locks-why-nothing-beat-the-bare-tutor-and-what-opened-when-each-was-removed-post-hoc-except-the-claim-gate-development-tier
  items:
    - proof-dag-dramatic-derivation-assessment
    - lean-semantic-web-proof-dag-validation
    - adaptive-causality-publication-holdout
  code:
    - config/proof-dag-validation/cross-world-v1.packet.json
    - services/dramaticDerivation/proofDagReview.js
    - scripts/proof-dag-cross-world-review.js
    - docs/proof-dag-cross-world-review.md
tags:
  - adaptive-tutor
  - proof-dag
  - release-schedule
  - human-validation
  - cross-world
milestone: adaptive-tutor-evidence-v1
---

# Cross-world proof-DAG validation

The report shows how an authored proof DAG can prevent a plausible shortcut from
becoming a licensed conclusion. Existing formal and export checks establish that
the machinery can represent and verify a DAG; they do not independently establish
that multiple worlds encode the intended evidential semantics or release timing.

Freeze a small packet before review. Each row should give reviewers only the
public prefix, the authored premises and rules needed for the ruling, and the
release ledger at that turn. Reviewers label available premises, enabled rules,
licensed conclusions, and forbidden shortcuts without seeing tutor outputs or
downstream outcomes. Compare their frozen rulings with the deterministic gate
only afterward.

This is a validity check on world semantics and delivery enforcement, not a tutor
efficacy study. A defect creates a prospective corrected world/version and a
regression fixture; it must not rewrite a sealed historical run or silently
reinterpret its outcome.

2026-08-29 Codex: Implemented the zero-call preparation slice. The frozen
six-case packet covers partial and first-licensed release prefixes in Rowan
Flat, the Campus FAQ Machine, and the Unsigned Nocturne. Reviewer material is
separated from the machine-derived key; candidate labels are neutral; tutor and
learner outputs, downstream outcomes, and expected rulings are absent. The
comparison path validates complete independent submissions and preserves any
explicit uncertainty or coder disagreement as `indeterminate`. The packet
SHA-256 is `8d25c0c1053ec88f36d07a3b2d4f37cdf7eef41de7869c91b486be5020d2f4c2`.
Focused and adjacent dramatic-derivation tests pass 109/109. No model calls or
human rulings were made. The card remains blocked only on two independent human
reviewers completing the frozen packet.

2026-08-30 Codex: Raised from P2 to P1 after the human-work review. This is the
smallest ready external-validity gate: six frozen cases across three worlds can
test whether the proof and release semantics mean what the machinery claims,
without being mistaken for tutor efficacy or human-learning evidence.
