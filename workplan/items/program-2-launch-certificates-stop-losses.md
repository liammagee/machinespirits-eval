---
id: program-2-launch-certificates-stop-losses
title: Require feasibility certificates and stop-losses for Program 2 launches
status: review
type: infra
priority: P1
owner: codex
source: review
created: 2026-07-26
updated: 2026-07-26
verification: "Paid Program 2 live-pilot launches fail before provider preflight without a SHA/plan/evidence-bound zero-model certificate; cohort certificates require profile-complete audited pilot evidence; per-attempt provider budgets fail closed; live checks stop only when frozen completion gates become unreachable."
branch: codex/program2-launch-safety
links:
  code:
    - services/program2ExperimentSafety.js
    - scripts/certify-program2-launch.mjs
    - scripts/run-program2-live-pilot.js
    - scripts/tutor-stub.js
    - tests/program2ExperimentSafety.test.js
  notes:
    - notes/program-2/2026-07-26-launch-safety-contract.md
tags:
  - tutor-stub
  - program-2
  - provenance
  - budget
  - stop-loss
milestone: adaptive-tutor-evidence-v1
---

The floor-ablation and weights × interface sequence proved that clean-SHA
launch gates and transport retries do not establish design feasibility. Add a
zero-model certificate that binds the source, plan, world, gate specification,
pilot evidence, and provenance before paid work begins. Enforce its retry,
provider-call, and reserved-output-token ceilings in the child runtime, and
re-evaluate irreversible completion gates throughout the cohort without using
the treatment effect as an early-stopping signal.

Mainline scope is deliberately reusable and source-only. The unmerged
weights × interface experiment lineage, frozen traces, recovery roots, and
generated workplan views are excluded from this branch.
