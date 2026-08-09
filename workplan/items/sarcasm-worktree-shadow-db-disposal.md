---
id: sarcasm-worktree-shadow-db-disposal
title: Dispose of the shadow database the sarcasm worktree wrote
status: done
type: maintenance
priority: P3
owner: human
source: manual
created: 2026-08-08
updated: 2026-08-09
branch: codex/close-sarcasm-shadow-db-disposal
verification: The worktree's `data/evaluations.db` is gone, after the owner confirms the archive holds everything it held.
claim_status: methods
links:
  items:
    - eval-db-writer-reader-path-split
    - sarcasm-precondition-claim-bearing-mood
tags:
  - maintenance
  - data-integrity
  - worktrees
---

The sarcasm worktree still carries the database the path split created:
`data/evaluations.db`, 900 KB, gitignored, last written 2026-08-07 22:10. It
holds three runs.

Checked 2026-08-08 against `~/.machinespirits-data/evaluations.db`:

| run | in the worktree | in the archive |
|---|---|---|
| `eval-2026-08-07-e3dffab2` (Sarcasm precondition grid v1) | 14 results, 124 score-audit rows | 14 results, 124 score-audit rows |
| `eval-2026-08-07-63d1cb41` (dry-run, mock) | 1 | 0 |
| `eval-2026-08-07-2779d1d0` (dry-run, mock) | 1 | 0 |

So the paid run is fully copied across, and what is only in the worktree is two
mock rows from a dry run that were never wanted anywhere.

Deleting it is safe on that evidence and is still the owner's call, because it
is the last copy of anything and reading a table is not the same as knowing what
someone meant to keep. The alternative is to leave it: it costs a megabyte and
is now harmless, since the writer and the readers agree on the archive and this
file is no longer in either one's path.

## Log

- 2026-08-09 — The owner authorized disposal. At execution time the exact
  shadow path
  `.claude/worktrees/sarcasm-determinate-negation/data/evaluations.db` was
  already absent, so this closeout deleted nothing further. Re-verification of
  `~/.machinespirits-data/evaluations.db` found the paid run
  `eval-2026-08-07-e3dffab2` intact with 14 results and 124 score-audit rows;
  `PRAGMA integrity_check` returned `ok`. The two mock-only run ids remain
  absent from the canonical database as intended. The stale disposal card is
  closed.
