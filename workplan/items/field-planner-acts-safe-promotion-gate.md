---
id: field-planner-acts-safe-promotion-gate
title: "Phase 6B acts-safe field-planner production comparison"
status: done
type: experiment
priority: P1
owner: unassigned
source: review
created: 2026-07-11
updated: 2026-07-17
verification: "An acts-compatible adapter constructs planner inputs only from a validated public or tutor-reconstructed learner-state view; leak tests prove that the harness board, frontier, proof distance, decay ledger, and future state never cross the acts redaction boundary; a new frozen protocol then compares matched planner arms with the exact production hidden+proofDebt stack and seals a deterministic verdict."
claim_status: killed
blocked_by: "The current field planner reads the true learner board but acts mode redacts that state; the v2 learner-state sensor and an acts-safe reconstructed-state adapter do not yet have a passing gate."
depends_on:
  - adaptive-eval-immutable-provenance
  - tutor-stub-learner-state-validity
links:
  notes:
    - PLAN_4_0/PHASE_6_EVIDENCE_GATE_PLAN.md
    - PLAN_4_0/2026-07-11-adaptive-tutor-implementation-plan.md
  items:
    - field-planner-phase6-gate
tags:
  - dramatic-derivation
  - field-planner
  - acts
  - proof-debt
  - reconstructed-state
milestone: adaptive-tutor-evidence-v1
---

Build and test the true production comparison only after the public sensor has
passed. The planner must consume the same kind of state the tutor can legally
reconstruct in acts mode; it may not receive an omniscient harness projection.

Phase 6A can show that the current hand-coded controller has formal value in a
non-acts testbed. It cannot unblock this card or stand in for hidden+proofDebt.

2026-07-17 Claude: CLOSED per the approved fold
(PLAN_4_0/2026-07-17-continue-or-fold.md §6.3). Both prerequisites died: the
learner-state sensor closed (`do_not_run_canonical_s2`, v2.4 transparency
result), and Phase 6A itself is closed designed-not-run. No reconstructed-state
adapter will be built on this branch. Any revival is a fresh sanction with a
new instrument, not a reopening of this card.
