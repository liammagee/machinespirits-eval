---
id: optimize-local-node-execution
title: Reduce measured local Node development-loop latency
status: done
type: infra
priority: P2
owner: codex
source: manual
created: 2026-08-08
updated: 2026-08-09
branch: codex/local-node-speedups
verification: >-
  Cold and warm benchmarks, cache-invalidation checks, focused runner tests,
  hermetic manifest accounting, workplan source validation, lint, formatting,
  and diff checks prove faster repeated local gates without reducing file
  coverage, Node 20/22 compatibility, deterministic isolation, or failure
  visibility.
claim_status: planned
depends_on: []
links:
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/586
  items:
    - codebase-refactoring-program
tags:
  - node
  - local-development
  - testing
  - performance
  - ci
milestone: evaluation-infrastructure
---

Use measured local wall time to optimize the development loop in bounded
slices. Prefer cache reuse and retained timing evidence before changing test
concurrency or module architecture.

Acceptance:

- Record reproducible cold and warm baselines for lint, formatting, focused
  tests, full root tests, tutor-core tests, and representative short CLI
  startup.
- Add incremental ESLint and Prettier caches under the already-ignored
  `.test-tmp/` root, and prove that a changed file and configuration change are
  both rechecked correctly.
- Preserve exact hermetic test-file accounting and retain an opt-in ignored
  per-file timing report for later profiling.
- Choose any test split, bounded concurrency, or lazy-import follow-up only
  from the retained measurements; do not weaken the sequential CI-parity gate.
- Keep model-consuming evaluations, production databases, generated workplan
  views, and empirical outputs outside this infrastructure change.

Log:

- 2026-08-08 — Activated from current `origin/main` after a read-only audit.
  The latest retained local report spent 26.2 seconds reinstalling packages,
  30.4 seconds in ESLint plus Prettier, and 117.4 seconds in the sequential
  root-shard plus tutor-core lane. A no-edit warm-cache probe reduced ESLint
  plus Prettier to 3.3 seconds; Node compile caching improved a representative
  short CLI startup by only about 4%, so tool caching is the first slice.
- 2026-08-08 — Added ignored incremental caches to the lint, lint-fix,
  format, and format-check package scripts. Current uncached ESLint plus
  Prettier took 28.65 seconds; cold cached execution took 29.12 seconds and the
  unchanged warm repeat took 3.50 seconds, an 87.8% reduction. A newly changed
  source file still failed both cached gates, and temporary ESLint/Prettier
  configuration changes forced full rechecks and exposed the expected new
  violations. All temporary probe and configuration changes were removed.
- 2026-08-08 — Added opt-in `--report-dir` retention for hermetic TAP and
  per-file timing reports, keeping evaluation stores and logs in the separate
  disposable root. Corrected Node 22 timing rows to use file-summary wall time
  while retaining aggregate test duration and a labeled Node 20 fallback.
- 2026-08-08 — The retained profile found that Vitest path filters also matched
  two nested `.claude/worktrees` copies of tutor-core. The core command now
  excludes that ignored worktree root and executes exactly 11 files / 137 tests
  once. The focused runner suite and corrected core suite pass.
- 2026-08-08 — Current unrestricted root profiling passed shard 1 at 310 files
  / 4,534 tests in 47.16 seconds and shard 2 at 327 files / 3,602 tests in 46.45
  seconds, both with zero failures and skips. The same 637 files / 8,136 tests
  passed unsharded in about 72.6 seconds, roughly 22% faster than the 93.6-second
  sequential parity path. Retained evidence therefore supports `npm test` for
  the comprehensive fast local code gate while preserving sequential shards
  for CI parity; no concurrency, file split, lazy-import, or runtime-version
  change is justified in this slice.
- 2026-08-08 — Review checks pass: 45/45 focused runner/local-CI tests, exact
  hermetic manifest synchronization, all 465 workplan sources, cached ESLint,
  cached Prettier, and `git diff --check`. No production evaluation data,
  generated board views, or model-backed workflows were touched.
- 2026-08-08 — After safely fast-forwarding three non-overlapping upstream
  commits, the comprehensive optimized local gate passed 637 root files / 8,143
  tests and 11 tutor-core files / 137 tests, with zero failures or skips.
- 2026-08-09 — PR #586 merged as `bba5e70c`. The declared performance,
  invalidation, file-accounting, compatibility, isolation, and failure-visibility
  checks were green, so this bounded local-execution optimization is done.
