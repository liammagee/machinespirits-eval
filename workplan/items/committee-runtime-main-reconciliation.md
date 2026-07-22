---
id: committee-runtime-main-reconciliation
title: "Reconcile the committee's pinned runtime with main's guard regime"
status: review
type: infra
priority: P2
owner: unassigned
source: manual
created: 2026-07-22
updated: 2026-07-22
verification: "The Phase 5 pilot configuration (bland policy, strict_dag, proof_skipper, world-005) seals dialogues on MAIN's tutor-stub — either the 2026-07-17 live_turn_progression guard hardening gains a fix/mode for this configuration or its dead-end behavior is deliberately scoped — and the pinned-runtime-only patches (5b Amendment 1 prompt-model dedup recovery; any successor fixes) are backported so committee work no longer requires the frozen 91b8a50e-lineage worktree."
claim_status: planned
links:
  notes:
    - PROGRAM-2-PHASE5-LIVE-PILOT-PREREGISTRATION.md
    - PROGRAM-2-PHASE5B-FALLBACK-BATTERY-PREREGISTRATION.md
tags:
  - tutor-stub
  - runtime
  - guards
milestone: adaptive-tutor-evidence-v1
branch: main
---

All live committee results (5, 5b, 5c) run on a frozen worktree at the
91b8a50e claim-run lineage because main cannot run the configuration:
the 2026-07-17 guard hardening (V32-V34 arc:
live_turn_progression_v1 handoff_loses_turn_focus /
learner_uptake_not_realized) dead-ended 3/3 launch attempts at turns 2-3
even through the deterministic fallback (Phase 5 Amendment 1). This
divergence is currently untracked: the committee machinery itself is on
main (PR #137), but the runtime it can actually execute on is not, and
patches now flow one way into the pinned worktree (5b Amendment 1's
callPromptModel duplicate-line recovery, fed34fd0, exists only there —
main's prompt-model surfaces still hard-fail on endgame verdict echoes).

Reconcile in whichever direction the guard arc's owner prefers: teach
the hardened guards to pass the bland-policy/strict-dag configuration
(or scope them), backport the dedup recovery to main's callPromptModel,
and retire the standing worktree so future committee runs execute on a
current, tested main. Coordinate via notes/program-2/HANDOFF.md — the
guard arc belongs to another thread.

2026-07-22 Claude: IMPLEMENTED on main (branch
claude/committee-runtime-reconciliation): terminal-fallback advisory in
the guard-disposition catalog (conversational-integrity findings deliver
as recorded advisories on the deterministic-fallback attempt only;
evidence/unknown stay hard; draft-level 2026-07-17 semantics untouched) +
callPromptModel dedup backport. 29/29 guard tests incl. new
tutorStubGuardDisposition.test.js. Live confirm: the July dead-end
configuration (p5-01 seed) re-run on patched main. Guard-arc review
invited via HANDOFF H9. Pinned-runtime retirement deferred until the
phase5d thread seals (it runs on that lineage).
