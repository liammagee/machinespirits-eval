---
id: pty-lane-tempdir-teardown-race
title: Stop the interactive test lane failing on its own temp-dir cleanup
status: done
type: infra
priority: P2
owner: claude
source: manual
created: 2026-08-09
updated: 2026-08-09
verification: >-
  npm run test:pty:ci passes with the five interactive test files removing
  their temp directories through one retrying helper, and a cleanup that
  cannot be completed warns instead of throwing out of a finally block.
claim_status: settled
links:
  code:
    - tests/helpers/tutorStubInteractiveHarness.js
    - tests/tutorStubInteractivePerformance.test.js
tags:
  - infra
  - tests
  - tutor-stub
---

## Why

The concurrent terminal lane failed on PR #600, a branch whose only change was
a markdown file. The error was `ENOTEMPTY: directory not empty, rmdir
'/tmp/tutor-stub-light-adaptation-4qJ6sT'` from
`tests/tutorStubInteractivePerformance.test.js`.

An interactive run can still be flushing a trace file for a moment after the
child process closes. The test then calls `fs.rmSync` with no retries, which
races that last write and throws. Two things follow. The lane goes red for a
reason that has nothing to do with the branch. And because the call sits in a
`finally`, a cleanup error replaces whatever the test was really reporting, so
a genuine failure in that test would arrive wearing the wrong name.

One call site in the same lane already carried `maxRetries: 5` — the race was
known and patched in one spot out of forty-four.

## What changed

`removeTempDir(dir)` in the shared harness: retry ten times at 50ms, and if the
directory still will not go, warn and carry on. All 44 cleanup calls in the five
lane files now go through it.

Retrying is what Node documents for this error class. Warning rather than
throwing is the second half: a leftover temp directory is a smaller problem
than a masked test failure.

## Scope

The five files in `test:pty:ci` only. The same bare `fs.rmSync(tmp, …)` appears
about 180 more times across the rest of `tests/`, and those can move to the
helper when a lane of theirs goes red for it.

## Log

- 2026-08-09 — found via a red check on PR #600, fixed there. Lane green at
  50/50 locally.
