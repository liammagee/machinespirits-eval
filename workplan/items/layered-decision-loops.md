---
id: layered-decision-loops
title: Strategy Ledger v1 — per-agent commit/audit loops at block/scene/act scope
status: active
type: research
priority: P1
owner: human
source: manual
created: 2026-07-02
updated: 2026-07-02
verification: "Design review accepted; Phase-0 wiring (exit-condition checks, live opportunity counters, block segmentation, mode hold) passes zero-paid gates with proof-control fingerprints byte-identical ledger-on vs ledger-off; scene/learner commitment phases pre-registered before any paid contrast."
claim_status: planned
links:
  notes: LAYERED-DECISION-LOOPS-PLAN.md
  items:
    - layered-task-session-adaptation
    - layered-taskloop-heldout-gate
tags:
  - adaptive-tutor
  - derivation
  - outer-loop
  - strategy-ledger
  - symmetry
---

Review finding (2026-07-02, full detail in `LAYERED-DECISION-LOOPS-PLAN.md`): the
four adaptation scopes (turn/dialogue_block/scene/act) exist as vocabulary,
offline-gated library functions, and advisory prompt lines — but the live drama
loop makes strategy decisions (register, information-release posture, didactic
mode) only per turn, except the acts-mode plot/throughline stack. dialogue_block
has no live implementation; scope fields are labels on last-utterance regex
classifiers; exit conditions are never checked; the learner owns no strategy at
any scope.

Proposal: generalize the proven commit-at-opening / audit-at-close pattern (C1
plot + throughline) down to scene and block scope and across to the learner —
one strategy-ledger row shape for both agents, conduct-binding at scene scope,
proof-advisory always (A20/A21 discipline).

Phases:

1. Phase 0 — wiring debts: check exit conditions (deterministic markers),
   maintain opportunity-cost counters live, segment blocks from exchange
   episodes, hold didactic mode stable within a block.
2. Phase 1 — tutor boundary decisions: scene-opening commitment fields in the
   existing ego call (register from palette, didactic default, release posture,
   recognition budget) held by the harness for the scene; scene-close audit;
   block-failure escalation.
3. Phase 2 — learner symmetry: learner scene commitments + act carry-forward
   verdicts (the structural mirror-verdict lever); learner superego audits at
   boundaries, not per turn.
4. Phase 3 — pre-registered contrasts E1 (persistence), E2 (register as
   decision), E3 (learner ledger), with proof-fingerprint and negative-transfer
   guardrails. Results fold into paper-full-2.0.md §6.13.x/§6.16.

Non-goals: proof-authority changes, task/session sequencing (stays archived),
handoff activation, ToM layers, new rubrics.
