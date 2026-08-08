---
id: store-opening-tests-own-their-paths
title: Keep every store-opening test isolated when it is run on its own
status: review
type: infra
priority: P3
owner: codex
source: manual
created: 2026-08-08
updated: 2026-08-08
branch: codex/store-opening-tests-own-their-paths
verification: A test that opens an evaluation store without setting its own database and logs paths fails the suite, so `node --test tests/<file>` can never reach the shared archive.
claim_status: methods
links:
  code:
    - scripts/check-test-store-paths.js
    - tests/testStorePathOwnership.test.js
  items:
    - eval-db-writer-reader-path-split
    - scripts-hardcoded-data-path-guard
tags:
  - infra
  - data-integrity
  - testing
---

`npm test` and `npm run test:hermetic` both go through
`scripts/run-hermetic-tests.js`, which sets `EVAL_DB_PATH`, `EVAL_LOGS_DIR` and
the rest for every child. A test file run straight from `node --test` gets none
of that, and a store opened there resolves the same way a real run does — into
the shared archive.

The first line-based audit on `origin/main`, 2026-08-08 counted twelve test
files and reported them isolated. The syntax-aware guard found the fuller
picture: eighteen test files open a store, and eight of them relied on the
suite-wide sandbox for at least one path. Those eight now create and remove
their own temporary database and dialogue-log roots, including when invoked
directly with `node --test tests/<file>`.

What is missing is the thing that keeps it true. The next store-opening test
gets written without the override, passes under `npm test` because the runner
covers for it, and only bites when someone runs that one file. The guard is a
test that reads the test files, finds the ones that open a store, and asserts
each sets its own paths or uses `:memory:` — the sibling of
[[scripts-hardcoded-data-path-guard]], pointed at `tests/` rather than
`scripts/`.

## Log

- 2026-08-08 — Reached review with an Acorn-backed test scanner and a
  standalone `npm run test-store-paths:check` command. The guard identifies
  eighteen store-opening tests and requires each to own both `EVAL_DB_PATH`
  and `EVAL_LOGS_DIR`, or to use an in-memory store. Eight previously hidden
  dependencies on the suite-wide sandbox were repaired. All eighteen pass the
  guard, and every changed test passes when run directly.
