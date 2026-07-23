---
id: test-canonical-posthoc-analysis-pipeline
title: Add fixture-to-report tests for the canonical post-hoc analysis pipeline
status: triaged
type: maintenance
priority: P1
owner: unassigned
source: review
created: 2026-07-22
updated: 2026-07-22
verification: Frozen miniature evaluation fixtures exercise every canonical
  post-hoc script end to end, with schema/version checks and reviewed golden
  statistics preventing silent empirical-report regressions.
claim_status: planned
depends_on: []
links:
  notes:
    - docs/analysis-toolkit-guide.md
  code:
    - scripts/analyze-eval-results.js
    - scripts/analyze-mechanism-traces.js
    - scripts/analyze-trajectory-curves.js
    - scripts/analyze-learning-stagnation.js
    - scripts/analyze-judge-reliability.js
tags:
  - analysis
  - empirical-integrity
  - testing
  - paper-2
milestone: paper-2-evidence-cleanup
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
