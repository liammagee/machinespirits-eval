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
verification: "Benchmark v2 shares the exact live DAG/field/last-four trajectory projection; crosses Marrick, Hethel, and Ravensmark with two independent latent kernels and two language-model families; evaluates a no-state -> lean-DAG -> DAG-trajectory -> field-trajectory ladder against matched stale/scramble and oracle controls on two harness-owned targets; and seals an untouched world/generator/realizer-transfer verdict within the frozen 8-per-cell cap."
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

2026-07-11 Codex correction: The 12-row v1 result did not test the exact live
sensor. It lacked a true no-state baseline and last-four trajectory, confounded
generator with model/source labels, repeated the same rows across holdout
summaries, and included degenerate/world-local targets. Its correct verdict is
"v1 proxies not promotable," not "the live sensor is invalid."

2026-07-11 Codex: Extracted the exact runtime DAG/field/risk trajectory into a
shared pure service, persisted that projection in benchmark observations,
preserved missing observations instead of converting them to false zero
movement, and added parity tests. Added the versioned v2 critical-path plan:
three geometries × two transition kernels × two model-family realizers, two
primary harness targets, nested representations with byte-equal recipient
common input, strict oracle/proof-transition provenance, separate transfer
lanes, 24-dialogue free contract stage, 24-dialogue paid technical pilot, and a
confirmation cap of six or eight per cell. The planner is an immutable
planning transaction; the generalized cross-world kernels, sequential realizer
executor, and v2 dataset have not yet run, so the card remains active and no new
sensor verdict exists.
