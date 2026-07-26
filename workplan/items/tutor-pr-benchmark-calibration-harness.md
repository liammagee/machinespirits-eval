---
id: tutor-pr-benchmark-calibration-harness
title: Refresh and calibrate the tutor PR benchmark rubric
status: done
type: infra
priority: P1
owner: codex
source: manual
created: 2026-07-26
updated: 2026-07-26
verification: "Passed: node --test tests/tutorPrBenchmarkRubric.test.js tests/tutorPrBenchmarkCalibration.test.js tests/tutorStubPrBenchmark.test.js tests/tutorStubPrBenchmarkComparison.test.js tests/tutorStubPrBenchmarkHook.test.js (25/25); npm run lint; npm run format:check; npm run lint:cycles; npm run test:manifest; npm run wp:source-check; node scripts/eval-cli.js validate-config; npm run tutor:stub:pr-benchmark -- --print-plan --json. No live model or human-calibration run was performed."
branch: codex/tutor-pr-benchmark-calibration-harness
depends_on:
  - tutor-pr-benchmark-delta-harness
links:
  items:
    - consolidated-labelling-game-harness
    - harden-consolidated-labelling-integrity
  notes:
    - docs/tutor-pr-benchmark.md
    - docs/tutor-pr-benchmark-calibration.md
tags:
  - tutor-stub
  - regression
  - calibration
  - human-labelling
milestone: adaptive-tutor-evidence-v1
---

Refresh the previously implicit tutor PR benchmark criteria into a versioned,
anchored turn-level rubric, then provide a documented artifact-driven pathway
for calibrating its deterministic audit mappings against independent human
labels. The preparation, labelling, adjudication handoff, and analysis stages
must be runnable at different times and by different people without calling
Codex, Claude, or any other model.

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
- 2026-07-26: Corrected the scope from calibration plumbing alone to the rubric
  refresh itself. Externalized six criteria into
  `config/tutor-pr-benchmark-rubric.yaml` with construct definitions, anchored
  labels, exclusions, severity, decision policy, and machine mappings. Wired
  the rubric version and hash through benchmark reports and every calibration
  artifact; held-out acceptance now requires a report generated under the same
  rubric.
