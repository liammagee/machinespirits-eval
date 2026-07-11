---
id: tutor-stub-learner-state-validity
title: Validate adaptive-tutor learner-state predictions
status: active
type: research
priority: P1
owner: codex
source: review
created: 2026-07-11
updated: 2026-07-11
verification: "A grouped held-out benchmark compares the lean state, Plan 2 belief state, PLAN 4 fields, ablations, scramble, stale, and oracle controls on next-error/evidence/uptake/ownership and horizon outcomes; calibration and abstention reports land under exports/ and determine which fields remain control inputs."
claim_status: planned
depends_on:
  - adaptive-eval-immutable-provenance
links:
  notes:
    - PLAN_4_0/2026-07-11-adaptive-tutor-implementation-plan.md
tags:
  - adaptive-tutor
  - learner-state
  - calibration
  - held-out-evaluation
milestone: adaptive-tutor-evidence-v1
branch: codex/adaptive-tutor-implementation
---

Implement Phase 2 of the linked plan. Validate the sensor before optimizing a
policy against it; fields that do not add held-out predictive value are demoted
to visualization rather than retained by architectural preference.

2026-07-11 Codex: Added the policy-invariant public-state adapter, frozen lean
difficulty-aware comparator, aligned placebos/ablations, grouped held-out
metrics, sealed benchmark exporter/analyzer, and deterministic fixtures. The
card remains active until multi-world latent-generator data clear or fail the
sensor gate; current engineering fixtures are not empirical evidence.

2026-07-11 Codex: Added sealed A21 and exact DAG-dropout formal instruments,
cross-dialogue placebos, paired whole-dialogue bootstrap intervals, and an
explicit independent latent-generator gate. The bounded formal fixture returns
`not_passed / do_not_optimize_policy`; authentic learner data remain unavailable.
This is a valid stop signal for policy optimization, not a human-learning claim.

2026-07-11 Codex audit: Strengthened the common lean comparator so every
representation receives the same byte-identical public evidence text, stable
evidence ID, type, source, task difficulty, and missingness block. Re-running
the sealed 12-row formal instrument still returns
`not_passed / do_not_optimize_policy`. The report now calls its statistical
floor `claim_grade_settings`; that phrase describes bootstrap/calibration
settings only, never the evidence or sensor status.
