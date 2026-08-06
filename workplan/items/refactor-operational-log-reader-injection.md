---
id: refactor-operational-log-reader-injection
title: Inject dialogue-log repositories into operational scripts
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-07
updated: 2026-08-07
branch: codex/refactor-readonly-script-store-injection
verification: >-
  Passive context, cross-root isolation, operational CLI, boundary-inventory,
  hermetic, risk-coverage, lint, formatting, and root regressions prove six
  scripts no longer depend on the legacy facade without model calls, shared
  production writes, or generated workplan views.
claim_status: planned
depends_on:
  - refactor-eval-routes-store-injection
links:
  notes:
    - docs/next-steps/2026-08-06-evaluation-store-boundary-inventory.md
  code:
    - services/evaluationStore/scriptContext.js
    - scripts/analyze-insight-action-gap.js
    - scripts/assess-transcripts.js
    - scripts/audit-message-chain.js
    - scripts/code-dialectical-modulation.js
    - scripts/generate-paper-figures.js
    - scripts/render-sequence-diagram.js
  items:
    - codebase-refactoring-program
    - refactor-eval-routes-store-injection
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/542
tags:
  - refactoring
  - evaluation
  - operational-scripts
  - dialogue-logs
  - dependency-injection
  - maintainability
milestone: evaluation-infrastructure
---

Begin the operational-script host migration after PR #539. These six scripts
already own their SQLite queries and use the facade only for read-side dialogue
logs, making them one coherent low-risk cohort before result projections,
scoring mutations, and run orchestration move.

Acceptance:

- Add one side-effect-free script context that resolves the established
  `EVAL_DB_PATH` and dialogue-log precedence without opening SQLite or creating
  filesystem state.
- Give each migrated script its own isolated dialogue-log repository rather
  than the process-global compatibility facade.
- Preserve each script's existing database access mode, query and update
  behavior, CLI output, rendering, model admission, and explicit SQLite close.
- Prove separate roots with the same dialogue ID cannot leak logs across
  contexts and context construction remains import-side-effect free.
- Ratchet direct facade consumers from 23 to 17 live/package and operational
  scripts from 22 to 16; leave longitudinal projections, scoring/write tools,
  smoke runners, prompt-lab, and package compatibility to later cohorts.
- Pass focused operational CLI, complete root, tutor-core, risk-coverage,
  source, formatting, boundary, and static-cycle gates without model calls,
  shared production writes, or generated board changes.

Log:

- 2026-08-07 — Activated from refreshed main `315cc7ff` after PR #539 merged.
  Baseline: six scripts import the facade only for `loadDialogueLog()` while
  separately owning their SQLite connection; the inventory contains 23
  live/package consumers, including 22 operational scripts.
- 2026-08-07 — Added a passive script context and migrated all six consumers.
  Separate-root fixtures prove log isolation, and five deterministic empty-data
  CLI paths plus the message-chain CLI exercise real DB/log selection without
  any model request. The facade inventory falls to 17 live/package consumers,
  including 16 operational scripts.
- 2026-08-07 — Reached review with 57 focused tests green. Full root shards pass
  4,452 and 3,534 tests with zero failures or skips on their final runs; all 137
  tutor-core tests pass. Evaluation-store risk coverage passes at 97.83% lines,
  76.54% branches, and 97.34% functions, alongside source, formatting, lint,
  boundary, and zero-cycle gates. One initial shard-2 run reported a single
  transient failure while both shards ran concurrently; the immediate solo
  rerun passed 3,534/3,534. No model calls, shared production writes, or
  generated workplan views occurred.
- 2026-08-07 — Rebased cleanly onto current main `d437f7fb`, revalidated all 57
  focused tests and static gates, and opened PR #542 at `cffa5249`.
