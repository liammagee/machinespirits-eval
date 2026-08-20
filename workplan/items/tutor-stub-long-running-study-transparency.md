---
id: tutor-stub-long-running-study-transparency
title: Make long-running tutor-stub study state transparent
status: done
type: infra
priority: P1
owner: codex
source: manual
created: 2026-08-19
updated: 2026-08-19
verification: Focused deterministic status tests prove six-unit accounting, partial-JSONL tolerance, byte-for-byte fixture immutability, no provider invocation, human and JSON output, then source-only workplan and skill-sync checks pass.
branch: codex/tutor-stub-study-transparency
links:
  code:
    - AGENTS.md
    - .codex/skills/ms-tutor-stub-eval/SKILL.md
    - scripts/report-tutor-stub-study-status.js
tags:
  - tutor-stub
  - observability
  - status
  - zero-call
milestone: evaluation-infrastructure
---

Add one evidence-backed, zero-call status surface for long-running tutor-stub
studies and make its reporting cadence and content explicit for agents.

Acceptance:

- Agent and tutor-study skill contracts require plain-language stage and
  interval updates with model, unit, turn, call, repair, drift, blocker, next
  action, stopping-condition, and human-decision fields.
- A read-only command reports plan, trace, budget, repair, seal, and last-event
  state in concise human and JSON forms without claiming unverifiable process
  activity.
- A deterministic six-unit technical-stop fixture proves two complete, one
  failed at turn 7/8 after 48 calls, three missing, 104/288 completed calls,
  zero provider failures, profile-repair activity, no registered verdict, and
  an unresolved continuation/recovery boundary.
- Focused checks pass with no model/provider calls and no study-artifact writes.

Out of scope:

- Recovery, analysis, registration, budget, provider-routing, workflow,
  manifest, hook, or live-study changes.

Log:

- 2026-08-19 — Activated from current HTTPS `origin/main` on the dedicated
  `codex/tutor-stub-study-transparency` worktree; implementation is explicitly
  zero-call and excludes all current study artifacts and processes.
- 2026-08-19 — Added the agent contract, canonical tutor-study skill template,
  and read-only human/JSON reporter. The deterministic shared-profile fixture
  proves 2 complete / 1 failed / 3 missing units, turn 7/8 and 48-call failure
  accounting, 104/288 aggregate calls, partial-JSONL tolerance, profile repair,
  adherence exhaustion, no registered verdict, and the unresolved recovery
  boundary.
- 2026-08-19 — Verification passed: 7/7 focused tests (including fixture tree
  byte preservation and provider-command trap), focused ESLint and Prettier,
  521/521 source workplan items, skill-sync validation, syntax, and diff checks;
  no model/provider call or live-study mutation occurred.
