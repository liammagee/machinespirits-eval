---
id: layered-human-handoff-probe
title: Layered adaptive tutor human/hybrid handoff probe
status: done
type: research
priority: P1
owner: codex
source: manual
created: 2026-07-01
updated: 2026-07-01
branch: codex/layered-human-handoff-probe
verification: "PR #73 merged; focused handoff tests and zero-paid human handoff probe passed with 8/8 controls, 0 public-only failures, 0 non-advisory rows, no proof-control behavior change, and no runtime routing or human-learning claim."
claim_status: scope-bound
links:
  notes: PLAN_2_0/layered_adaptive_tutor_technical_spec.md
  exports: exports/dramatic-derivation/layered-adaptation/human-handoff-probe-report.md
  items: layered-taskloop-heldout-gate
  prs: https://github.com/liammagee/machinespirits-eval/pull/73
tags:
  - adaptive-tutor
  - derivation
  - handoff
  - outer-loop
  - deployment-risk
---

Open the deployment adaptation loop as a local probe only. This item tracks an
advisory `HumanHandoffState` scaffold that consumes public signals and answers
whether a human or hybrid teacher-review action should be recommended.

Acceptance criteria:

1. Handoff inputs pass the same public-only audit used by the other layered
   adaptation scaffolds.
2. Recommendations remain advisory and cannot override hidden+proofDebt proof
   control or replace proof-control logs.
3. `npm run derivation:human-handoff-probe` passes deterministic controls for
   no-trigger, optional-review, human-followup, and high-affect-review cases.
4. The report claims only local deployment-risk classification, not actual
   learner routing, deployment safety, or human-learning evidence.

2026-07-01 Codex: Opened `codex/layered-human-handoff-probe` from refreshed
main after the task/session scaffold and held-out artifact gate merged. This is
task 4 of the layered outer-loop sequence and remains a local zero-paid probe.

2026-07-01 Codex: Implemented the public-only advisory handoff probe and moved
to review after validation passed. The zero-paid probe reports 8/8 deterministic
controls passing, with 0 public-only failures and 0 non-advisory rows. Passing
checks: focused handoff/task-loop tests, handoff probe, task-loop benchmark,
held-out task-loop gate, workplan check, `git diff --check`, and full
`npm test`.

2026-07-01 Codex: Opened PR #73 for review.

2026-07-01 Codex: Closed after PR #73 merged. Local lint now passes after
formatting `services/dramaticDerivation/humanHandoff.js`; the prior CI lint
failure was `npm run format:check`, not ESLint. The result remains a bounded
local advisory deployment-risk classification claim only: no learner routing,
no deployed safety coverage, no proof-control behavior change, and no
human-learning claim.
