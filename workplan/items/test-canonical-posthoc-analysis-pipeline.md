---
id: test-canonical-posthoc-analysis-pipeline
title: Add fixture-to-report tests for the canonical post-hoc analysis pipeline
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-22
updated: 2026-07-24
verification: Frozen miniature evaluation fixtures exercise every canonical
  post-hoc script end to end, with schema/version checks and reviewed golden
  statistics preventing silent empirical-report regressions.
claim_status: planned
depends_on: []
links:
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/175
  notes:
    - docs/analysis-toolkit-guide.md
  code:
    - scripts/analyze-eval-results.js
    - scripts/analyze-mechanism-traces.js
    - scripts/analyze-trajectory-curves.js
    - scripts/analyze-learning-stagnation.js
    - scripts/analyze-judge-reliability.js
    - scripts/run-canonical-posthoc-pipeline.js
    - services/canonicalPosthocContract.js
    - tests/canonicalPosthocPipeline.test.js
tags:
  - analysis
  - empirical-integrity
  - testing
  - paper-2
milestone: paper-2-evidence-cleanup
branch: codex/test-canonical-posthoc-analysis-pipeline
---

Coverage sampling found the canonical research-analysis scripts at roughly
7–36% loaded line coverage. These scripts feed empirical reports, but most
tests exercise helpers or happy-path fragments rather than a complete frozen
input-to-output contract.

Acceptance:

- Build a small versioned fixture DB plus dialogue logs covering missing data,
  repeated judges, multi-turn trajectories, and legacy/current cell names.
- Run each canonical post-hoc command against isolated paths and compare
  machine-readable outputs to reviewed golden results.
- Assert rubric, judge, provenance, and trace-version boundaries explicitly;
  fail instead of silently combining incompatible rows.
- Add the fixture pipeline to CI without network or paid model calls.

Log:

- 2026-07-24 — Opened PR #175 with the workplan linkage and post-rebase contract, analysis smoke, lint, formatting, and board validation evidence.
- 2026-07-24 — Added the strict `canonical-posthoc-v1` runner, explicit DB/log/judge seams for all five commands, machine-readable reliability output, and a frozen fixture spanning missing data, repeated judges, three-turn trajectories, and legacy/current cell names.
- 2026-07-24 — Golden replay passed 5/5 pipeline tests; mixed rubric, unpaired judge, provenance drift, and mixed trace-version mutations all failed closed. Analysis smoke tests passed 14/14; full hermetic suite passed 6,507 with 1 skip; lint and format checks passed.
