---
id: durable-evaluation-runner-migration
title: Migrate paid runners to the durable execution contract
status: done
type: infra
priority: P1
owner: codex
source: review
created: 2026-09-02
updated: 2026-09-03
branch: codex/durable-runner-migration-completion
verification: "The six maintained paid runners satisfy the durable execution contract with focused crash-boundary, missing-only recovery, plan-identity, response-integrity, and four-plane status tests; all thirteen non-migrated launchers fail closed at every exported and CLI paid-dispatch boundary."
claim_status: methods
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

- Reference implementation / fully migrated (6):
  `run-tutor-stub-action-outcome-collection-pilot.js` and
  `run-tutor-stub-action-outcome-failed-unit-recovery.js`, plus
  `run-invested-rival-learner-replication.js`,
  `run-invested-rival-luna-reference.js`,
  `run-invested-rival-learner-iteration.js`, and
  `run-local-qwen-invested-rival.js`.
- Shared-admission runners still requiring migration (0).
- Retired from future paid dispatch (13):
  `run-tutor-stub-action-outcome-model-judge-shadow.js`,
  `run-tutor-stub-frame-refuser-narrowing-calibration.js`,
  `run-tutor-stub-frame-refuser-satisfiable-calibration.js`,
  `run-adaptive-warrant-outcome-main-block.js`,
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
`origin/main`. At that checkpoint, before this card's implementation tranches,
the simple fixed-call calibration runners lacked a registered recovery reserve,
while the reserve-bearing invested-rival runners shared a multi-stage dispatch
path that needed coherent response persistence, missing-only recovery, and
ledger-derived workflow status. The completion entry below resolves that
inventory.

2026-09-03 — Migrated `run-invested-rival-learner-replication.js` without
changing its design, routes, inputs, seed, instruments, or 396-attempt ceiling.
Dialogue generation and assessment now reserve immediately before each
dispatch, record dispatch start, durably identify the saved response, and give
every reservation exactly one terminal disposition. Restart reconciliation
reuses valid saved dialogue replies and deterministically parses valid saved
assessment responses before considering any new call. Workflow call counts are
projected from the run ledger. Focused zero-call tests cover all four crash
boundaries and retain the registered 288 generation + 90 assessment + 18
recovery allocation. No model call was made. This was the first maintained-runner
migration; the completion entry below records the remaining dispositions.

2026-09-03 — Completed the card. Extracted the shared durable paid-attempt
budget adapter and migrated the Luna reference, learner iteration, and local
Qwen runners without changing their registered routes, inputs, instruments,
seeds, or ceilings. Each now has per-dispatch durable lifecycle accounting,
ledger-and-hash-gated response reuse, full-plan recovery identity, missing-only
continuation, and attempt/unit/workflow/ETA/scientific-verdict status. Retired
the ten historical launchers and the three fixed-call/no-reserve launchers at
both CLI and exported paid-dispatch boundaries while preserving zero-call
inspection and sealed evidence. Focused crash, recovery, status, compatibility,
inventory, and retirement tests pass; the hermetic manifest and workplan source
checks are synchronized. No model call was made.
