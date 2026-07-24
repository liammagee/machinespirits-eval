---
id: refactor-field-policy-helpers
title: Consolidate tutor-stub field-policy helpers
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-25
updated: 2026-07-25
verification: >-
  A neutral DAG-feature leaf owns DAG normalization; tutorStubFieldTrajectory
  and tutorStubRegisterPolicy re-export the canonical helper bindings; identity
  and frozen-fixture parity tests pass; focused and full hermetic suites remain
  green with zero static cycles.
branch: codex/refactor-field-policy-helpers
depends_on:
  - refactor-adaptive-trace-projection
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  items:
    - codebase-refactoring-program
    - tutor-stub-register-policy-extraction
tags:
  - refactoring
  - tutor-stub
  - register-policy
  - field-trajectory
  - duplication
milestone: evaluation-infrastructure
---

Bounded R1.3 duplicate-removal slice: give the generic learner-DAG projection a
neutral leaf, make the remaining pure field-state projections in
`services/tutorStubFieldTrajectory.js` authoritative, and remove their exact
copies from `services/tutorStubRegisterPolicy.js`. Preserve both established
modules as compatibility facades.

Out of scope:

- Register weights, thresholds, state vectors, sampling, temperature, or policy
  selection behavior.
- The acceleration-aware trajectory-point/window variants in the register
  policy, which intentionally differ from the offline field-trajectory
  projection.
- Trace, persistence, schema, CLI, learner-DAG, or tutor-output changes.

Acceptance:

- A neutral import-free service owns DAG feature projection; one production
  binding owns each remaining learner surface field, prior-turn field, field
  progress, field/DAG relation, and learner-DAG delta projection.
- `tutorStubFieldTrajectory.js` and `tutorStubRegisterPolicy.js` keep their
  current exports by re-exporting canonical bindings; consumers require no
  import migration.
- Binding-identity and deep-equality fixtures prove the compatibility facade
  preserves historical field and register-policy shapes.
- Focused policy/trajectory tests, the full hermetic suite, lint, formatting,
  workplan, cycle, and diff gates pass without model or API calls.

Log:

- 2026-07-25 — Activated from merged `main` at `6f8770df` after PR #202. The
  dependency direction is one-way because `tutorStubFieldTrajectory.js` is a
  pure import-free module. Divergent acceleration and empty-value semantics
  were identified and explicitly excluded from consolidation.
- 2026-07-25 — Removed eight exact field-state helper declarations from the
  register policy while retaining its existing exports as identical imported
  bindings. Two compatibility tests pin binding identity and deep-equal core
  projection shape; the existing register-policy golden corpus remains green.
- 2026-07-25 — Review gate passed without model or API calls: 30/30 focused
  assertions, all 459 root test files and all 11 tutor-core test files through
  the hermetic runner, lint, formatting, zero static cycles across 346 service
  files, the 177-item workplan source check, and diff checks are green after
  rebasing onto `main` at `c58395c4`.
- 2026-07-25 — Follow-up review moved the generic `dagProgressFeatures`
  projection into the neutral import-free `tutorStubDagFeatures.js` leaf. Both
  established modules retain identical compatibility exports, now pinned to
  the neutral binding by the facade-identity test.
