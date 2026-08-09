---
id: refactor-evaluation-run-coordinator-runtime
title: Extract the evaluation run coordinator runtime
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-09
updated: 2026-08-09
branch: codex/refactor-evaluation-run-coordinator-runtime
verification: >-
  Four direct coordinator tests at 97.19% lines, 80.49% branches, and 95.45%
  functions plus 83 focused runner assertions, API/admission/checkpoint/store
  coverage, both hermetic root shards, 137 tutor-core tests, all six risk
  groups, source, formatting, lint, manifest, and zero-cycle gates preserve the
  complete run contract without provider calls or production-data writes.
claim_status: planned
depends_on:
  - refactor-eval-routes-read-side-domains
links:
  notes:
    - docs/next-steps/2026-08-09-codebase-refactoring-post-read-routes-reconciliation.md
    - docs/next-steps/2026-08-09-codebase-refactoring-reconciliation.md
  code:
    - services/evaluationRunner.js
    - services/evaluationRunRuntime.js
    - tests/evaluationRunRuntime.test.js
    - config/coverage-risk-floors.json
    - tests/evaluationRunner.test.js
    - tests/evaluationRunnerDependencyInjection.test.js
  items:
    - codebase-refactoring-program
    - refactor-evaluation-turn-execution
    - refactor-evaluation-resume-rejudge-runtime
    - refactor-evaluation-runner-cli-store-injection
tags:
  - refactoring
  - evaluation
  - orchestration
  - dependency-injection
  - maintainability
milestone: evaluation-infrastructure
---

Continue R4 from the post-PR-#612 reconciliation. The public evaluation-runner
facade is 2,261 lines; `runEvaluation()` occupies 572 lines at complexity 93
despite turn execution, multi-turn execution, resume, and rejudge already
having bounded owners.

Acceptance:

- Move complete-run orchestration behind an explicitly injected runtime while
  preserving the named export and store-bound `createEvaluationRunner()` API.
- Split planning, run setup, scenario-first execution, success/error
  accounting, and finalization into bounded helpers rather than relocating one
  unchanged high-complexity function.
- Preserve option validation, scenario/config/profile resolution, every model
  override, weak-stack warning, content setup, run metadata and admission
  snapshot, test ordering, parallelism, request delay, live reporter lifecycle,
  result storage, transient/permanent error policy, progress and monitoring
  events, run completion, statistics, and return shape.
- Add direct deterministic characterization for success, transient failure,
  permanent failure, scenario completion, metadata, and cleanup/finalization.
- Reduce `services/evaluationRunner.js` below 1,800 physical lines; keep the
  new production owner below 900 lines and its maximum function complexity
  below 40; introduce no static import cycle.
- Run focused runner/dependency/CLI/API/admission/progress/lifecycle/persistence
  coverage plus complete hermetic, tutor-core, risk-coverage, source,
  formatting, lint, manifest, and cycle gates without provider calls or
  production-data writes.

Out of scope:

- Tutor or learner generation, multi-turn, scoring, retry, rubric, schema,
  route, CLI syntax, resume, or rejudge behavior changes.
- Dramatic derivation, transcript-browser, auto-eval, or rubric decomposition.
- Generated workplan views.

Log:

- 2026-08-09 — Activated from merged PR-#612 main `e5ea93df`. Fresh metrics
  confirm all 120 prior refactoring children are done and retain the runner as
  the safest characterized macro hotspot: 2,261 facade lines, a 572-line
  `runEvaluation()`, and complexity 93. The larger dramatic and rubric
  hotspots remain gated on stronger characterization.
- 2026-08-09 — Completed the macro extraction. The public facade retains its
  named and store-bound APIs while falling from 2,261 to 1,744 lines. The
  injected 534-line owner separates planning, setup, scenario-first execution,
  success/error accounting, and finalization; its maximum complexity is 17
  rather than the original coordinator's 93. Four direct tests ratchet
  metadata, overrides, order, transient resumability, permanent failures,
  progress, monitoring, live reporting, persistence, and completion at 97.19%
  lines, 80.49% branches, and 95.45% functions. Eighty-three focused runner
  assertions, API/admission/checkpoint/store suites, both hermetic root shards,
  137 tutor-core tests, all six risk groups, source, formatting, lint,
  synchronized manifest, and zero-cycle gates pass without provider calls,
  production-data writes, or generated workplan-view changes.
