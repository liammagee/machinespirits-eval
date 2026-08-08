---
id: refactor-longitudinal-report-store-ownership
title: Give longitudinal live reports explicit evaluation-store ownership
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-08
updated: 2026-08-08
branch: codex/refactor-longitudinal-store-ownership
verification: >-
  Lifecycle unit tests, missing-database CLI checks, boundary inventory,
  longitudinal checker regressions, hermetic root and tutor-core suites,
  risk coverage, source, lint, formatting, and cycle gates prove A2-A5 close
  owned stores without changing their scoring or report contracts.
claim_status: planned
depends_on:
  - refactor-operational-log-reader-injection
links:
  notes:
    - docs/next-steps/2026-08-06-evaluation-store-boundary-inventory.md
  code:
    - services/evaluationStore/scriptContext.js
    - scripts/report-longitudinal-drift-stage-a2-live.js
    - scripts/report-longitudinal-drift-stage-a3-live.js
    - scripts/report-longitudinal-drift-stage-a4-live.js
    - scripts/report-longitudinal-drift-stage-a5-live.js
  items:
    - codebase-refactoring-program
    - refactor-operational-log-reader-injection
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/571
tags:
  - refactoring
  - evaluation
  - operational-scripts
  - dependency-injection
  - lifecycle
  - maintainability
milestone: evaluation-infrastructure
---

Migrate the four A2-A5 live longitudinal reports away from the lazy legacy
facade without changing their frozen deterministic instruments, report shapes,
Writing Pad behavior, or production data-path precedence.

Acceptance:

- Add one reusable standalone-script ownership boundary that closes stores it
  creates on success or failure and leaves injected host-owned stores open.
- Open an evaluation store only for report modes that read evaluation rows:
  A2-A5 scoring, A4-A5 live verification, and the A5 canary.
- Keep gate and injection-building modes free of evaluation-store acquisition;
  reject invalid score invocations before SQLite startup.
- Replace immediate `process.exit()` calls with returned status codes and set
  `process.exitCode` only after asynchronous disposal finishes.
- Preserve every existing scoring function, threshold, report projection,
  dialogue-log lookup, Writing Pad query, CLI status, and production path.
- Ratchet direct facade consumers from 17 to 13 live/package and operational
  scripts from 16 to 12 without model calls, production writes, or generated
  workplan-view changes.

Log:

- 2026-08-08 — Activated from refreshed main `68848f85` after PR #542 merged.
  Baseline: four reports dynamically import the facade from a mixed dependency
  loader, and their CLI entrypoints can terminate before explicit disposal.
- 2026-08-08 — Added a bounded store helper, migrated all evaluation-row modes,
  and moved CLI termination to natural asynchronous completion. Focused
  lifecycle, missing-database CLI, and boundary tests pass; direct live/package
  facade consumers are down to 13, including 12 operational scripts.
- 2026-08-08 — Rebased cleanly onto main `76e93faf` and reached review with 50
  focused tests plus the complete hermetic root and tutor-core suite green.
  Evaluation-store risk coverage passes at 97.84% lines, 76.76% branches, and
  97.34% functions; lint, formatting, manifest, workplan source, commit linkage,
  boundary, and zero-cycle gates also pass. The one pre-rebase sandboxed
  loopback `EPERM` was environmental and passed on authorized unrestricted
  reruns. No model calls, production writes, or generated board changes
  occurred.
- 2026-08-08 — Opened PR #571 from validated source commit `39b4bd7e`.
