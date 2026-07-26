---
id: tutor-pr-benchmark-calibration-harness
title: Add a resumable human calibration pathway for tutor PR benchmarks
status: done
type: infra
priority: P1
owner: codex
source: manual
created: 2026-07-26
updated: 2026-07-26
verification: "Passed: node --test tests/tutorPrBenchmarkCalibration.test.js tests/tutorStubPrBenchmark.test.js tests/tutorStubPrBenchmarkComparison.test.js tests/tutorStubPrBenchmarkHook.test.js (22/22); npm run lint; npm run format:check; npm run lint:cycles; npm run test:manifest; npm run wp:source-check. The full npm test run also exercised the new tests successfully, but the repository-wide run remained red on unrelated environment/dependency failures, including missing rdf-validate-shacl and sandbox-denied localhost voice/web listeners."
branch: codex/tutor-pr-benchmark-calibration-harness
depends_on:
  - tutor-pr-benchmark-delta-harness
links:
  items:
    - consolidated-labelling-game-harness
    - harden-consolidated-labelling-integrity
  notes:
    - docs/tutor-pr-benchmark.md
tags:
  - tutor-stub
  - regression
  - calibration
  - human-labelling
milestone: adaptive-tutor-evidence-v1
---

Create a documented, artifact-driven pathway for calibrating deterministic
tutor PR benchmark audits against independent human labels. The preparation,
labelling, adjudication handoff, and analysis stages must be runnable at
different times and by different people without calling Codex, Claude, or any
other model.

Keep candidate packets and coder artifacts local/private by default. Blind
raters to model identity and machine verdicts, preserve a separate hashed
machine key, and require a fresh acceptance packet rather than treating a
development packet used to revise guards as held-out evidence.

## Progress

- 2026-07-26: Started as a stacked follow-up to PR #261. Reused the existing
  labelling integrity boundaries (separate coder files, immutable corpus/item
  provenance, resumable progress) while keeping this first slice independent
  of the browser dataset registry.
- 2026-07-26: Added the artifact-only `prepare`, `label`, `status`,
  `adjudicate`, and `analyze` workflow; hash-linked blinded packets, machine
  keys, config and human evidence; clean-commit acceptance admission; stale
  adjudication invalidation; report-only metrics; synthetic end-to-end tests;
  and the development-to-held-out-acceptance operator guide.
