---
id: tutor-stub-serial-test-lane
title: Declared serial lane for tutor-stub tests in the hermetic runner
status: active
type: infra
priority: P1
owner: codex
source: manual
created: 2026-08-27
updated: 2026-08-28
verification: The hermetic runner supports a lane declared in the test manifest
  that runs its files serially or at bounded concurrency; the tutor-stub files
  that fail in bulk under load are assigned to it; the lane runs in CI; the
  runner's own workflow-structure test asserts the new lane; a loaded local
  full-suite run no longer shows the bulk tutor-stub failure mode.
claim_status: methods
links:
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

Tutor-stub tests fail in bulk when the machine is loaded and pass when re-run
alone. Nothing in the runner serializes them: the only tutor-stub-specific
line is a shard pin for one file, placed for critical-path timing, not flake
control. CI never lowers Node's default per-CPU test concurrency. The only
isolation lanes that exist are the hand-enumerated pty and lifecycle lists in
package.json — the right pattern, wrong scale.

The fix: make lanes declarative in the hermetic test manifest (the manifest
already governs inventory and allowed skips), add a serial or
bounded-concurrency lane, assign the load-sensitive tutor-stub files, and
wire it into the CI workflow. The runner's workflow-structure test
(tests/hermeticTestRunner.test.js, near line 819) pins lane text and needs a
matching assertion. The runner's five-minute output-stall handling is
circumstantial evidence the failure mode is load, so a bounded lane should
remove it rather than hide it.

Suggested worker: Codex Sol at Extra High reasoning effort.
