---
id: store-opening-tests-own-their-paths
title: Keep every store-opening test isolated when it is run on its own
status: triaged
type: infra
priority: P3
owner: unassigned
source: manual
created: 2026-08-08
updated: 2026-08-08
verification: A test that opens an evaluation store without setting its own database and logs paths fails the suite, so `node --test tests/<file>` can never reach the shared archive.
claim_status: methods
links:
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

Checked on `origin/main`, 2026-08-08. Twelve test files open an evaluation
store. All twelve isolate themselves: four use `:memory:`, the rest build a
`mkdtemp` root and set `EVAL_DB_PATH` and `EVAL_LOGS_DIR` before opening. Two
call `createEvaluationStore({ rootDir: ROOT_DIR })` with the repository root,
which looks unsafe on the line itself but is preceded by an env override
(`tests/api-routes.test.js:96`, `tests/adaptiveTutorStoreInjection.test.js:72`).
So there is nothing to fix today.

What is missing is the thing that keeps it true. The next store-opening test
gets written without the override, passes under `npm test` because the runner
covers for it, and only bites when someone runs that one file. The guard is a
test that reads the test files, finds the ones that open a store, and asserts
each sets its own paths or uses `:memory:` — the sibling of
[[scripts-hardcoded-data-path-guard]], pointed at `tests/` rather than
`scripts/`.
