---
id: refactor-prompt-lab-store-ownership
title: Give prompt-lab orchestration explicit evaluation-store ownership
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-09
updated: 2026-08-09
branch: codex/refactor-prompt-lab-store-ownership
verification: >-
  Import safety, store-free help and invalid admission, shared command-store
  injection, owned and host-owned disposal, prompt-lab recovery and aggregation
  parity, boundary inventory, hermetic, risk coverage, source, lint,
  formatting, manifest, and cycle gates prove the complete prompt-lab command
  family owns one bounded evaluation store without changing session or scoring
  semantics.
claim_status: planned
depends_on:
  - refactor-token-budget-store-ownership
links:
  notes:
    - docs/next-steps/2026-08-06-evaluation-store-boundary-inventory.md
  code:
    - services/evaluationStore/scriptContext.js
    - config/evaluation-store-boundary-inventory.json
    - scripts/prompt-lab.js
    - tests/prompt-lab-recovery.test.js
    - tests/evaluationScriptContext.test.js
    - tests/evaluationStoreBoundaryInventory.test.js
  items:
    - codebase-refactoring-program
    - refactor-token-budget-store-ownership
tags:
  - refactoring
  - evaluation
  - operational-scripts
  - prompt-lab
  - dependency-injection
  - lifecycle
  - maintainability
milestone: evaluation-infrastructure
---

Remove the last operational script from the legacy evaluation-store facade.
Prompt-lab combines filesystem session management, child evaluation runs,
stored-result refreshes, recommendation generation, and iterative acceptance;
one invocation should share one explicit store across every session command.

Acceptance:

- Remove the legacy evaluation-store facade from `scripts/prompt-lab.js` and
  export an import-safe, naturally completing `main()` entrypoint.
- Thread one explicit store through session loading and summary refresh,
  stored-result projection, recommendation basis reads, run summaries,
  autotune reloads, and imported-run fallback reads.
- Preserve all command names, options, prompt/session paths, child eval
  arguments, recommendation and recovery behavior, score aggregation,
  target-dimension selection, snapshot writes, acceptance/reversion decisions,
  status output, and error text.
- Keep help, unknown-command usage, `init`, missing session, and missing import
  run-id admission evaluation-store-free.
- Close stores created by prompt-lab on success and failure while preserving a
  host-owned injected store for composition and tests.
- Support an injected session root so lifecycle and stored-summary refresh can
  be proved without touching production prompt-lab sessions or evaluation data.
- Ratchet direct facade ownership from two to one live/package consumer,
  leaving no operational scripts and only the public package compatibility
  entrypoint.
- Do not make model calls, write production data, or commit generated workplan
  views.

Log:

- 2026-08-09 — Activated from post-PR-#588 main `87dba4dc`. Baseline:
  prompt-lab is 3,101 lines, reads results and statistics through the lazy
  facade, derives CLI arguments at module import, and terminates fatal paths
  with `process.exit(1)`. It is the sole remaining operational facade consumer.
- 2026-08-09 — Replaced the facade with one invocation-owned script context,
  threaded that store through every result/statistics read, exported an
  import-safe `main()`, made help and invalid admission database-free, and
  added injected session-root plus child-run seams. The isolated command test
  exposed and then verified an async-lifetime fix so session writes remain
  inside the injected invocation. Forty focused tests, 8,152 root tests, 137
  tutor-core tests, lint, formatting, syntax, cycle, manifest, workplan-source,
  boundary-inventory, and risk-coverage gates pass. The inventory now records
  zero operational facade consumers and one live/package consumer: the public
  package compatibility entrypoint. No model call or production data write
  occurred.
