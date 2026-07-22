---
id: tutor-stub-learner-budget-overflow
title: "Fix the auto-learner prompt-budget overflow in long dialogues"
status: triaged
type: infra
priority: P1
owner: unassigned
source: manual
created: 2026-07-22
updated: 2026-07-22
verification: "Long until-grounded dialogues (affective_resistant, 25+ turns) no longer die on 'tutor_stub_auto_learner: character_budget_exceeded' — the learner seam truncates or summarizes its replayed history budget-aware before the audit — demonstrated by a re-run of a previously-failing seed sealing on first attempt, with a regression test on the truncation rule; fix applied to main and noted for any pinned-runtime successor."
claim_status: planned
links:
  notes:
    - PROGRAM-2-PHASE5-LIVE-PILOT-PREREGISTRATION.md
    - PROGRAM-2-PHASE5B-FALLBACK-BATTERY-PREREGISTRATION.md
tags:
  - tutor-stub
  - reliability
milestone: adaptive-tutor-evidence-v1
branch: main
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
learner's replayed history before the prompt audit, mirroring how the
tutor side already bounds history (--history-turns). Fix on main first;
any successor pinned runtime cherry-picks it the way the 5b Amendment-1
dedup patch was.
