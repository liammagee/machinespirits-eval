---
id: calibrate-local-node-test-concurrency
title: Calibrate local Node root-test concurrency
status: done
type: infra
priority: P2
owner: codex
source: manual
created: 2026-08-09
updated: 2026-08-09
branch: codex/calibrate-local-node-test-concurrency
verification: >-
  Repeated unrestricted hermetic root-suite profiles compared default/14 with
  4, 6, 8, and repeated 10-worker runs while all valid profiles preserved 638
  files, 8,157 passing tests, zero failures/skips, isolated stores, and exact
  manifest accounting; focused runner/local-CI contract, tutor-core, lint,
  format, workplan, and diff gates cover the retained optional control without
  changing the existing Node 20/22 CI topology.
claim_status: planned
depends_on:
  - optimize-local-node-execution
links:
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/596
  items:
    - optimize-local-node-execution
tags:
  - node
  - local-development
  - testing
  - performance
milestone: evaluation-infrastructure
---

Measure whether Node's machine-derived root-test concurrency oversubscribes
this repository's subprocess- and PTY-heavy suite. Expose a safe explicit
runner control for the experiment, but change the routine local default only if
the retained profiles show a meaningful repeatable improvement.

Acceptance:

- Preserve explicit hermetic selection and exact manifest accounting when a
  bounded root-test concurrency is requested.
- Compare the current default with a small preregistered sweep of 4, 6, 8, 10,
  and 14 workers on the same checkout and machine.
- Retain per-file timing/TAP evidence under ignored `.test-tmp/` paths and
  record total wall time, file/test counts, failures, and skips.
- Keep hosted CI shard topology, Node 20/22 coverage, production evaluation
  stores, generated workplan views, and model-backed workflows unchanged.
- Adopt a local default only if it wins without lost coverage, new failures,
  excessive variance, or materially worse slow-file behavior.

Log:

- 2026-08-09 — Activated after PR #586 reduced repeated lint/format latency.
  The retained unsharded profile completed 637 root files / 8,136 tests in
  about 72.6 seconds, while the slowest file took 48.4 seconds in the full run
  versus about 26.7 seconds in a smaller cohort. The machine exposes 14 logical
  workers, making bounded concurrency the next measurement-first slice.
- 2026-08-09 — Added an explicit root-only `--test-concurrency` runner option
  that preserves discovered or explicitly selected test files and the existing
  timing/TAP accounting. Values must be integers from 1 through 64; core-only
  runs reject the option rather than silently ignoring it.
- 2026-08-09 — Completed the unrestricted same-checkout sweep with every valid
  profile passing 638 files / 8,157 tests and zero skips: 4 workers took 116.71s,
  6 took 87.43s, 8 took 72.56s, two 10-worker runs took 64.92s and 65.34s, and
  default/14 took 65.42s and 63.23s. The initial sandboxed default was excluded
  because loopback listeners failed with `EPERM`, not because of source or
  concurrency behavior. Raw TAP and per-file timings are retained under
  `.test-tmp/concurrency-2026-08-09/`.
- 2026-08-09 — Ten workers averaged 65.13s versus 64.33s for default/14, while
  lower counts materially worsened total throughput despite improving some
  individual slow-file tails. The evidence therefore rejects a hard-coded
  local default; retain Node's machine-derived default and keep the explicit
  option only for reproducible profiling on other hosts.
- 2026-08-09 — Review validation passes: 46/46 focused runner/local-CI tests,
  tutor-core 11 files / 137 tests, exact hermetic manifest synchronization,
  469/469 workplan sources, cached ESLint, cached Prettier, and
  `git diff --check`. Hosted Node 20/22 coverage remains unchanged and will
  exercise the runner option's compatible no-default path in CI.
- 2026-08-09 — PR #596 merged as `c3ea1743`. The measured sweep rejected a
  hard-coded local default while retaining the explicit profiling control, so
  the bounded concurrency-calibration item is done.
