---
id: refactor-tutor-stub-auto-eval-visualization-renderer
title: Extract tutor-stub auto-eval visualization renderer
status: triaged
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-10
updated: 2026-08-10
verification: >-
  Empty and populated animated-visualization report sections remain
  byte-identical and syntax-valid; saved report HTML, replay behavior,
  accessibility, focused reporting, complete hermetic root/core, risk coverage,
  lint, formatting, manifest, workplan-source, diff, and zero-cycle gates pass
  without model calls or production artifact writes.
claim_status: planned
depends_on:
  - refactor-tutor-stub-auto-eval-report-assets
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
    - docs/next-steps/2026-08-10-codebase-refactoring-post-auto-eval-assets-reconciliation.md
  code:
    - scripts/run-tutor-stub-auto-eval.js
    - services/tutorStubAutoEvalVisualizationReport.js
    - tests/tutorStubAutoEvalVisualizationReport.test.js
    - tests/tutorStubReportingUx.test.js
    - tests/tutorStubAutoEvalEvidence.test.js
    - config/coverage-risk-floors.json
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-auto-eval-report-assets
tags:
  - refactoring
  - tutor-stub
  - auto-eval
  - reporting
  - visualization
  - presentation
milestone: evaluation-infrastructure
---

Continue R6 after merged PR #631. The shared CSS and report-index client now
have a dependency-free asset owner, but `scripts/run-tutor-stub-auto-eval.js`
still embeds the animated turn-replay renderer. `renderAnimatedVizSection()`
spans approximately 1,004 lines, has measured complexity 2, and returns one
HTML fragment containing the replay controls, serialized visualization payload,
canvas readouts, comparison mode, and inline browser runtime.

This is the remaining presentation macro explicitly named by the R6 programme
plan. It is safer than moving the complexity-114 training-example projector in
the same slice: the latter defines persisted analysis/training data and does not
yet have a direct frozen data-shape contract.

Acceptance:

- Introduce one bounded visualization-report owner for the animated replay
  guide, payload projection, HTML fragment, and inline runtime.
- Preserve the returned populated and empty HTML strings byte-for-byte,
  including serialized JSON, escaping, DOM IDs, data attributes, script order,
  control labels, keyboard/text fallback, resize behavior, selection state,
  comparison mode, and accessibility semantics.
- Keep animated frame construction, transcript/training projection, trace
  summarization, report-row aggregation, report/index shells, filesystem paths
  and writes, CLI routing, generation, resume, evidence seals, and summary
  persistence in their existing owners.
- Reduce `scripts/run-tutor-stub-auto-eval.js` by at least 1,000 lines, keep the
  extracted owner below 1,250 lines and maximum complexity below 10, and add no
  import cycle.
- Add direct byte/hash characterization for empty and multi-policy populated
  fixtures; syntax-check the emitted inline runtime and retain the complete
  saved-report/browser UX assertions.
- Add the new owner to risk coverage and the hermetic manifest, preserving the
  source-only workplan contract and avoiding model calls or production report
  writes.

Log:

- 2026-08-10 — Triaged from post-PR-#631 `main` `5e2238a5`. The auto-eval
  executable is 8,257 lines with maximum measured complexity 114. The renderer
  begins at line 3,240, ends immediately before `renderFieldTrajectories()` at
  line 4,244, and has complexity 2. Existing report regeneration exercises the
  saved HTML surface, but the renderer itself is not directly exported or
  byte-characterized; the new child must establish that boundary before moving
  it.
