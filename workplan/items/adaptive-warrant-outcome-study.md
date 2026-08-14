---
id: adaptive-warrant-outcome-study
title: "Adaptive warrant gate: pre-registered outcome study + steering/challenge decomposition"
status: done
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-08-12
updated: 2026-08-15
verification: "Complete: main block 72/72 dialogues, 576 frozen cases, 1,152 accepted reads (ruling 100); decomposition 48/48 dialogues, 384 cases, 768 accepted reads, zero-challenge guard recount clean (ruling 105); both runs archived to the private repo with SHA-256 manifests; results folded into paper §6.25 at v3.0.288; campaign counter closed 10,459/19,337."
claim_status: scope-bound
links:
  notes:
    - docs/adaptation-refinement/v3-outcome-study-registration.md
    - docs/adaptation-refinement/relay/096-reviewer-reregistration-outcome-main-block.md
    - docs/adaptation-refinement/relay/100-reviewer-verification-and-ruling.md
    - docs/adaptation-refinement/relay/104-codex-report.md
    - docs/adaptation-refinement/relay/105-reviewer-verification-and-ruling-steering-decomposition.md
  items:
    - adaptive-warrant-baseline-study
    - adaptive-warrant-contract-redesign
tags:
  - tutor-stub
  - adaptation
  - warrant-gate
  - pre-registered
  - decision-quality
branch: adaptation-refinement
---

Three-condition pre-registered comparison (bare / gated / standing-permission)
of the live warrant gate on a permission-seeking simulated learner, run
unattended by the committed-relay protocol (process cost reported in paper
§7.15), then a fresh pre-registered steering/challenge decomposition.

Results (paper §6.25): the gate's dialogue-level effect is real and
replicates on fresh seeds — deference breaks 19/24 gated vs 10/24 bare vs
11/24 standing in the main block, 16/24 in the fresh gated arm — but the
registered causal path failed: always-on steering, not the sensor-timed
challenge, carried the break effect, and the gate's verbatim wording as a
standing prompt delivered zero challenges. Off-prediction, gated decision
correctness ran 87.5% vs 64.8%/68.3% controls; the decomposition showed the
challenge family is load-bearing for that channel (83.80% gated vs 71.84%
steering-only, registered P5c), while the break-count gap (3 dialogues) sat
under the registered threshold. The two outcome channels decompose
differently; any single-mechanism story needs a fresh registration.

Watch item (ruling 105 §2): the decomposition launcher should keep the
launch-commit stamp on resumed freezes, matching the main-block launcher's
defect-18 repair. Zero-call fix, unscheduled.

No further paid run is authorized under this arc.
