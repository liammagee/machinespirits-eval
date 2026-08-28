---
id: trap-and-dag-budget-ledger-adoption
title: Complete budget-ledger adoption in trap and DAG launchers
status: triaged
type: infra
priority: P1
owner: unassigned
source: review
created: 2026-08-27
updated: 2026-08-27
verification: Mocked launcher tests show every id-director tutor/id/plan/verifier
  call and every dialogue/DAG metered attempt reserves through the shared
  ledger, invalid ceilings fail before work, budget exhaustion halts and
  finalizes the run, usage is persisted honestly, and a durable restart keeps
  prior exposure without rerunning completed units.
claim_status: methods
links:
  items:
    - budget-tracker-balance-probe-and-rates
tags:
  - adaptive-tutor
  - spend-ceiling
  - id-director
  - dag-resistance
depends_on:
  - budget-tracker-balance-probe-and-rates
---

Adopt the shared ledger at every physical metered-call boundary in the
id-director trap pilot, dialogue-engine trap baseline, and DAG-resistance
comparison. Today the id-director tracker covers only synthetic learner calls,
the direct scripts can continue after budget exhaustion, and the DAG runner's
temporary store is deleted by default. Give each launcher a durable run
identity, fail closed on invalid ceilings or ledger persistence, halt
immediately on exhaustion, finalize status/usage, and resume missing units only.
