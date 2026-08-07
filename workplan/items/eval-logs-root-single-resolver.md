---
id: eval-logs-root-single-resolver
title: Two resolvers decide where the dialogue logs go
status: done
type: infra
priority: P3
owner: claude
source: manual
created: 2026-08-08
updated: 2026-08-08
branch: eval-logs-root-single-resolver
verification: One exported `resolveEvaluationLogsRoot`, called by the store and by the readers alike, with a test that a relative `EVAL_LOGS_DIR` resolves against `rootDir` on both sides.
claim_status: methods
links:
  items:
    - eval-db-writer-reader-path-split
tags:
  - infra
  - data-integrity
---

`resolveEvaluationLogsRoot` exists twice, with different signatures and slightly
different rules.

- `services/evaluationDataPaths.js:55` — the readers. Positional
  `(rootDir, explicitPath)`, reads `process.env` and `fs` directly.
- `services/evaluationStore/createEvaluationStore.js:27` — the store. Options
  object, `env`/`fileSystem`/`homeDir` injectable.

They agree on every absolute path, which is why nothing has broken. They differ
in three places:

1. A relative `EVAL_LOGS_DIR` — the readers join it to `rootDir`, the store
   returns it raw and it lands relative to the working directory. This is the
   same defect as `eval-db-writer-reader-path-split`, one path down.
2. The store takes no explicit-path argument, so a caller that has been handed a
   `--logs` value has nowhere to put it.
3. The readers prefer `<rootDir>/logs` when the root is not an eval checkout and
   that directory exists — a packaged run handed over as a folder. The store
   goes to the shared archive instead.

Fix: keep the readers' rules, give that function the store's injectable `env`
and `fileSystem`, and delete the store's copy. The signature then matches
`resolveEvaluationDbPath` in the same file, so each kind of path has one rule
and one shape.

Two behaviour changes fall out and are both wanted. The store starts anchoring a
relative `EVAL_LOGS_DIR` to `rootDir`. And the store gains the
not-a-checkout branch, which cannot fire in production — every
`createEvaluationStore` caller passes the repo root, and the hermetic runner
always sets `EVAL_LOGS_DIR` outright.

## Outcome (2026-08-08)

Done as described. `services/evaluationStore/createEvaluationStore.js` no longer
exports a resolver of its own; it and `scriptContext.js` call the one in
`services/evaluationDataPaths.js`, which now takes `(rootDir, explicitPath,
{ env, fileSystem })` — the same signature as `resolveEvaluationDbPath` beside
it.

Two cases went into `tests/evaluationDbPathAgreement.test.js`, next to the
database ones, since it is the same question about a different path. The first
plants a dialogue log under a relative `EVAL_LOGS_DIR` and asks the store to
load it; that fails against the old rule, because the store looked under the
working directory. The second pins the handed-over-folder case for the read
side. Full suite 8036 root, 137 core, all green.

The old store version took a `homeDir` argument; it is gone rather than
threaded, since `MS_DATA_HOME` is what the tests actually set and what the
readers have always honoured.
