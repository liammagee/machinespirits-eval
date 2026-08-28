---
id: budget-tracker-balance-probe-and-rates
title: "Budget tracker: balance probe, rate-table freshness, resume persistence"
status: triaged
type: infra
priority: P2
owner: codex
source: manual
created: 2026-08-27
updated: 2026-08-27
verification: A run started with --max-cost probes the provider credit balance
  first where the provider exposes one and warns or stops when the ceiling
  exceeds it; the hardcoded price table carries a dated freshness assertion
  that fails loudly when stale instead of silently mispricing; accumulated
  spend persists so a resumed run continues its ceiling rather than restarting
  at zero; the real-LLM budget tests cover all three behaviors.
claim_status: methods
links:
  notes:
    - services/adaptiveTutor/budgetTracker.js
    - services/adaptiveTutor/realLLM.js
tags:
  - adaptive-tutor
  - spend-ceiling
  - codex-sol
  - effort-ultra
---

Three related gaps in the spend ceiling, one long known:

1. `--max-cost` only sums in-process spend. It never asks the provider for
   the remaining credit balance, so a ceiling above the real balance gives
   false comfort (the standing note on this dates to the A-series runs).
2. The per-1K-token price table is a literal marked "Approximate Q1-2026".
   Unknown models fall back to a default, and the real-LLM path uses the same
   table to synthesize costs for providers that return none — so a stale rate
   corrupts the accumulated total itself, against the module's own header
   claim that total spend is always truthful.
3. The tracker is per-process. A crash or a resumed run restarts the ceiling
   at zero.

Entry points that thread `--max-cost`: eval-cli, the DAG-resistance
comparison runner (which already requires the flag for real-LLM runs), and
the id-director trap pilot. The spend ceiling is one of the few rails the
authorization hard rule says to keep — this card makes it true, it adds no
gate.

Suggested worker: Codex Sol at Ultra reasoning effort. The hard spend ceiling
crosses provider behavior, rate provenance, and crash-safe persisted state, so
the design and failure-mode audit deserve the higher tier.
