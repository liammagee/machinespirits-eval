---
id: scriptorium-p2-best-of-breed-cockpit-features
title: Scriptorium P2 best-of-breed cockpit features
status: done
type: ops
priority: P1
owner: codex
source: manual
created: 2026-06-23
updated: 2026-06-24
verification: Command palette, job-center links, evidence graph, comparison
  workbench permalinks, and saved-view restoration pass targeted tests plus the
  Scriptorium UX smoke.
links:
  notes: notes/poetics/2026-06-23-scriptorium-dashboard-ux-audit-plan.md
  items:
    - scriptorium-creation-flows
    - scriptorium-evidence-workbenches
    - scriptorium-review-workplan-loop
tags:
  - scriptorium
  - ux
  - cockpit
  - evidence
branch: codex/ux-enhancements
milestone: desktop-app
---

Context: the first Scriptorium UX slice made the shell, creation flows, and
evidence routes usable. This item covers the P2 "best-of-breed feature set"
called out in the audit note: global command palette, unified job center,
evidence graph, comparison workbench, and saved views/permalinks.

Acceptance criteria:
- [x] Add a global command palette for routes, run commands, saved views,
      recent artifacts, and workplan items.
- [x] Ensure the unified job center exposes result links and is reachable from
      global commands.
- [x] Add evidence graph panels that link scripts, proof runs, replays, labels,
      flags, and workplan surfaces bidirectionally.
- [x] Extend comparison workbench URL support across scripts, proof runs, and
      replays.
- [x] Make filtered dashboard states restorable from URL where the P2 surfaces
      expose filters or selections.
- [x] Verify with targeted tests, Scriptorium UX smoke, and workplan validation.
