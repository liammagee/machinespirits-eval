---
id: refusal-cross-stack-adaptive
title: "Exploration 5: cross-stack transfer — the refusal gate on the adaptive LangGraph runner"
status: triaged
type: experiment
priority: P2
owner: unassigned
source: manual
created: 2026-07-05
updated: 2026-07-05
branch: worktree-strategy-ledger-followups
verification: "Scoped implementation plan validated against services/adaptiveTutor/; a trap-suite smoke with strategy_shift_correctness as the native endpoint; reads pre-stated before any paid run."
claim_status: exploratory
links:
  items: [content-compulsion-promotion]
tags: [adaptive-tutor, langgraph, strategy-refusal, cross-stack]
---

Does the mechanism survive an architecture change? The adaptive runner
(services/adaptiveTutor/, cells 110-113/124) natively scores
strategy_shift_correctness on trap scenarios — an endpoint BUILT for
exactly this behavior. PLAN: (1) map the runner's decision loop (graph.js
/ policyActions.js) for the incumbent-strategy analogue (its state-policy
choice) and its criterial failure signal (trap-fire events); (2)
implement a refusal node: when the policy repeats a choice after a trap
has fired against it, one refusal demanding defend-or-switch (same
bounded resolution); (3) mock-mode gates (ADAPTIVE_TUTOR_LLM=mock, zero
DB writes via smoke scripts — NOT eval-cli --dry-run, which writes the
prod DB); (4) smoke: cell_110-style config +/- refusal on the v1 trap
suite, 3 scenarios paired, strategy_shift_correctness as the read.
COST: the biggest engineering item of the six (new stack); execute after
options 2/3/6 unless the operator reprioritizes. The §6.8 corrected
baseline (~1.4x cross-suite) is the comparison context.
