---
id: scriptorium-creation-flows
title: Scriptorium creation flows for compose, launch, and job monitoring
status: triaged
type: ops
priority: P0
owner: unassigned
source: manual
created: 2026-06-23
updated: 2026-06-23
verification: Mock generation, mock derivation, replay dry-run, and score dry-run are launchable from guided UI flows with visible cost class, command preview, validation checklist, and job records.
links:
  notes: notes/poetics/2026-06-23-scriptorium-dashboard-ux-audit-plan.md
  items:
    - scriptorium-ux-safety-net
    - scriptorium-responsive-shell-navigation
tags:
  - scriptorium
  - ux
  - jobs
  - launcher
---

Context: `/runs` is safe and well-tested, but command-oriented; `/compose/live`
is more user-centered but still needs a clearer state model. This item turns
creation into guided product flows while preserving the raw command builder for
experts.

Acceptance criteria:
- [ ] Add a goal-first launcher for generate, replay, proof-DAG derivation,
      scoring, and curriculum drama.
- [ ] Keep current tabbed controls as an advanced command builder.
- [ ] Show recommended safe defaults, required fields, collapsed advanced fields,
      command preview, cost/quota badge, and validation checklist.
- [ ] Add a unified job center with status, logs, artifacts, retry/cancel where
      supported, and "open result".
- [ ] Clarify live-composer setup, live scene, scoring, and saved-artifact
      states.
- [ ] Preserve typed confirmation for metered paths.
