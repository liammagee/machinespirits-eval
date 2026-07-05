---
id: agon-adversarial-game-ledger
title: Agon — adversarial tutoring game with an external referee ledger
status: active
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
(ego+superego), learner Sonnet 5, both via cliProviderBridge. Pilot is
descriptive (apparatus + directional A1−A0); no promotable claims at pilot n;
lands as a new §6.x of paper-full-2.0.md either way.
