---
id: refactor-poetics-browser-derivation-presentation
title: Extract poetics-browser derivation presentation owner
status: triaged
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-10
updated: 2026-08-10
verification: >-
  Empty and populated derivation index, live-index, live-run, and completed-run
  HTML remain byte-identical; direct renderer, route, desktop-parity, auth,
  complete hermetic root/core, risk coverage, lint, formatting, manifest,
  workplan-source, diff, and zero-cycle gates pass without model calls or
  production artifact writes.
claim_status: planned
depends_on:
  - refactor-tutor-stub-auto-eval-visualization-renderer
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
    - docs/next-steps/2026-08-10-codebase-refactoring-final-r6-reconciliation.md
  code:
    - scripts/browse-poetics-scripts.js
    - tests/poeticsReportBrowser.test.js
    - tests/desktopRouteParity.test.js
    - tests/poeticsAdminAuth.test.js
    - config/coverage-risk-floors.json
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-auto-eval-visualization-renderer
tags:
  - refactoring
  - poetics
  - browser
  - derivation
  - reporting
  - presentation
milestone: evaluation-infrastructure
---

Continue R6 after the auto-eval presentation arm closed through PR #633.
`scripts/browse-poetics-scripts.js` remains a 13,292-line application containing
52 public application routes, 29 admin-router routes, thirteen mounts, twenty
top-level HTML renderers, database and filesystem readers, metered mutations,
and embedded browser presentation. Its complexity-66
`renderDerivationRunHtml()` sits inside an approximately 1,950-line derivation
presentation family with index, live-run, comparison, proof-DAG, learner-DAG,
logic, arc, and controlled-vocabulary views.

This child is deliberately narrower than a complete domain-router rewrite. It
establishes the missing byte-characterized presentation boundary first, while
the application factory, route manifest, auth perimeter, persistence, live
polling, job control, workplan writes, and metered operations remain in place.

Acceptance:

- Characterize empty and populated derivation index, live-index, live-run, and
  completed-run HTML before movement, including inline scripts, DOM IDs, links,
  TTS hooks, proof/learner DAGs, controlled vocabulary, and accessibility text.
- Introduce one dependency-light derivation presentation owner; shared shell,
  TTS, and proof renderers may be passed explicitly or imported from leaf
  modules, but must not create a reverse dependency on the executable.
- Keep derivation run discovery and filesystem reads, SSE timers, Express route
  registration, auth and role gates, database ownership, app startup/shutdown,
  compose/job/workplan mutations, and every model-call path in their current
  owners.
- Preserve route fingerprints and exact response status, content type, body,
  redirects, auth behavior, mount prefixes, live refresh semantics, and public
  versus admin boundaries.
- Reduce `scripts/browse-poetics-scripts.js` by at least 1,750 lines, keep the
  extracted owner below 2,300 lines, reduce its maximum complexity below 40,
  and add no import cycle.
- Add the owner to direct risk coverage and the hermetic manifest; run focused
  browser/desktop/auth tests plus the complete structural and hermetic gates
  without launching the browser, calling a model, or writing production data.

Log:

- 2026-08-10 — Triaged from final R6 reconciliation base `50cfbfee`. The
  browser executable is 13,292 lines; `renderDerivationRunHtml()` is its
  complexity leader at 66. Existing report-browser, route-parity, and auth
  suites cover important behavior but do not freeze the complete derivation
  HTML family byte-for-byte, so baseline characterization is the first step.
