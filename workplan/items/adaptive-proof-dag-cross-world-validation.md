---
id: adaptive-proof-dag-cross-world-validation
title: "Independently validate proof-DAG and release-gate semantics across worlds"
status: blocked
type: research
priority: P2
owner: human
source: review
created: 2026-08-29
updated: 2026-08-29
verification: "Independent reviewers complete a frozen, outcome-blind packet covering Rowan Flat plus at least two materially different authored worlds; for every sampled release turn they agree which premises are public, which proof rules can fire, and which conclusions remain forbidden; disagreement stays indeterminate; deterministic guard fixtures reproduce the rulings without changing sealed historical artifacts."
blocked_by: "Independent proof/release reviewers and a frozen validation packet from at least two additional authored worlds; no model generation is needed or authorized"
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
