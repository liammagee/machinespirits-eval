---
id: eval-db-writer-reader-path-split
title: A run in a worktree writes one database and every reader opens another
status: done
type: infra
priority: P2
owner: claude
source: manual
created: 2026-08-07
updated: 2026-08-07
branch: eval-db-writer-reader-path-split
verification: A paid run launched from a git worktree lands its rows where the analysis scripts read them, or fails loudly at launch. Demonstrated by a hermetic test that runs the writer and a reader from a fake worktree root and asserts they resolve the same file.
claim_status: methods
links:
  items:
    - sarcasm-precondition-claim-bearing-mood
tags:
  - infra
  - data-integrity
  - worktrees
---

The store's writer and the analysis readers resolve the evaluation database by
different rules, and in a worktree the two rules point at different files.

- `services/evaluationStore/connection.js:9` — the writer. Honours
  `EVAL_DB_PATH`, otherwise `<rootDir>/data/evaluations.db`, full stop.
- `services/evaluationDataPaths.js:22` (`resolveEvaluationDbPath`) — every
  reader. Honours `EVAL_DB_PATH`, then prefers
  `~/.machinespirits-data/evaluations.db` **when that file exists**, and only
  falls back to the repo-local path.

In the main checkout these agree, because the repo-local file is the archive (or
a symlink to it). In a worktree `rootDir` is the worktree, so the writer creates
a fresh `data/evaluations.db` there while every reader keeps opening the archive.
Nothing errors. The run completes, the report says it found no rows, and the
paid rows sit in a file no script looks at.

Seen live on 2026-08-07: run `eval-2026-08-07-e3dffab2` (14 rows plus 124
score-audit rows) wrote to the worktree and had to be copied across by hand.
Dialogue logs were unaffected — `LOGS_ROOT` resolves correctly.

Two smaller defects fell out of the same investigation, worth fixing alongside:

1. `score_audit.result_id` is `TEXT` while `evaluation_results.id` is `INTEGER`.
   SQLite's type affinity makes the join work; any code that rebuilds that join
   in memory (a `Map`, a `Set`) gets strict equality and silently matches
   nothing. Cost an hour on the copy above.
2. `tests/dryRun.test.js` leaves mock runs behind in a production-shaped
   `data/evaluations.db`. In a worktree that means `npm test` mints the very
   file that causes this split, so the trap is self-laying.

Fix direction, cheapest first: give the writer the same resolver the readers
use, so there is one rule. If that is too invasive, have `eval-cli run` compare
the two resolutions at launch and refuse to start when they disagree without an
explicit `EVAL_DB_PATH` — a loud failure before any money is spent beats a
silent one after.

## Outcome (2026-08-07)

The cheapest fix held, so the launch-time guard was not needed: one rule makes
the two resolutions the same expression, and there is nothing left to compare.

- The store now delegates to `resolveEvaluationDbPath`. This matches what the
  logs root has always done — `createEvaluationStore` prefers the archive's logs
  directory the same way — so it repairs an inconsistency rather than setting a
  new policy. A relative `EVAL_DB_PATH` was a second split of the same class
  (writer resolved it against the working directory, readers against `rootDir`);
  both now use `rootDir`.
- `tests/evaluationDbPathAgreement.test.js` runs the real writer and a real
  reader from a fake worktree and asks the reader for the row the writer just
  wrote, rather than comparing two strings. It also asserts no worktree-local
  database was minted. Two of its four cases fail against the old rule — the two
  where the rules disagreed; the other two are situations where they coincided,
  which is why the defect survived in the main checkout.
- `score_audit.result_id` is now `INTEGER`, rebuilt once under a guard on the
  declared type. Rehearsed on the archive's 117,825 rows: 330 ms, count and
  checksum unchanged, every value integer-typed afterwards. The copy leans on
  affinity rather than `CAST`, so a value that is not a lossless integer stays as
  it is instead of collapsing to 0. One assertion in `tests/provenance.test.js`
  had to drop a `String()` — the defect in miniature.
- `tests/dryRun.test.js` sets its own store paths, so running it directly no
  longer mints the file that starts the whole problem.

Left alone deliberately: `resolveEvaluationLogsRoot` still exists twice, in
`services/evaluationDataPaths.js` and `services/evaluationStore/createEvaluationStore.js`,
with different signatures. The two agree today. Unifying them is the same class
of repair and worth its own card.

The worktree's shadow `data/evaluations.db` still holds the three runs from the
incident. The archive has the paid rows already, so it is disposable, but
deleting a database is the owner's call. `npm run db:closeout` still works and
now finds nothing to import.
