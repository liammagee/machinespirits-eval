---
id: refactor-dramatic-derivation-run-state
title: Extract the dramatic-derivation run-state and lifecycle boundary
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-09
updated: 2026-08-09
branch: codex/refactor-dramatic-derivation-run-state
verification: >-
  360/360 direct runDrama assertions, 8,281/8,281 hermetic root tests, 137/137
  tutor-core tests, and all seven risk groups pass. The new owners reach
  79.12% line/64.48% branch/78.33% function coverage with maximum function
  complexity 12; source, formatting, lint, manifest, and zero-cycle gates pass.
claim_status: planned
depends_on:
  - refactor-rubric-transcript-projection-runtime
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
    - docs/next-steps/2026-08-09-codebase-refactoring-post-run-coordinator-reconciliation.md
  code:
    - services/dramaticDerivation/engine.js
    - services/dramaticDerivation/runState.js
    - services/dramaticDerivation/runLifecycle.js
    - services/dramaticDerivation/runResult.js
    - tests/dramaticDerivationRunStateBoundary.test.js
    - config/coverage-risk-floors.json
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
tags:
  - refactoring
  - dramatic-derivation
  - runtime-state
  - lifecycle
milestone: evaluation-infrastructure
---

Begin R5 from post-PR-#618 main. The 2,885-line dramatic-derivation engine
still concentrates run configuration, mutable board and ledger state, role
views, the turn loop, optional instrumentation, and final result projection in
one complexity-544 `runDrama()` function.

Acceptance:

- Introduce one explicit run-state contract for normalized feature flags,
  mutable formal state, instrumentation rows, and control state.
- Extract run-state creation and final result projection behind bounded owners
  while preserving the public `runDrama({ world, roles, options })` entrypoint.
- Preserve deterministic result shape and field absence when optional features
  are disabled, including transcript, events, trajectory, ledgers, replay,
  corruption, acts, scenes, lemma, register, field, and learner-DAG surfaces.
- Keep role prompts, release authority, learner concealment, forcing, verdicts,
  schemas, defaults, and provider behavior unchanged.
- Add direct state/result boundary characterization before moving behavior;
  retain the canonical derivation and replay suites as end-to-end parity gates.
- Introduce no static cycle, provider call, production-data write, empirical
  claim, or generated workplan-view change.

Out of scope:

- Splitting `llmRoles`, changing director/tutor/learner policies, or changing
  any dramatic-derivation option.
- New experiments, prompts, scoring, persistence, report formats, or public
  browser behavior.

Log:

- 2026-08-09 — Activated from post-PR-#618 main `5527016a`. Fresh complexity
  measurement records `runDrama()` at 544 in a 2,885-line engine. Nineteen
  test files directly exercise `runDrama`; the canonical deterministic
  derivation gate passes 71/71 before editing.
- 2026-08-09 — Completed the explicit outer runtime boundary. Normalization
  and mutable formal state now belong to `runState.js`; turn limits, prologue,
  and final scene/block/act/audit sealing belong to `runLifecycle.js`; verdict
  precedence and optional result projection belong to `runResult.js`. The
  engine fell from 2,885 to 2,425 lines and `runDrama()` complexity from 544 to
  454 while preserving every direct contract across 360 assertions. The new
  owners are 388, 112, and 252 lines, with maximum complexity 12, 6, and 12.
  Complete hermetic, risk-coverage, formatting, lint, manifest, source, and
  zero-cycle gates pass without provider calls or production-data writes.
