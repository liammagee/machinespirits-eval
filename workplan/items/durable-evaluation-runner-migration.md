---
id: durable-evaluation-runner-migration
title: Migrate paid runners to the durable execution contract
status: active
type: infra
priority: P1
owner: codex
source: review
created: 2026-09-02
updated: 2026-09-03
branch: codex/durable-evaluation-runner-migration
verification: "Each named paid runner reserves immediately before dispatch, terminalizes every attempt, reconciles stale in-flight work, resumes only missing accepted work, and reports attempt, unit, workflow, and scientific-verdict state from the same ledger."
claim_status: planned
links:
  notes:
    - docs/durable-evaluation-execution-contract.md
    - docs/paid-study-authorization-policy.md
    - services/durableAttemptJournal.js
  items:
    - adaptive-curriculum-memory-controller
tags:
  - evaluation
  - reliability
  - paid-study
---

Move the repository's paid model-backed runners onto the shared durable
execution contract one at a time. Inventory every runner first, then migrate
only with a focused fault-injection test at the four boundaries: before
reservation, after reservation before dispatch, after dispatch before response
persistence, and after response persistence before unit acceptance.

For each runner, prove that restart produces no duplicate accepted output, no
lost completed work, no unexplained reservation, and no widening of the
registered route, inputs, seed, measurement, or ceiling. Status and ETA must be
projected from the same ledger and stage machine. Keep the action-outcome
recovery as the reference implementation; do not mark another runner migrated
until its own dispatch path and recovery semantics are exercised.

This card is infrastructure only. It authorizes no provider call and changes no
scientific design.

## Inventory and migration state

The executable inventory is `config/paid-study-launcher-inventory.json`; its
durability partition is checked by `scripts/check-paid-study-launcher-inventory.js`.
Shared launch admission is not treated as evidence of durable per-dispatch
execution.

- Reference implementation (2):
  `run-tutor-stub-action-outcome-collection-pilot.js` and
  `run-tutor-stub-action-outcome-failed-unit-recovery.js`.
- Shared-admission runners still requiring migration (7):
  `run-tutor-stub-action-outcome-model-judge-shadow.js`,
  `run-tutor-stub-frame-refuser-narrowing-calibration.js`,
  `run-tutor-stub-frame-refuser-satisfiable-calibration.js`,
  `run-local-qwen-invested-rival.js`,
  `run-invested-rival-luna-reference.js`,
  `run-invested-rival-learner-iteration.js`, and
  `run-invested-rival-learner-replication.js`.
- Historical or pre-policy runners that must be retired or migrated before any
  future reuse (10): `run-adaptive-warrant-outcome-main-block.js`,
  `run-adaptive-warrant-outcome-pilot.js`,
  `run-adaptive-warrant-steering-decomposition.js`,
  `run-tutor-stub-defiant-warrant-pilot.js`,
  `run-tutor-stub-frame-refuser-depth-calibration.js`,
  `run-tutor-stub-resistance-action-register-manipulation-validation.js`,
  `run-tutor-stub-resistance-warm-nonwarm-confirmation.js`,
  `run-tutor-stub-resistant-learner-calibration-v2.js`,
  `run-tutor-stub-resistant-learner-calibration.js`, and
  `run-tutor-stub-resistant-learner-merged-calibration.js`.

2026-09-03 — Completed the fail-closed inventory tranche from current
`origin/main`. No additional runner is marked migrated: the simple fixed-call
calibration runners lack a registered recovery reserve, while the reserve-bearing
invested-rival runners share a multi-stage dispatch path that must be migrated
coherently with response persistence, missing-only recovery, and ledger-derived
workflow status. The whole card remains active.
