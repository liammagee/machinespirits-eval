---
id: refactor-evaluation-runner-cli-store-injection
title: Inject evaluation-store ownership into the runner and eval CLI
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-07
updated: 2026-08-07
branch: codex/refactor-evaluation-runner-cli-store-injection
verification: >-
  Store-bound runner, scoring-adapter, help, CLI-process, resume/rejudge,
  report, boundary-inventory, hermetic, lint, and root-suite regressions prove
  explicit dependency identity, lazy compatibility, and deterministic close
  behavior without production writes or generated workplan views.
claim_status: planned
depends_on:
  - refactor-evaluation-store-application-lifecycle
links:
  notes:
    - docs/next-steps/2026-08-06-evaluation-store-boundary-inventory.md
  code:
    - services/evaluationRunner.js
    - scripts/eval-cli.js
    - scripts/eval-cli/scoringCommandDependencies.js
  items:
    - codebase-refactoring-program
    - refactor-evaluation-store-application-lifecycle
    - refactor-adaptive-tutor-store-injection
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/532
tags:
  - refactoring
  - evaluation
  - sqlite
  - dependency-injection
  - cli
  - maintainability
milestone: evaluation-infrastructure
---

Continue the R4 host migration after the explicit lifecycle slice in PR #530.
This cohort binds the standard evaluation runner and every eval-CLI command
family to one host-owned store while preserving the named runner API as a lazy
compatibility boundary for routes, tests, and package consumers that migrate
later.

Acceptance:

- Remove direct legacy-facade imports from `evaluationRunner`, `eval-cli`, and
  the CLI scoring dependency adapter without opening a database at import time.
- Add a fail-closed `createEvaluationRunner({ evaluationStore })` API that
  binds run, resume, rejudge, report, quick-test, and multi-turn persistence to
  the supplied store.
- Assemble and cache the completion, turn-execution, resume, and rejudge
  runtime family per supplied store rather than capturing one module-global
  persistence namespace.
- Keep existing named/default runner calls source-compatible through the lazy
  default lifecycle; no compatibility call may start the store until a
  persistence operation actually begins.
- Make eval CLI startup create one explicit store, inject the same object into
  the runner and scoring commands, and close it after normal completion or a
  legacy direct `process.exit()` path; `--help` must remain persistence-free.
- Ratchet the direct-facade inventory from 29 to 26 live/package consumers and
  register the new dependency contract in the hermetic root manifest.
- Preserve runner result shapes, CLI command output, bilateral scoring writes,
  rejudgment provenance, package imports, and natural test teardown without
  model calls, production-data writes, or generated board changes.

Log:

- 2026-08-07 — Activated as a separate stacked worktree from PR #530 reviewed
  head `a044468f`. Baseline: runner runtime owners capture the facade namespace
  at module load; eval CLI imports it directly and the scoring adapter imports
  it a second time; CLI connection disposal is left to process teardown.
- 2026-08-07 — Reached review with a fail-closed store-bound runner factory,
  per-store lazy runtime assembly, an injected scoring adapter, and one
  explicitly owned CLI store closed on normal and direct-exit paths. The
  facade inventory fell from 29 to 26 live/package consumers; help remains
  database-free and compatibility exports still start the default store only
  on their first persistence operation.
- 2026-08-07 — The runner/resume/rejudge/report, complete CLI smoke, scoring
  symmetry, dependency identity, boundary, and close contracts pass. Both full
  root shards, all 137 tutor-core tests, lint, formatting, zero-cycle, workplan,
  and risk-coverage gates pass; evaluation-store coverage remains 97.82% lines,
  76.58% branches, and 97.33% functions. The first risk run's sole failure was
  sandbox `listen EPERM`; the authorized loopback rerun passed 126/126. No
  model calls, shared production writes, or generated board changes occurred.
- 2026-08-07 — Dependency PR #530 merged as `9699a5f7`; refreshed main then
  advanced through independent PR #531 to `78e57192`. The staged source slice
  rebased cleanly onto that current main with its temporary autostash applied
  and removed; it remains one publication commit.
- 2026-08-07 — Published as PR #532 at reviewed head `6ee6e350`; adaptive-tutor
  runner and persistence injection is active on the dependent
  `codex/refactor-adaptive-tutor-store-injection` branch.
- 2026-08-07 — PR #532 merged as `c98419c7`, closing standard-runner and
  eval-CLI store injection. The dependent adaptive-tutor slice rebased onto
  that merge without conflict.
