---
id: refactor-operational-run-store-ownership
title: Give operational run launchers explicit evaluation-store ownership
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-08
updated: 2026-08-08
branch: codex/refactor-operational-run-store-ownership
verification: >-
  Lifecycle, database-path isolation, adaptive and trap smoke regressions,
  boundary inventory, hermetic root and tutor-core, risk coverage, source,
  lint, formatting, manifest, and cycle gates prove four launchers own and
  close their stores without changing run orchestration or persisted rows.
claim_status: planned
depends_on:
  - refactor-operational-score-store-ownership
links:
  notes:
    - docs/next-steps/2026-08-06-evaluation-store-boundary-inventory.md
  code:
    - services/evaluationStore/scriptContext.js
    - config/evaluation-store-boundary-inventory.json
    - scripts/run-adaptive-cell-smoke.js
    - scripts/run-adaptive-persistence-smoke.js
    - scripts/run-dialogue-engine-trap-baseline.js
    - scripts/run-id-director-trap-pilot.js
    - tests/evaluationScriptContext.test.js
    - tests/evaluationStoreBoundaryInventory.test.js
  items:
    - codebase-refactoring-program
    - refactor-operational-score-store-ownership
tags:
  - refactoring
  - evaluation
  - operational-scripts
  - adaptive-tutor
  - dependency-injection
  - lifecycle
  - maintainability
milestone: evaluation-infrastructure
---

Continue the operational-script host migration with the four launchers that
exercise adaptive or trap-oriented evaluation runs. Each invocation should own
one bounded evaluation store and pass it through its runner or persistence
boundary instead of reaching through the lazy process-global facade.

Acceptance:

- Remove the legacy evaluation-store facade from both adaptive smoke scripts
  and both trap/pilot launchers.
- Acquire one explicitly owned store per invocation after arguments and
  temporary-path configuration are settled; pass it to adaptive runners,
  persistence adapters, and result writers through existing injection seams.
- Close stores created by a launcher on success and failure while preserving
  injected host-owned stores for tests and composition.
- Replace immediate `process.exit()` paths with naturally completing exported
  entrypoints where lifecycle disposal requires it.
- Preserve scenario selection, mock/real model admission, budget accounting,
  trace projection, result payloads, CLI output, exit statuses, and temporary
  database isolation.
- Prove isolated database selection and store disposal without production
  writes or paid model calls.
- Ratchet direct facade consumers from nine to five live/package and operational
  scripts from eight to four without committing generated workplan views.

Log:

- 2026-08-08 — Activated from refreshed main `adb85c32` after PRs #575 and
  #576 merged. Baseline: the two smoke scripts defer-import the facade after
  selecting temporary database paths, while the trap and id-director launchers
  import it eagerly and persist through process-global bindings.
- 2026-08-08 — Migrated all four launchers to one bounded script-owned store.
  Adaptive smokes now inject the existing runner/persistence factories; trap
  launchers share that store across run creation and result mutations, validate
  before startup, and clear model/budget/id-director globals in `finally`.
  Both zero-call adaptive smokes pass, focused lifecycle/path/inventory coverage
  passes 33/33, the complete hermetic root and 137/137 tutor-core suites pass,
  and risk coverage passes all five groups (evaluation store: 97.85% lines,
  77.23% branches, 97.35% functions). Lint, formatting, manifest, source-only
  workplan, diff, and zero-cycle gates pass. The initial sandboxed risk run's
  sole loopback `EPERM` passed on the authorized rerun; no paid model call or
  production data write occurred. The inventory is now five live/package
  consumers, including four operational scripts.
