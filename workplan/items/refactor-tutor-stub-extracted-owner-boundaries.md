---
id: refactor-tutor-stub-extracted-owner-boundaries
title: Split oversized tutor-stub pipeline and response-policy owners
status: triaged
type: maintenance
priority: P1
owner: unassigned
source: review
created: 2026-08-05
updated: 2026-08-05
verification: The tutor-turn pipeline and response-policy modules are decomposed into cohesive tested owners without changing their public facades; focused parity, zero-skip hermetic, lint, source, and zero-cycle gates pass; no replacement owner exceeds the agreed boundary ceiling.
claim_status: planned
depends_on: []
links:
  code:
    - services/tutorStubTutorTurnPipeline.js
    - services/tutorStubResponsePolicy.js
    - scripts/tutor-stub.js
  items:
    - refactor-tutor-stub-macro-decomposition
    - codebase-refactoring-program
tags:
  - refactoring
  - tutor-stub
  - boundaries
  - maintainability
milestone: evaluation-infrastructure
---

The entrypoint has reached its near-2,000 functional-body destination. The
remaining structural risk is concentrated in two extracted owners rather than
in `scripts/tutor-stub.js`: the 2,581-line tutor-turn pipeline and 1,975-line
response-policy module.

Acceptance:

- Preserve `createTutorStubTutorTurnPipeline()` and
  `createTutorStubResponsePolicy()` as compatibility facades while assigning
  prompt assembly, draft audit, repair/committee execution, policy
  selection/sampling, and response-configuration composition to explicit
  owners.
- Set a concrete owner-size ceiling before implementation and stop if the
  extraction merely relocates either monolith.
- Preserve byte/contract behavior, Program-2 budget reservations, trace shape,
  guard dispositions, seeded policy sampling, and current public exports.
- Run the focused ownership and behavioral suites, complete zero-skip hermetic
  suite, lint/format/source checks, and static import-cycle gate.

Log:

- 2026-08-05 — Created during board reconciliation after PR #484 merged. This
  is the next bounded refactoring slice; it is not yet active and has no branch
  or worktree.
