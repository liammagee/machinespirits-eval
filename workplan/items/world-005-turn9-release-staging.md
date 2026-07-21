---
id: world-005-turn9-release-staging
title: "Fix world-005's turn-9 release staging (universal leak-audit trip)"
status: triaged
type: infra
priority: P3
owner: unassigned
source: manual
created: 2026-07-22
updated: 2026-07-22
verification: "The turn-9 leak signature is reproduced and diagnosed (which due premise's staging trips the leak audit at release-speed 1), the staging or audit interaction is fixed without changing the world's proof DAG or release schedule semantics, and a small re-run shows Marrick dialogues no longer carry the systematic turn-9 horizon leak in any arm."
claim_status: planned
links:
  paper: §6.21
  notes:
    - PROGRAM-2-PHASE5B-FALLBACK-BATTERY-PREREGISTRATION.md
tags:
  - drama-derivation
  - worlds
  - instrument
milestone: adaptive-tutor-evidence-v1
branch: main
---

Every hard-safety failure in the Phase 5/5b Marrick runs was a single
leak flagged at turn 9, in BOTH arms (Phase 5 controls 4/12, 5b fresh
controls 2/6, committee arms 4-5/12 each), and 4 of 5 leaky committee
turns were frontier-authored — a world/release-schedule property, not a
committee behavior. The 5c run on world_027 showed no analogue (safety
0.89/0.88), confirming it is Marrick-specific. It cost 5b its safety
guardrail (formal FAIL at 0.42 vs 0.61 with exonerating anatomy carried
in the prereg §8).

Diagnose which premise's due-window staging at release-speed 1 makes any
turn-9 mention flag as a leak, and fix the staging (or the audit's
interaction with it) without touching the proof DAG. Until fixed, any
Marrick run inherits a noisy safety guardrail; the 5b prereg's §8 note
stands: successors should fix the staging, not the committee.
