---
id: reduce-character-dag-test-latency
title: Reduce Character-DAG framework test latency
status: done
type: infra
priority: P2
owner: codex
source: manual
created: 2026-08-09
updated: 2026-08-09
branch: codex/reduce-character-dag-test-latency
verification: >-
  Two unrestricted isolated before-runs averaged 18.29s and two after-runs
  averaged 4.87s, a 73.4% reduction while all passed 13/13 tests; terminal-state
  equivalence, focused adaptive coverage, counterfactual smoke, comprehensive
  hermetic root/core, lint, formatting, workplan, manifest, and diff checks pass.
claim_status: planned
depends_on:
  - optimize-local-node-execution
links:
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/609
  items:
    - optimize-local-node-execution
    - calibrate-local-node-test-concurrency
    - reduce-human-discourse-test-processes
    - reduce-first-draft-outer-loop-test-time
    - reduce-interactive-turn-test-latency
tags:
  - node
  - local-development
  - testing
  - character-dag
  - tutor-stub
milestone: evaluation-infrastructure
---

Profile `tests/characterDagDramaFramework.test.js`, then remove repeated
in-process fixture, scenario, or artifact work only where every distinct mock
framework and robustness contract remains covered. Do not shrink the tested
arm, scene, seed, family, perturbation, checkpoint, or artifact inventories.

Acceptance:

- Record two unrestricted isolated baselines with exact file, test, failure,
  and skip counts.
- Attribute time among fixture parsing/validation, scenario construction, mock
  interaction execution, aggregation, checkpointing, and artifact writing.
- Reuse only immutable inputs or exact duplicate deterministic computations;
  return isolated values wherever tests mutate fixtures or reports.
- Preserve all 13 tests and their current framework, robustness, negative
  control, transfer, peripeteia, checkpoint/resume, and claim-boundary checks.
- Demonstrate a meaningful repeated isolated improvement and pass the complete
  hermetic root/core suites before proposing another slow-test slice.
- Keep production tutor behavior, evaluation stores, generated workplan views,
  model-backed workflows, and empirical claims unchanged.

Log:

- 2026-08-09 — Activated after PR #604 reduced isolated interactive-turn test
  latency by 21.7%. Four retained same-checkout profiles place this 14-test file
  at a 23.71-second median (20.33–27.77s), and the latest comprehensive run
  observed 38.97s under full-suite contention, making it the clearest remaining
  root critical-path candidate.
- 2026-08-09 — Two unrestricted isolated baselines on current merged main
  passed 13/13 tests in 18.34s and 18.24s. The CPU profile attributed the hot
  path to LangGraph `MemorySaver` JSON serialization, checkpoint revival, and
  history reconstruction; fixture parsing and artifact writes were negligible.
- 2026-08-09 — Added an explicit `runScenarioFinal()` boundary that compiles
  without a checkpointer for batch consumers that need only terminal state.
  Character-DAG now uses it while the existing history-returning runner remains
  unchanged for counterfactuals and history-aware tests. A deterministic
  regression compares checkpointed and final-only dialogue, intervention
  ledger, and adaptation trace exactly.
- 2026-08-09 — Two after-runs passed 13/13 tests in 5.34s and 4.39s, averaging
  4.87s versus the 18.29s baseline: a 73.4% isolated wall-time reduction. The
  focused Character-DAG/adaptive-runner cohort passed 21/21 with zero failures
  or skips, and the history-dependent counterfactual smoke also passed.
- 2026-08-09 — The complete hermetic gate passed 641 root files / 8,172 tests
  and 11 tutor-core files / 137 tests with zero failures or skips. Character-DAG
  dropped out of the eight slowest files; the remaining leaders are previously
  measured subprocess/PTY-heavy cohorts, so this series stops here rather than
  widening into speculative or coverage-weakening changes.
- 2026-08-09 — PR #609 merged as `1b92467c` with all ten hosted checks green.
  The terminal-state equivalence proof and repeated 73.4% improvement satisfy
  the card's acceptance criteria, completing the local Node speedup series.
