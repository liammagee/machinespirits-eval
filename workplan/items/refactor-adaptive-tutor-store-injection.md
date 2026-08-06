---
id: refactor-adaptive-tutor-store-injection
title: Inject evaluation-store ownership into the adaptive tutor
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-07
updated: 2026-08-07
branch: codex/refactor-adaptive-tutor-store-injection
verification: >-
  Store-bound adaptive-runner, persistence-adapter, eval-CLI child-process,
  world-spec-finalization, smoke, boundary-inventory, hermetic, lint, and root
  regressions prove explicit dependency identity and lazy compatibility without
  model calls, production writes, or generated workplan views.
claim_status: planned
depends_on:
  - refactor-evaluation-runner-cli-store-injection
links:
  notes:
    - docs/next-steps/2026-08-06-evaluation-store-boundary-inventory.md
  code:
    - services/adaptiveTutor/index.js
    - services/adaptiveTutor/persistence.js
    - scripts/eval-cli/commands/runCommand.js
  items:
    - codebase-refactoring-program
    - refactor-evaluation-runner-cli-store-injection
    - refactor-eval-routes-store-injection
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/533
tags:
  - refactoring
  - evaluation
  - adaptive-tutor
  - sqlite
  - dependency-injection
  - maintainability
milestone: evaluation-infrastructure
---

Continue the R4 host migration behind PR #532. This cohort binds adaptive run
orchestration and persistence to the store already owned by eval-CLI startup,
while preserving lazy named exports for direct scripts and package callers that
migrate in later cohorts.

Acceptance:

- Remove direct legacy-facade imports from adaptive-tutor orchestration and
  persistence without opening a database at import time.
- Add fail-closed `createAdaptiveEvaluationRunner({ evaluationStore })` and
  `createAdaptivePersistence({ evaluationStore })` APIs that bind all adaptive
  run, trace, result, and finalization writes to the supplied store.
- Route adaptive eval-CLI dispatch through the store already injected into its
  command context; keep help and non-adaptive dispatch unchanged.
- Preserve existing named adaptive APIs through the lazy default lifecycle so
  operational scripts remain source-compatible until their own migration.
- Prove a real mock-backed adaptive CLI process creates exactly one run and one
  result in a hermetic database, passes SQLite integrity, and closes naturally.
- Keep dangling world-spec handling, counterfactual persistence, budget halts,
  trace shapes, result fields, and run completion behavior unchanged.
- Ratchet the direct-facade inventory from 26 to 24 live/package consumers and
  from 15 to 14 test consumers; leave eval-route injection for the next cohort.
- Register direct tests in the hermetic manifest and pass focused, full root,
  tutor-core, risk-coverage, source, formatting, and static-cycle gates without
  model calls, production writes, or generated board changes.

Log:

- 2026-08-07 — Activated as a separate stacked worktree from PR #532 reviewed
  head `6ee6e350`. Baseline: adaptive orchestration and persistence import the
  facade namespace directly, while the adaptive eval-CLI dispatch uses a stale
  relative import path and cannot inherit the store owned by CLI startup.
- 2026-08-07 — Implemented fail-closed adaptive runner and persistence factories
  plus CLI binding to its existing store. A mock-backed child-process regression
  now exercises the real adaptive dispatch; the direct facade inventory falls
  to 24 live/package consumers and 14 tests, leaving eval routes as the only
  application-runtime consumer.
- 2026-08-07 — Reached review with 55 focused tests and both adaptive mock
  smokes green. Full root shards pass 4,430 and 3,513 tests with zero failures
  or skips; all 137 tutor-core tests, lint, formatting, source, boundary, and
  zero-cycle gates pass. Evaluation-store risk coverage remains 97.82% lines,
  76.58% branches, and 97.33% functions. One concurrent first-shard run failed
  a timing-sensitive tutor-stub performance case; that file passed 16/16 in
  isolation and the full shard passed on its immediate solo rerun. The first
  risk run's sole failure was sandbox `listen EPERM`; the permitted loopback
  rerun passed 126/126. No model calls, shared production writes, or generated
  board changes occurred.
- 2026-08-07 — Dependency PR #532 merged as `c98419c7`. The staged slice
  rebased cleanly onto that exact merge; Git's temporary autostash was applied
  and removed, and the three unrelated Program-2 stashes remain untouched.
  Post-rebase focused tests pass 55/55, both adaptive mock smokes pass, and the
  workplan, boundary, lint, formatting, and zero-cycle gates remain green.
- 2026-08-07 — PR #533 merged as `39f8c29f`, closing adaptive-tutor store
  injection. The eval-route host-context slice is active from refreshed main on
  `codex/refactor-eval-routes-store-injection`.
