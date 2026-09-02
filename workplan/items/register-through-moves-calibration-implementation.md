---
id: register-through-moves-calibration-implementation
title: Implement and dry-run the register-through-moves calibration
status: triaged
type: experiment
priority: P3
owner: unassigned
source: review
created: 2026-09-01
updated: 2026-09-01
verification: >-
  A zero-call dry-run expands exactly 24 balanced jobs from the merged design,
  proves baseline/pressing and warm/sarcastic separation, emits the registered
  trace and two-reader plans, checks every gate and the 6,240-attempt ceiling,
  and cannot initialize a provider without the standing launch authorities.
claim_status: future
depends_on:
  - register-through-moves-design
links:
  items:
    - register-through-moves-design
  notes:
    - config/tutor-stub-register-through-moves-calibration-design.v1.json
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/924
tags:
  - tutor-stub
  - register
  - negative-register
  - study-implementation
  - zero-call
---

## Scope

Implement the merged calibration design without changing its question, arms,
trigger, thresholds, routes, seed, endpoints, dispositions or ceiling. The
design file is authoritative; this card links to it rather than restating it.
No historical dialogue, reader label or closed register result may be altered,
reused or pooled.

## Acceptance

- Add the study-local deterministic pressing policy while leaving baseline-arm
  behavior unchanged.
- Build the exact seeded 24-job balanced plan and persist register assignment,
  move assignment, trigger, delivery, hold state and proof trajectory in
  separate trace fields.
- Add the blinded two-reader packet/pass and a zero-call analyzer that reports
  every registered eligibility, delivery, agreement, safety and endpoint gate.
- Admit the launcher through `services/paidStudyLaunchContract.js`, use
  create-once destinations and the append-only attempt ledger, and register it
  in `config/paid-study-launcher-inventory.json`.
- Add focused tests for arm separation, private-proof redaction, reader
  blinding, exact job count, ceiling arithmetic and provider-free dry-run.
- Run the dry-run only. Stop with model calls at zero and hand the operator a
  plain readiness result.

## Boundary

Completion means the calibration is technically ready for an operator
decision. It does not create a GO note, authorize the 6,240 attempts, launch a
dialogue or reader, or authorize the separately designed confirmatory stage.
