---
id: archive-loss-guards
title: Close the two archive gaps behind the E.7 and §7.9 withdrawals
status: review
type: infra
priority: P1
owner: claude
source: manual
created: 2026-09-03
updated: 2026-09-03
branch: claude/archive-loss-guards
verification: "npm test -- tests/archiveRunArtifacts.test.js tests/lintPrePushHook.test.js tests/snapshotArchiveScript.test.js; npm run archive:check exits 0; ls ~/.machinespirits-data/snapshots/dated shows today's copies"
links:
  items:
    - run-artifact-archiving
  files:
    - scripts/archive-run-artifacts.js
    - scripts/lint-hook.js
    - scripts/snapshot-archive.sh
    - docs/archive-replication.md
    - tests/snapshotArchiveScript.test.js
tags:
  - archive
  - infra
  - data-loss
---

## Why

Two positive claims were withdrawn on 2026-09-03 because their artifacts were
gone (paper E.7 and §7.9). The archive machinery from `run-artifact-archiving`
did not cover either loss:

- the default archive check looked only at `exports/tutor-stub-outcome`, so the
  E.7 character pilot package (75 files, elsewhere under `exports/`) was never
  listed as missing;
- the DB snapshot job kept one rolling copy, so the §7.9 analyzer rows that were
  deleted from `evaluations.db` were gone from the snapshot at the next run.

## What changed

1. `npm run archive:check` and `npm run archive:runs` now cover every run under
   `exports/`, at any depth. A cohort directory stays one unit with one ledger
   line. A first full copy ran on 2026-09-03 (791 light files, 48 MB).
2. The pre-push hook prints the archive summary after a passing lint. It never
   blocks: a build server has no `exports/` and no archive directory.
3. `scripts/snapshot-archive.sh` writes one compressed copy per UTC day to
   `snapshots/dated/` and prunes copies older than `MS_SNAPSHOT_KEEP_DAYS`
   (default 28) by the date in the file name. About 72 MB a day.

## Still manual

- The private archive repo needs its own `git commit` and `git push` after
  `npm run archive:runs`. The hook says so; it does not do it.
- The launchd job runs the copy in `~/.machinespirits-data`, not the repo file.
  Re-copy after editing the script.

## Log

- 2026-09-03: built all three, tests added, first full archive copy and first
  dated DB snapshot taken. Awaiting merge.
