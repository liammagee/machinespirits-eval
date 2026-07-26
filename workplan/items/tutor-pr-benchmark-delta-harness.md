---
id: tutor-pr-benchmark-delta-harness
title: Add persistent base-head delta QA to tutor PR benchmarks
status: done
type: infra
priority: P1
owner: codex
source: manual
created: 2026-07-26
updated: 2026-07-26
verification: "Added zero-call saved-candidate re-audits with pass, safety, and cluster deltas; added a clean detached-worktree base/head runner that hashes equivalent plans, alternates pair order, makes no retries, and preflights a 12-call strong budget; moved private reports under the Git common directory; replaced the broad tutorStub prefix with static import reachability plus explicit inputs. Verified by 44 focused benchmark and recent tutor-guard tests, full ESLint and Prettier checks, static import-cycle and hermetic-manifest checks, workplan source validation, diff hygiene, a real six-candidate zero-call re-audit, and a clean 12-call zero-call base/head preflight."
branch: codex/tutor-pr-benchmark-delta-harness
depends_on:
  - tutor-pr-frozen-prefix-benchmark
links:
  notes:
    - docs/tutor-pr-benchmark.md
tags:
  - tutor-stub
  - regression
  - pr-gate
  - calibration
milestone: adaptive-tutor-evidence-v1
---

Extend the lightweight tutor PR benchmark with two distinct comparison lanes:
model-free re-auditing of exact saved candidates and a bounded live base/head
generation comparison. Preserve private candidate reports outside disposable
linked worktrees, and replace the broad tutor-stub filename prefix in the local
hook with reachability from the benchmark entrypoint plus explicit non-code
inputs.

The live comparison is diagnostic engineering evidence: generations are not
seeded, so paired scheduling controls execution order but does not make the two
outputs counterfactually identical. Safety regressions remain explicit; quality
thresholds stay report-only until the benchmark and deterministic audits are
calibrated against human labels.

## Progress

- 2026-07-26: Created an isolated worktree from current `origin/main` and
  registered the bounded comparison, durable-artifact, and hook-relevance
  scope.
- 2026-07-26: Implemented exact-candidate re-audit comparison and exercised it
  against the saved `c8989eae` report: all six candidates remained failures
  under the refreshed current contract, with zero audit or safety regressions
  and zero model calls.
- 2026-07-26: Implemented the bounded base/head runner and verified its clean
  detached-worktree preflight at identical refs: the strong matrix resolves to
  12 calls, alternates base/head order, and records one shared plan fingerprint.
- 2026-07-26: Verified the same zero-call preflight across PR #251's actual
  mainline boundary (`315cbaed` to `eb85857d`): both revisions expose one
  equivalent six-job input plan and are eligible for a 12-call live comparison.
- 2026-07-26: Moved run, comparison, re-audit, and hook artifacts under the Git
  common directory; import-aware hook tests retain the recent uptake,
  composition, progression, and guard changes while excluding interim
  presentation-only changes.
- 2026-07-26: Closed after 44 focused tests, full lint and formatting, static
  import-cycle validation, hermetic test-manifest synchronization, workplan
  source validation, and diff hygiene passed.
