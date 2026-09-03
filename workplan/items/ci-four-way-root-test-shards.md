---
id: ci-four-way-root-test-shards
title: Split the CI root test lane into four shards and start it without waiting for test-contract
status: review
type: infra
priority: P2
owner: claude
source: manual
created: 2026-09-03
updated: 2026-09-03
branch: ci/four-shard-root-test-matrix
verification: >-
  Focused workflow, local-CI and change-policy contract tests pass; prettier
  and eslint pass on the changed files; workplan source check passes; then one
  hosted PR run shows the four root shards finish within about 20 seconds of
  each other and the whole workflow lands near 3 minutes.
links:
  prs:
    - 962
  items:
    - calibrate-local-node-test-concurrency
    - expedite-ci-expensive-boundaries
tags:
  - ci
  - developer-experience
---

The hosted workflow's critical path is the root test matrix. Each of the two
root shards carried about 440 s of test work at a file concurrency of 3, so
the shard step took about 3.5 minutes and the whole run about 5. The lane
also waited on the `test-contract` job (about 33 s of classify plus contract)
even though the hermetic runner re-checks the test manifest itself.

Change:

- Four root shards per Node version instead of two. Shard membership stays
  hash-stable; the hand override map in `scripts/run-hermetic-tests.js` is now
  keyed by shard count, with a measured 4-way correction.
- The `test` job needs only `classify`. The `result` job still requires
  `test-contract`, so the contract gate is unchanged.
- The local CI mirror, the workflow contract tests and `docs/local-ci.md`
  run and expect four shards.

Acceptance:

- Four root shards per Node version with hash-stable membership and a
  shard-count-keyed override map.
- The test lane starts after `classify` alone; `result` still needs
  `test-contract`.
- Local CI runner and docs match the hosted shape; contract tests pin it.
- One hosted PR run: the four shards finish within about 20 s of each other
  and the whole workflow lands near 3 minutes.

Not adopted here: a higher `--test-concurrency`. Retest it on CI with
concurrency 4 on one shard after this lands, comparing against the other
three shards in the same run.

Log:

- 2026-09-03 — Measured the full root suite locally with `--report-dir`:
  842 s of work across 815 files, largest file 54.5 s. The 4-way hash split
  gave 171/161/218/292 s. Moving two files off shard 4 gives
  192/214/218/217 s (196/192/211/216 files).
- 2026-09-03 — Concurrency trial on shard 4 of 4 locally: concurrency 3 ran
  in 66.9 s wall at 310% CPU; concurrency 6 in 43.3 s at 526% CPU, with each
  slow file about a quarter slower. A hosted runner has 4 vCPUs, so the gain
  does not transfer; left at the default.
- 2026-09-03 — Local verification: 72/72 focused contract tests (hermetic
  runner, local CI, change policy); prettier and eslint clean on the changed
  files. Branch `ci/four-shard-root-test-matrix` opened from `origin/main`
  at 698da289.
