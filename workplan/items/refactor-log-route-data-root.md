---
id: refactor-log-route-data-root
title: Bind evaluation log routes to the redirected data root
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-25
updated: 2026-07-25
verification: >-
  Data-bearing HTTP fixtures place one exact dialogue and API log in
  EVAL_LOGS_DIR plus a decoy in the old tutor-core root; date, collection,
  id, index, and statistics routes return only the hermetic fixture, while
  focused route/core, desktop, manifest, and complete hermetic gates pass.
branch: codex/refactor-log-route-data-root
depends_on:
  - refactor-dialogue-log-fixtures
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - tutor-core/services/dialogueLogDirectories.js
    - tutor-core/services/dialogueLogService.js
    - tutor-core/services/tutorDialogueEngine.js
    - scripts/run-rich-memory-arc-experiment.js
    - tests/evalLogRoutesDataRoot.test.js
  items:
    - codebase-refactoring-program
    - refactor-dialogue-log-fixtures
tags:
  - refactoring
  - testing
  - routes
  - dialogue-logs
  - hermetic
milestone: evaluation-infrastructure
---

Bounded row 17 slice: make the evaluation HTTP log routes read the same
redirected root used by evaluator dialogue writes, then replace shape-only
confidence with exact, data-bearing route assertions.

Out of scope:

- Changing dialogue file, API-log, trace, database, or HTTP response schemas.
- Splitting the broader evaluation router or altering route/auth/mount order.
- Rewriting dialogue formatting, grouping, pagination, or interaction-eval
  projection policy.
- Reading or modifying private evaluation logs, databases, or paper evidence.

Acceptance:

- Tutor-core dialogue writers and readers share one mutable log-root state,
  while the public `setLogDir()` facade remains compatible.
- Evaluation-runner redirection moves both writer and reader views to
  `EVAL_LOGS_DIR`; an explicitly different `TUTOR_CORE_LOG_DIR` cannot leak
  decoy data through evaluation routes.
- Synthetic HTTP coverage proves exact dates, dialogue collection content,
  lookup by id, lookup by index, and statistics from the hermetic root.
- Focused route/core tests, desktop parity, the root manifest, full hermetic
  parity, lint, formatting, cycles, source-only workplan, and diff gates pass
  without model calls.

## Log

- 2026-07-25 — Activated from `origin/main` at `e548b23a` after PR #232 merged
  row 16 with all checks green. Baseline inspection confirmed that
  `evaluationRunner` redirects tutor-core writes through `setLogDir()`, while
  `dialogueLogService` still captured four hard-coded directories at module
  import and the two reachable route tests asserted only successful shapes.
- 2026-07-25 — Moved the mutable tutor-core log root into one 24-line leaf;
  `setLogDir()` now redirects both the existing writer variables and every
  reader lookup. The HTTP fixture places one exact log/dialogue in
  `EVAL_LOGS_DIR` and a different-date decoy under `TUTOR_CORE_LOG_DIR`; all
  five route surfaces return only the intended data.
- 2026-07-25 — Final parity is green: the route fixture passes 4/4 with natural
  teardown, existing API routes 22/22, root CI shards 2,457/2,457 and
  4,338/4,338, tutor-core 137/137, and desktop parity 29/29 under the matched
  Electron native runtime. Lint, formatting, manifest, zero-cycle, workplan,
  and diff gates pass with zero test skips and no model calls.
