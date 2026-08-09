---
id: reduce-first-draft-outer-loop-test-time
title: Reduce first-draft outer-loop test latency
status: done
type: infra
priority: P2
owner: codex
source: manual
created: 2026-08-09
updated: 2026-08-09
branch: codex/reduce-first-draft-outer-loop-test-time
verification: >-
  Two unrestricted isolated before-runs averaged 26.23s and two after-runs
  averaged 7.92s, a 69.8% wall-time reduction while all runs passed 43/43
  tests; cache invalidation, combined focused tests, comprehensive hermetic
  root/core suites, lint, formatting, workplan, and diff checks pass.
claim_status: planned
depends_on:
  - optimize-local-node-execution
links:
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/601
  items:
    - optimize-local-node-execution
    - calibrate-local-node-test-concurrency
    - reduce-human-discourse-test-processes
tags:
  - node
  - local-development
  - testing
  - tutor-stub
  - first-draft
milestone: evaluation-infrastructure
---

Profile `tests/tutorStubFirstDraftOuterLoop.test.js`, then remove repeated
fixture parsing or validation work only where tests retain isolated mutable
copies and the same fail-closed assertions. Do not weaken the historical V27–V33
contract or held-out/debt/version-discipline checks merely to gain concurrency.

Acceptance:

- Record unrestricted isolated baselines with exact file, test, failure, and
  skip counts.
- Attribute time between YAML loading, fixture construction, validator calls,
  and test-runner scheduling before editing.
- Cache only immutable source parses; return isolated mutable clones to every
  fixture consumer.
- Preserve the explicitly sequential cases unless measurement proves their
  shared-corpus comment is obsolete and concurrent execution is deterministic.
- Demonstrate a meaningful repeated isolated improvement and pass the complete
  hermetic root/core suites before changing another slow-test file.
- Keep production validator behavior, evaluation stores, generated workplan
  views, and model-backed workflows unchanged.

Log:

- 2026-08-09 — Activated after PR #599 merged the 11.0% human-discourse test
  improvement. Recent full-suite profiles place this 43-test file first on the
  root critical path at approximately 33.7–61.5 seconds under varying machine
  load; an isolated baseline is required before attributing the cost.
- 2026-08-09 — Two isolated baselines passed 43/43 tests in 26.17s and 26.28s.
  A CPU profile attributed the dominant self samples to YAML parsing,
  synchronous file reads, frozen-replay source scans, and garbage collection;
  the longest mutation-failure tests repeatedly invoke the full validator.
- 2026-08-09 — Added test-local caching for the nine immutable checked-in YAML
  sources used by fixtures. Every consumer receives a fresh structured clone,
  preserving independent mutation and fail-closed assertions while replacing
  repeated parse work with cheaper cloning.
- 2026-08-09 — The YAML-only change reduced mean user CPU time from 24.64s to
  23.10s, but its 25.85s mean wall time was too noisy to claim as meaningful.
  A deeper profile isolated the dominant cost: each frozen-bundle validation
  scanned and parsed all 35 dramatic-world YAML files to locate one world.
- 2026-08-09 — Added a file-signature-validated world parse cache. Unchanged
  validated worlds are reused and each caller receives a structured clone;
  device, inode, size, mtime, and ctime changes force a fresh parse. A temp-root
  regression validates once, rewrites a same-length world id, and proves the
  next validation fails closed against the changed file.
- 2026-08-09 — Two isolated after-runs passed 43/43 tests in 7.94s and 7.89s,
  averaging 7.92s versus the 26.23s baseline: a 69.8% wall-time reduction.
  Combined campaign/outer-loop coverage passed 102/102 tests. The complete
  hermetic gate passed 639 root files / 8,164 tests and 11 tutor-core files /
  137 tests with zero failures or skips; focused ESLint and Prettier checks
  also pass.
- 2026-08-09 — PR #601 merged as `46edd784`. Cache invalidation and the full
  hermetic gate preserve the fail-closed contract, so the first-draft latency
  slice is done.
