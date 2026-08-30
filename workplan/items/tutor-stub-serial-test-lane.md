---
id: tutor-stub-serial-test-lane
title: Diagnose tutor-stub load failures before adding a serial lane
status: done
type: infra
priority: P1
owner: codex
source: manual
created: 2026-08-27
updated: 2026-08-28
verification: Under host load above the 14-way Node concurrency ceiling, both
  ordinary root shards pass with all 294 tutor-stub files in their existing
  topology after the demonstrated UTC timestamp defect is fixed; the same
  candidate files pass alone; no unsupported serial lane is added.
claim_status: methods
links:
  prs:
    - 844
  notes:
    - scripts/run-hermetic-tests.js
    - config/hermetic-test-manifest.json
tags:
  - tests
  - ci
  - codex-sol
  - effort-xhigh
branch: codex/tutor-stub-serial-test-lane
---

Diagnose the reported bulk tutor-stub failures before changing test topology.
A serial or bounded manifest lane is acceptable only if the same files pass in
isolation and fail repeatably in their ordinary mixed shard under load. A
deterministic defect, shared-state leak, setup failure, sandbox denial, or
provenance guard must be fixed or controlled directly instead of hidden by
lower concurrency.

## Evidence

- 2026-08-28 — Baseline: current `origin/main` at `ee2f3db3`, Node 22.22.3,
  14 available workers. The host load reached 46-63 while the normal shards
  ran, well above Node's default concurrency ceiling.
- 2026-08-28 — Discarded setup confound: the first run started before `npm ci`
  had completed and reported missing JavaScript/native modules. A completed
  lockfile install plus direct `better-sqlite3`, `node-pty`, and `base64-js`
  loads removed it.
- 2026-08-28 — Discarded sandbox confound: local HTTP/voice suites failed with
  `listen EPERM` until the offline tests were allowed to bind loopback. Those
  failures were permission denials, not concurrency failures.
- 2026-08-28 — Discarded dirty-checkout confound: two resistance-study suites
  deliberately refused while this card was modified. From a clean checkout,
  the same files passed 41/41 in 10.4 seconds.
- 2026-08-28 — Deterministic defect: `writingPadNarrativeBuilder.test.js`
  failed alone and in loaded shard 1. SQLite `CURRENT_TIMESTAMP` is UTC but
  lacks a zone suffix; local-time parsing made a fresh moment appear five
  hours in the future in Chicago, so it missed a zero-age consolidation gate.
  The runtime now parses the database-native timestamp shape as UTC, and the
  regression test pins a non-UTC timezone.
- 2026-08-28 — Focused verification passed: Writing Pad root file 10/10; three
  related tutor-core files 10/10.
- 2026-08-28 — Loaded verification passed in the unchanged topology: shard 1
  5,294 tests / 0 failures and shard 2 4,419 tests / 0 failures. Their ordinary
  mix includes all 294 tutor-stub files. No manifest lane, package-script lane,
  workflow job, or workflow-structure assertion was added.
- 2026-08-28 — PR #844 merged with all hosted checks complete and no failed or
  pending checks; diagnosis closed the deterministic defect without adding an
  unsupported serial lane.
