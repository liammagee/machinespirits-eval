---
id: durable-evaluation-runner-migration
title: Migrate paid runners to the durable execution contract
status: triaged
type: infra
priority: P1
owner: codex
source: review
created: 2026-09-02
updated: 2026-09-02
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
