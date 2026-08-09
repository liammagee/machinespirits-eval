---
id: adaptive-warrant-contract-redesign
title: "Adaptive warrant gate: expected-uptake and policy-termination contracts"
status: triaged
type: research
priority: P1
owner: unassigned
source: manual
created: 2026-08-10
updated: 2026-08-10
verification: "Each action family exposes a typed expected learner response, deadline, success, defeat, and expiry/exit transition; successful repair exits and unresolved evidence requests have live/offline parity tests; a newly generated zero-overlap two-reader corpus passes a predeclared decision-quality gate before any downstream scale-up; and the next comparison controls model-draw variance through frozen-prefix replay or explicit replicated draws."
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
---

The n=5 baseline study stopped because generic accumulated trouble cannot
distinguish a repair that has succeeded and should terminate from an analytic
learner whose specific request for missing evidence remains unanswered.

Implement the missing action-family contract before changing numeric
thresholds again. Validate diagnosis and transition choice on fresh decisions
first. Only then redesign the downstream comparison so an inert observe arm's
stochastic movement cannot be mistaken for an intervention effect.
