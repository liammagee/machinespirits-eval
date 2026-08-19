---
id: shorten-full-ci-critical-path
title: Shorten the full-CI critical path
status: active
type: infra
priority: P1
owner: codex
source: manual
created: 2026-08-19
updated: 2026-08-19
verification: "Required history-aware workflow jobs pass with blobless checkout; focused classifier and workflow contract tests pass; a matched local two-way versus three-way root-shard benchmark records the critical-path and runner-cost tradeoff, and only adopts three shards if the measured gain justifies two additional runners."
branch: codex/shorten-full-ci-critical-path
links:
  items:
    - optimize-ci-agent-iteration-loop
    - optimize-hermetic-test-suite
    - decommission-electron-desktop-target
tags:
  - ci
  - latency
  - testing
  - developer-experience
---

The Electron boundary is gone, leaving the serial history checkout/classifier and
the four standard Node shard jobs as the main visible full-CI loop. Improve those
boundaries without weakening changed-path classification, supported-Node coverage,
the hermetic test contract, or fail-closed behavior.

Acceptance:

- Retain complete commit/tree history and the existing merge-base changed-path
  semantics while avoiding downloads of historical file blobs in history-aware
  classifier and workplan jobs.
- Keep ambiguous or unavailable change ranges fail-closed to full CI.
- Benchmark the current two-way root suite against three-way sharding on the same
  checkout, Node runtime, dependencies, and machine; record per-shard execution,
  maximum shard time, aggregate runner time, and file/test completeness.
- Adopt three-way hosted sharding only if the repeatable critical-path reduction
  is material enough to justify two additional concurrent runners and does not
  create a new balancing-maintenance burden. Otherwise retain two shards and
  record the rejection as the result.
- Pass the CI policy, hermetic-runner, workflow-contract, formatting, source-only
  workplan, and commit-link checks relevant to this workflow-only change.

Log:

- 2026-08-19 — Opened from current `origin/main` after the Electron removal and
  post-merge benchmark closed. The first low-risk target is blobless full-history
  checkout for history-aware jobs; the second is a measured two-versus-three-way
  root-shard decision rather than an assumed matrix expansion.
- 2026-08-19 — Added `filter: blob:none` without reducing `fetch-depth: 0` to
  the CI and validation classifiers, the focused-CI recheck, workplan validation
  and commit-link jobs, and the tutor-surface classifier. This retains the
  existing merge-base range and fail-closed policy while omitting historical
  file contents that those jobs do not read.
- 2026-08-19 — Benchmarked Node 22.22.3 / npm 10.9.8 on one checkout and machine
  with `CI=1`, identical dependencies, natural teardown, and normal loopback
  access. Two-way shards were 36.49s and 35.40s (critical 36.49s; aggregate
  71.89s; 703 files / 9,024 tests). Three-way shards were 30.44s, 24.19s, and
  30.10s (critical 30.44s; aggregate 84.73s; the same 703 files / 9,024 tests).
  Three-way saved only 6.05s (16.6%) locally while adding 12.84s (17.9%) of root
  runner time before two additional hosted checkouts, installs, and queue slots,
  so it is rejected and the existing two-way matrix remains.
- 2026-08-19 — The same pre-existing
  `writingPadNarrativeBuilder.test.js` assertion failed once in both layouts;
  every selected file still reported, and the other four measured shards passed.
  This is not attributed to either sharding layout or the workflow-only diff;
  the clean hosted full matrix remains the merge gate.
