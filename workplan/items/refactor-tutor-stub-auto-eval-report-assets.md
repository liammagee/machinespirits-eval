---
id: refactor-tutor-stub-auto-eval-report-assets
title: Extract tutor-stub auto-eval report assets
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-10
updated: 2026-08-10
branch: codex/refactor-tutor-stub-auto-eval-report-assets
verification: >-
  Emitted tutor-stub report CSS and index-client JavaScript remain byte-identical
  and syntax-valid; 3/3 direct asset assertions, 96/96 focused reporting tests,
  8,366/8,366 hermetic root tests, 137/137 tutor-core tests, all thirteen risk
  groups, lint, formatting, manifest, workplan-source, diff, and zero-cycle
  gates pass without model calls or production artifact writes.
claim_status: planned
depends_on:
  - refactor-dramatic-derivation-tutor-prompt-construction
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
    - docs/next-steps/2026-08-10-codebase-refactoring-post-tutor-prompt-reconciliation.md
  code:
    - scripts/run-tutor-stub-auto-eval.js
    - services/tutorStubAutoEvalReportAssets.js
    - tests/tutorStubAutoEvalReportAssets.test.js
    - tests/tutorStubReportingUx.test.js
    - tests/tutorStubAutoEvalEvidence.test.js
    - config/coverage-risk-floors.json
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
    - refactor-dramatic-derivation-tutor-prompt-construction
tags:
  - refactoring
  - tutor-stub
  - auto-eval
  - reporting
  - presentation
milestone: evaluation-infrastructure
---

Start R6 after merged PR #629. `scripts/run-tutor-stub-auto-eval.js` remains an
11,351-line executable that owns generation, resume, indexing, report models,
filesystem writes, and large embedded presentation assets. The lowest-risk
macro is already a pure boundary: `machineSpiritsReportCss()` occupies 2,151
lines and `tutorStubIndexClientJs()` occupies 944 lines, together 3,095 lines
of byte-generating presentation content.

Acceptance:

- Introduce one dependency-free report-asset owner for the shared CSS and index
  client JavaScript, preserving their returned strings byte-for-byte.
- Keep report/index data modelling, HTML shells, filesystem paths and writes,
  placeholder pages, CLI argument routing, generation, resume, evidence seals,
  and summary persistence in their existing owners.
- Preserve the emitted `assets/tutor-stub-report.css` and
  `assets/tutor-stub-index.js` bytes, filenames, syntax, load order, CSP-facing
  behavior, and public browser interaction contract.
- Reduce `scripts/run-tutor-stub-auto-eval.js` by at least 3,000 lines without
  duplicating either asset in source or changing generated research artifacts.
- Move source-location assertions to the new owner and add direct byte/hash
  characterization alongside the existing temporary-root reporting UX tests.
- Add the new owner to risk coverage and retain the source-only workplan and
  synchronized hermetic-manifest contracts.

Log:

- 2026-08-10 — Triaged from refreshed `main` `db5b5958`. The auto-eval script
  is 11,351 lines with maximum measured complexity 114. Its two static asset
  generators total 3,095 lines. `tests/tutorStubReportingUx.test.js` already
  exercises the `--index` path in an isolated temporary root, inspects both
  emitted assets, and syntax-checks the generated client, providing a strong
  parity boundary before extraction.
- 2026-08-10 — Activated on
  `codex/refactor-tutor-stub-auto-eval-report-assets`, stacked from the exact
  reconciliation commit `14fa509b` opened as PR #630. Implementation remains
  source-only and does not write production report roots.
- 2026-08-10 — Completed the extraction. The dependency-free 3,094-line asset
  owner has maximum complexity 1 and reduces the auto-eval executable from
  11,351 to 8,257 lines. A real pre/post `--index` comparison proves identical
  84,221-byte CSS (`c29c27a7…e6b5bd`) and 82,509-byte client JavaScript
  (`bf91f143…49661`). Three direct asset assertions, 96 focused reporting
  assertions, 8,366 hermetic root tests, 137 tutor-core tests, all thirteen risk
  groups, and every structural gate pass. The first simultaneous shard run
  reproduced unrelated concurrency-sensitive tutor-stub failures; isolated
  reruns passed 4,662/4,662 and 3,704/3,704 with zero skips.
