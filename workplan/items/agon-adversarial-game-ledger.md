---
id: agon-adversarial-game-ledger
title: Agon — adversarial tutoring game with an external referee ledger
status: review
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-07-05
updated: 2026-07-05
branch: worktree-agon-game
verification: "Hermetic suite green (18 referee tests + exact-valued dry episode); real-CLI smoke passes P1/P2 apparatus bars; A0-vs-A1 pilot report generated from ledger JSON only."
claim_status: scope-bound
links:
  notes: AGON-GAME-PLAN.md
tags: [adaptive-tutor, agon, game, ledger, adversarial-learner]
---

Operator-sanctioned reframe of the adaptation problem after the outer-loop
and register-routing lines closed: treat the engagement as a game (learner
avoids demonstrating, tutor forces demonstrations), scored by a deterministic
referee that owns real hidden state — dodge budgets, well-posedness,
adjudications — disclosed to the tutor only in arm A1. Composes the two
ingredients that ever worked (machine-checkable external signal + adversarial
structure) at the environment level; the scoreboard is the anti-sycophancy
reward channel (in-context, no weight updates). Dodge taxonomy = the §6.8
concealment families; ledger = the DAG lineage. Tutor codex gpt-5.5
(ego+superego), learner Sonnet 5, both via cliProviderBridge.

PILOT DONE 2026-07-05 (`exports/agon/agon-pilot-01`, plan §7): apparatus
clean (9 episodes, ~350 CLI calls, 0 parse repairs/bounces/crashes; all
budgets extracted every episode). Disclosure lift NEGATIVE at pilot n:
A1 − A0 = −1.75 score, −0.25 demonstrations (A0 4/4 wins 6.75±0.50; A1 3/4
wins 5.00±2.00). Blind play already sits on the attrition attractor; A1
rationales contradict their own disclosed state (missed legal `c1_transfer`;
one error traces to our score-vs-winThreshold label — fix in v0.2). First
demonstration arrived by LEAK in 8/8: the persona collapses one-to-three
turns before rules compel it. Durable: zero-judge criterial measurement of
concealment-collapse + probe discipline.

A1′ RUN 2026-07-06 (`exports/agon/agon-pilot-02-a1p`, plan §7b prereg +
§7c result): action-set disclosure (legality projection per §6.13.11) —
ALL THREE frozen predictions PASS. Three-arm ordering A1′ 7.50±0.58 > A0
6.75±0.50 > A1 5.00±2.00; A1′ opp-miss 0.00 (vs 1.50/1.75), zero off-set,
zero wasted, REVISE rate 0.02; episodes 7/8/8/7 with 4/4 cashing
c1_transfer at t12 (the move A1 missed 4/4). One REVISE = deliberate
leak-bait that landed. Reading: pilot-01's negative was state-SHAPED
information failing the tutor's re-derivation, not information failing;
the same referee data re-represented as "what may I do now" was consumed
perfectly. Format boundary (state vs action projection), not tutor
intelligence; n=4/arm descriptive, no confirmatory bar at these estimates.
Lands as a new §6.x of paper-full-2.0.md.
