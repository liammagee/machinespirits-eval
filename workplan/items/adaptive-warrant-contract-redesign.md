---
id: adaptive-warrant-contract-redesign
title: "Adaptive warrant gate: expected-uptake and policy-termination contracts"
status: done
type: research
priority: P1
owner: codex
source: manual
created: 2026-08-10
updated: 2026-08-18
verification: >-
  Typed lifecycle contracts were implemented for all 13 action
  families and exercised with live/offline checks; the fresh two-reader gate
  failed its predeclared decision-quality thresholds, the downstream comparison
  stopped, and the missing public-obligation and inquiry semantics transferred
  to the separately completed scope-bound successor without a policy-validity
  claim for this card.
claim_status: scope-bound
links:
  notes:
    - docs/adaptation-refinement/remaining-next-steps.md
    - docs/adaptation-refinement/normative-adaptive-dialogue-architecture.md
    - docs/adaptation-refinement/baseline-comparison-design.md
  items:
    - adaptive-warrant-baseline-study
    - adaptive-warrant-public-obligation-ledger-and-inquiry-termin
    - resistance-action-register-integration
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
  public-obligation-ledger/inquiry-termination card. The implementation exists,
  but the policy is not decision-valid under this failed gate.
- 2026-08-18 — Board reconciliation closes this card as a negative,
  scope-bound result rather than leaving a failed passage criterion permanently
  active. No passing-gate or downstream-effect claim is added; future
  composition work belongs to `resistance-action-register-integration`.
