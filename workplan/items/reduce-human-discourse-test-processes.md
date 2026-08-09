---
id: reduce-human-discourse-test-processes
title: Reduce redundant human-discourse test process launches
status: done
type: infra
priority: P2
owner: codex
source: manual
created: 2026-08-09
updated: 2026-08-09
branch: codex/reduce-human-discourse-test-processes
verification: >-
  An unrestricted 25.99s isolated baseline versus 23.00s and 23.25s cached
  reruns shows lower human-discourse latency while all three pass 43/43 tests;
  the comprehensive hermetic root/core suites, retained CLI/PTY boundaries,
  exact accounting, lint, formatting, workplan, and diff checks all pass.
claim_status: planned
depends_on:
  - optimize-local-node-execution
links:
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/599
  items:
    - optimize-local-node-execution
    - calibrate-local-node-test-concurrency
tags:
  - node
  - local-development
  - testing
  - subprocess
  - tutor-stub
milestone: evaluation-infrastructure
---

Profile `tests/tutorStubHumanDiscourseLayer.test.js` and eliminate exact
duplicate full-CLI launches. Replace a launch with a direct in-process contract
only where an existing exported boundary preserves the assertion; otherwise
retain the real CLI or PTY path for entrypoint, stream, signal, and terminal
behavior.

Acceptance:

- Record an unrestricted isolated baseline with exact test and failure counts.
- Inventory every `execFileSync`, `spawnSync`, `spawn`, and `node-pty` launch in
  the file and classify whether the process boundary is part of the contract.
- Refactor only cases whose assertions can use an existing exported parser,
  configuration builder, or command handler without weakening behavior.
- Retain end-to-end coverage for npm entrypoint defaults, interactive streams,
  PTY behavior, signals, and process exit status.
- Demonstrate a meaningful isolated-file improvement and no regression in the
  comprehensive hermetic root suite before changing further slow-test files.
- Keep production evaluation stores, generated workplan views, model-backed
  workflows, and tutor behavior unchanged.

Log:

- 2026-08-09 — Activated after concurrency calibration rejected a hard-coded
  worker count. In the valid default/14 profiles, the human-discourse file took
  33.07–33.13 seconds and was consistently the second-slowest root test file.
- 2026-08-09 — The unrestricted isolated baseline passed 43/43 tests in 25.99s.
  The file performs 50 process launches: 23 dry-run invocations and 27 direct
  feature, npm-entrypoint, stream, interactive-command, exit-status, or PTY
  launches. Fifteen dry-run inputs are unique; exact base, automated-learner,
  and mixed-learner duplicates account for eight redundant Node processes.
- 2026-08-09 — Added immutable test-local caching only for identical dry-run
  inputs. Every unique dry-run still crosses the real CLI process boundary, and
  all 27 feature/npm/stream/interactive/exit/PTY launches remain unchanged.
- 2026-08-09 — Two unrestricted after-runs passed 43/43 tests in 23.00s and
  23.25s, averaging 23.13s versus the 25.99s baseline: an 11.0% isolated
  reduction. The comprehensive gate then passed 638 root files / 8,156 tests
  and 11 tutor-core files / 137 tests with zero failures and skips. Its 114.17s
  total ran under different contemporaneous machine load and is retained as
  correctness evidence, not used for the performance estimate.
- 2026-08-09 — Review checks pass: cached ESLint, cached Prettier, 471/471
  workplan sources, and `git diff --check`. No production tutor code, generated
  board views, evaluation data, or model-backed workflow changed.
- 2026-08-09 — PR #599 merged as `cd8b3161`. The retained isolated comparison
  and complete correctness gate satisfy the card's acceptance criteria, so the
  redundant-process slice is done.
