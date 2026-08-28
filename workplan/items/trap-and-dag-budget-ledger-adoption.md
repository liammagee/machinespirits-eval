---
id: trap-and-dag-budget-ledger-adoption
title: Complete budget-ledger adoption in trap and DAG launchers
status: review
type: infra
priority: P1
owner: claude
source: review
created: 2026-08-27
updated: 2026-08-28
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

- 2026-08-28 — Landed. One shared contract now covers all three launchers
  (`services/adaptiveTutor/meteredRunSession.js`), and the adaptive runner uses
  the same ledger binding and finalization rather than its own copy.
  - Ceilings: a malformed `--max-cost` stops the launcher before any work. The
    old `Number(raw) > 0` guard let `--max-cost abc` run the whole pilot
    unmetered.
  - Ledger: both trap launchers create the run before binding the ledger, so
    the ledger is keyed by a durable run id instead of the in-memory default
    that lost everything on restart.
  - id-director coverage: the engine's id, ego, plan, and verifier calls go
    through its injected `callAI`, which never routed via realLLM, so only the
    synthetic learner was charged. That call path is now wrapped, so every
    physical call reserves before dispatch.
  - Exhaustion: a budget error halts the run instead of being caught as an
    ordinary per-scenario failure and retried against the next unit; the run is
    then finalized (`halted_budget` / `halted_budget_ledger` / `completed`)
    rather than left at `running`.
  - Restart: both launchers record their plan and take `--resume <runId>`,
    refusing a foreign run or a changed ceiling and re-running only the planned
    units with no row.
  - DAG: a metered comparison keeps its isolated store, because the ledger and
    the run row live there and the default clean-up deleted them.
  Tests: `tests/meteredRunSession.test.js` (offline; the model call is a plain
  supplied function, the ledger a real SQLite store in a temp directory).
