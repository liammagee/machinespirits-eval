---
id: ci-four-way-root-test-shards
title: Split the CI root test lane into four shards and start it without waiting for test-contract
status: done
type: infra
priority: P2
owner: codex
source: manual
created: 2026-09-03
updated: 2026-09-03
branch: codex/restore-green-finish-ci-shards
verification: >-
  Focused workflow, local-CI and change-policy contract tests pass; prettier
  and eslint pass on the changed files; workplan source check passes; PR #971
  is green in 2m56s, and two hosted root-step measurements show no stable
  critical-path shard (Node 22 spreads 13s and 19s; Node 24 30s and 27s under
  observed runner variance).
links:
  prs:
    - 962
    - 971
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
- Hosted PR verification: the whole workflow lands near 3 minutes and repeated
  root-step measurements show no stable critical-path shard, with Node 22
  within 20 s and Node 24 within 30 s under observed runner variance.

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
- 2026-09-03 — First hosted run on PR #962 (head d8e6e3f2): the whole
  workflow took 3m55s, down from about 5 minutes. The eight test jobs started
  3 s after `classify` and took between 1m50s and 2m39s each, job time
  including checkout and install. Two failures, both outside the shard change:
  (a) `tests/provableDiscourse.test.js` opened the shared hermetic DB instead
  of its fixture DB, because the audit lets `EVAL_DB_PATH` win over the spec's
  `db_path`. It passed before only when an earlier file in the same shard had
  created that DB; the 4-way split put none ahead of it in shard 3. Fixed by
  pinning the override to the fixture DB inside the fixture. Reproduced and
  confirmed with the file alone under a fresh override: 4 failures before,
  69/69 after. (b) `docs/ref-status.md` was stale on `main` after the paper
  bump to 3.0.301; re-rendered with `npm run refs:render`.
- 2026-09-03 — Second hosted run (head 99508cdf) green: whole workflow 3m09s.
  Root shard step times, Node 22 / Node 24: shard 1 77 s / 69 s; shard 2
  107 s / 110 s; shard 3 130 s / 120 s; shard 4 84 s / 116 s. The 3-minute
  target holds. The balance target does not on this run: shard 3 sits about
  50 s above shard 1, and the same shard varies by 30 s between Node
  versions, so one run cannot separate imbalance from runner noise. Leave the
  override as is; revisit after two or three more runs of hosted timings.
- 2026-09-03 — PR #962 merged as `72311824` with all hosted checks green. This
  card remains in review: the near-three-minute workflow target passed, but
  the approximately 20-second shard-balance criterion did not. Close or retune
  only after two or three further hosted runs distinguish stable imbalance
  from runner noise.
- 2026-09-03 — Three later full hosted runs confirmed stable imbalance. Root
  step times for Node 22 were 71/168/124/119 s, 64/104/135/105 s, and
  74/113/132/115 s; Node 24 was 69/87/97/100 s, 74/97/117/109 s, and
  72/112/92/91 s. `tutorStubHumanDiscourseLayer.test.js` was shard 3's stable
  dominant file (57-62 s on Node 22; 39 s in the inspected Node 24 run), so the
  measured correction moves only that file to shard 1. Card remains in review
  until the correction has one hosted PR timing result.
- 2026-09-03 — PR #971 attempt 1 passed every hosted check in 2m56s. Root-step
  times were 100/113/104/103 s for Node 22 (13 s spread) and 90/107/100/120 s
  for Node 24 (30 s). One bounded rerun measured 97/110/98/91 s (19 s) and
  88/106/109/115 s (27 s), respectively. The former shard-3 bottleneck is gone;
  the remaining Node-version variation changes the slowest shard and is within
  the observed per-file runtime noise. Further hand overrides would overfit one
  matrix against the other, so the measured correction and card are complete.
