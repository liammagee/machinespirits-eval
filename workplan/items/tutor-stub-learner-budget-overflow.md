---
id: tutor-stub-learner-budget-overflow
title: "Fix the auto-learner prompt-budget overflow in long dialogues"
status: done
type: infra
priority: P1
owner: codex
source: manual
created: 2026-07-22
updated: 2026-07-22
verification: "The archived p5c-14 turn-32 prompt reproduces the exact 24,468-character auto-learner audit failure and re-audits at 6,986 characters after public-only windowing; a 10-turn no-model CLI regression crosses the budget at turn 9, completes with repeated recoveries and zero auto-learner audit failures; short-run full replay remains unchanged; the pinned-runtime successor cherry-pick is explicitly noted."
claim_status: planned
links:
  notes:
    - PROGRAM-2-PHASE5-LIVE-PILOT-PREREGISTRATION.md
    - PROGRAM-2-PHASE5B-FALLBACK-BATTERY-PREREGISTRATION.md
tags:
  - tutor-stub
  - reliability
milestone: adaptive-tutor-evidence-v1
branch: codex/steps1-2
---

The costliest reliability defect of the live program: the automated
learner's prompt grows with dialogue history until it exceeds the
character/token budget audit, killing the dialogue at turns 19-30 — after
nearly all its paid calls are spent. Ledger across the three live runs:
8 of the program's ~10 retries (Phase 5: 6 retries; 5b: 2) and the
program's ONLY attrition (5c p5c-14, deterministic — both attempts
overflowed at the same point). Each failed attempt burns a nearly
complete dialogue of sonnet + terra quota.

The failure is deterministic given a long-enough dialogue, so the fix is
seam-local: budget-aware truncation (or windowed summary) of the
learner's replayed history before the prompt audit, reusing the
`--history-turns` recent-window setting without changing tutor replay. Fix on main first;
any successor pinned runtime cherry-picks it the way the 5b Amendment-1
dedup patch was.

Implementation validation on `codex/steps1-2` replays the archived
`p5c-14-proof_skipper-committee-r5` turn-32 prompt shape without a model
call. Its original 63-message replay reproduces the exact failed audit
(24,468 characters / 6,117 approximate tokens); the public-only fallback
keeps the latest 9 messages, marks 54 omitted messages, and re-audits at
6,986 characters / 1,747 approximate tokens. The regression suite also
proves that fitting short dialogues remain byte-for-byte full replays.
The pinned 91b8a50e-lineage runtime still needs this main-line patch
cherry-picked before any successor claim run.

2026-07-22 Codex: Implemented the audited fallback, trace accounting,
CLI/run-provenance documentation, short/long unit coverage, and a no-model
10-turn integration regression. Required prompt/world quality checks, focused
tests, ESLint, and the full repository suite pass after the related live-board
curriculum test was made independent of any one card remaining open.
