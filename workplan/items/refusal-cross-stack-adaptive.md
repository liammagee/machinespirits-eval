---
id: refusal-cross-stack-adaptive
title: "Exploration 5: cross-stack transfer — the refusal gate on the adaptive LangGraph runner"
status: done
type: experiment
priority: P2
owner: codex
source: manual
created: 2026-07-05
updated: 2026-07-26
branch: codex/refusal-cross-stack-adaptive
verification: "Cell 201 passes validate-config and the hermetic adaptive-cell smoke; npm run adaptive:smoke-strategy-refusal runs the frozen three-scenario state_policy +/- refusal pair with one resolved switch, zero false activations, and no DB writes; npm test and npm run lint pass."
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

**SCOPING NOTE (2026-07-06): NOT EXECUTED this cycle — propose-only, as
planned.** Options 2/3/6 completed as mechanism studies (defend-rate
rises with model tier and with an evidence-bearing peer voice; the
learner-side trigger is vacuous at the assertion channel); the promotion
run closed the outcome question NOT CONFIRMED, so this cross-stack port
would now be a pure mechanism-generalization study on a new stack — the
biggest build of the six for a bounded payoff. Executes only on a fresh
operator decision. Standing traps if picked up: use the smoke scripts
with ADAPTIVE_TUTOR_LLM=mock for zero-DB validation (eval-cli --dry-run
WRITES the prod DB), and expect the refusal analogue to need the
runner's own trap-fire events as its criterial signal, not the
derivation stack's regressions.

2026-07-26 Codex: Activated after explicit operator confirmation in a fresh
current-main worktree. Implementation is restricted to the adaptive runner's
native trap signals and deterministic mock-mode verification; no paid run is
licensed by this activation.

2026-07-26 Codex: Implemented `cell_201_adaptive_strategy_refusal` and the
bounded refusal gate. The deterministic paired v1 smoke produced 0/3 strict
matches for the baseline and 1/3 for the refusal arm, with exactly one resolved
switch and zero false activations. This verifies the mechanism path only; it is
not an efficacy claim and no paid run was performed.
