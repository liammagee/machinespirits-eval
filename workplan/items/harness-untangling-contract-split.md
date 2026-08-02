---
id: harness-untangling-contract-split
title: "Untangling 2: split the standing text into a safety contract and a teaching charter"
status: active
type: infra
priority: P2
owner: claude
source: manual
created: 2026-08-02
updated: 2026-08-02
verification: "Gate registered before any change: stage 1 — the two documents
  concatenated reproduce the current speaker prompt BYTE-EXACTLY (unit test
  pins it); no behavior change is permitted at this stage. Stage 2 (later,
  separately gated) — divergence: teaching-charter edits must leave a
  frozen-replay leak probe at zero, and safety edits must leave the
  repertoire scorecard unchanged."
claim_status: methods
depends_on:
  - adaptation-plan-3-phase-s
tags:
  - tutor-stub
  - harness
---

Phase S proved one block of standing text does two jobs: the leak rails
and the tutor's pedagogy are the same sentences. The split makes each
independently editable and independently testable. Assignment of every
rule, decided here:

**Safety contract** (what may never be said): planner ownership; the
speaking tutor receives only public material; never speculate about
withheld evidence; work only from public/current-turn evidence; the
public evidence rules (world glosses); no formal notation or internal
identifiers.

**Teaching charter** (which moves are licensed when): the ledger-term
conventions; do-not-demand-every-step; ask-for-bridges-only-when; the
HYPOTHESIS RULE (a guess stays a hypothesis until evidence licenses it)
— assigned to the charter BECAUSE Phase S showed it authors pedagogy
(it forbids the wager); its leak-relevant twin (never speculate about
withheld evidence) stays in safety, so moving the hypothesis rule
cannot open the leak channel; one-clue staging and its non-constraint
on learner reasoning; credit-the-chain; any per-turn exceptions (the
demand-card licence clause lives here).

The contested assignment is recorded as a decision, not a discovery:
hypothesis-handling = pedagogy; withheld-evidence = safety.
