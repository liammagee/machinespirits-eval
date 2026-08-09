---
id: reduce-interactive-turn-test-latency
title: Reduce interactive tutor-turn test latency
status: done
type: infra
priority: P2
owner: codex
source: manual
created: 2026-08-09
updated: 2026-08-09
branch: codex/reduce-interactive-turn-test-latency
verification: >-
  Two unrestricted isolated before-runs averaged 25.01s and two after-runs
  averaged 19.58s, a 21.7% reduction while all passed 16/16 tests; provider,
  PTY-cohort, comprehensive hermetic root/core, lint, formatting, workplan,
  manifest, and diff checks preserve every interactive contract.
claim_status: planned
depends_on:
  - optimize-local-node-execution
links:
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/604
  items:
    - optimize-local-node-execution
    - calibrate-local-node-test-concurrency
    - reduce-human-discourse-test-processes
    - reduce-first-draft-outer-loop-test-time
tags:
  - node
  - local-development
  - testing
  - subprocess
  - pty
  - tutor-stub
milestone: evaluation-infrastructure
---

Profile `tests/tutorStubInteractiveTurns.test.js`, then reduce repeated startup
or setup work only where the process boundary is not itself the contract. Keep
real child processes for interactive streams, cancellation, signals, exit
status, and PTY key handling.

Acceptance:

- Record two unrestricted isolated baselines with exact file, test, failure,
  and skip counts.
- Attribute time among Node/tutor-stub startup, fake-Codex installation and
  calls, ordinary pipe sessions, PTY sessions, and intentional fixture delays.
- Preserve at least one end-to-end process test for every distinct interactive
  contract: history replay, recovery, compound turns, `/use`, feedback, reset,
  demo, late fragments, quit summary, model switching, and raw key handling.
- Do not introduce within-file concurrency unless repeated full-suite evidence
  shows it improves the root critical path without PTY flakiness or resource
  oversubscription.
- Demonstrate a meaningful repeated isolated improvement and pass the complete
  hermetic root/core suites before changing another slow-test file.
- Keep tutor behavior, production evaluation stores, generated workplan views,
  and model-backed workflows unchanged.

Log:

- 2026-08-09 — Activated after PR #601 reduced the first-draft outer-loop file
  by 69.8%. Across four retained same-checkout profiles, this 16-test file took
  26.57–31.84 seconds with a 29.53-second median, making it the slowest
  consistent remaining root-test bottleneck.
- 2026-08-09 — Two unrestricted isolated baselines passed 16/16 tests in
  25.23s and 24.78s. Per-test TAP timing attributed 11.03s, 45% of the file, to
  two restart races with padded 800ms and 2.2s fake-Codex delays; aggregate
  user CPU was only about 10.3s, confirming wait time rather than computation
  as the primary opportunity.
- 2026-08-09 — Added a test-context-only fake-Codex start log to the finite CLI
  provider environment allowlist. The compound-turn test now sends its second
  fragment only after the external fake process has definitely started instead
  of guessing with a 200ms timer. Both restart fixtures retain 500ms response
  delays, preserving an in-flight cancellation window while removing seconds
  of unrelated waiting.
- 2026-08-09 — Two corrected after-runs passed 16/16 tests in 19.55s and 19.60s,
  averaging 19.58s versus the 25.01s baseline: a 21.7% wall-time reduction.
  The finite provider allowlist passed 30/30 tests and the complete five-file
  interactive PTY cohort passed 50/50 with zero failures or skips.
- 2026-08-09 — The complete hermetic gate passed 639 root files / 8,164 tests
  and 11 tutor-core files / 137 tests with zero failures or skips. The
  interactive-turn file took 31.84s under contemporaneous full-suite load, so
  that run is retained as correctness evidence only; the performance estimate
  remains the repeated same-file isolated comparison.
- 2026-08-09 — PR #604 merged as `70ea18fe`. The isolated improvement and full
  provider/PTY regression coverage satisfy the acceptance criteria, so the
  interactive-turn latency slice is done.
