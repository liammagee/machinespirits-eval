---
id: adaptive-warrant-contract-redesign
title: "Adaptive warrant gate: expected-uptake and policy-termination contracts"
status: active
type: research
priority: P1
owner: codex
source: manual
created: 2026-08-10
updated: 2026-08-10
verification: Each action family exposes a typed expected learner response,
  deadline, success, defeat, and expiry/exit transition; successful repair exits
  and unresolved evidence requests have live/offline parity tests; a newly
  generated zero-overlap two-reader corpus passes a predeclared decision-quality
  gate before any downstream scale-up; and the next comparison controls
  model-draw variance through frozen-prefix replay or explicit replicated draws.
claim_status: planned
links:
  notes:
    - docs/adaptation-refinement/remaining-next-steps.md
    - docs/adaptation-refinement/normative-adaptive-dialogue-architecture.md
    - docs/adaptation-refinement/baseline-comparison-design.md
  items:
    - adaptive-warrant-baseline-study
tags:
  - tutor-stub
  - adaptation
  - warrant-gate
  - expected-uptake
  - counterfactual-replay
branch: adaptation-refinement
---

The n=5 baseline study stopped because generic accumulated trouble cannot
distinguish a repair that has succeeded and should terminate from an analytic
learner whose specific request for missing evidence remains unanswered.

Implement the missing action-family contract before changing numeric
thresholds again. Validate diagnosis and transition choice on fresh decisions
first. Only then redesign the downstream comparison so an inert observe arm's
stochastic movement cannot be mistaken for an intervention effect.

## Log

- 2026-08-10 — Implemented typed lifecycle contracts for all 13 action
  families in the shared live/offline path, extended the harness and v2 scorer,
  and added focused parity and lifecycle tests.
- 2026-08-10 — Completed the fresh 9-dialogue/72-turn validation run and froze
  a zero-overlap 18-case corpus (SHA-256 `8ad4e43d...4938117`). Two new blind
  readers completed all cases before unblinding.
- 2026-08-10 — Predeclared gate failed: agreement 0.778; precision 0.500;
  recall 0.286; accuracy 0.500; successor accuracy 0/4; parity 41/42. The
  downstream comparison was stopped. A post-freeze offline turn-1 priming bug
  was fixed and regression-tested without altering the frozen score.
- 2026-08-10 — Error audit moved the next architectural work to the successor
  public-obligation-ledger/inquiry-termination card. This item stays active
  because its verification required a passing fresh gate; the implementation
  exists, but the policy is not decision-valid.
