---
id: docs-board-plan-consolidation
title: Consolidate Plan 2.x docs and board routing
status: archived
type: maintenance
priority: P2
owner: codex
source: manual
created: 2026-07-01
updated: 2026-07-02
branch: codex/docs-board-consolidation
verification: "`node scripts/workplan.js render`, `node scripts/workplan.js validate`, `npm run wp:check`, and `npm run wp:test` pass after adding the Plan 2.x documentation map and board-routing notes."
links:
  paper: docs/research/paper-full-2.0.md
  notes:
    - PLAN_2_0/README.md
    - PLAN_2_0/latest_paper_status_next_steps.md
    - ADAPTIVE-TUTOR-ACTIVE-PLAN.md
    - docs/research/A21-action-value-tutoring-microbench.md
  items:
    - workplan-governance-checks-and-github-mirror
    - paper-workplan-closure-audit-2026-06-24
tags:
  - documentation
  - planning
  - workplan
  - plan-2
---

This cleanup pass makes the planning surfaces easier to navigate without
deleting evidence-bearing notes:

- add `PLAN_2_0/README.md` as the Plan 2.x entry point;
- mark `PLAN_2_0/latest_paper_status_next_steps.md` as a historical cleanup
  checklist rather than a live next-action list;
- route live follow-up ownership to `workplan/items/`;
- remove stale/duplicate root markdown files where a canonical indexed copy
  remains;
- refresh generated board views from item files.

The important boundary is deliberate: `PLAN_2_0/` preserves designs,
preregistrations, closeouts, and evidence context; the workplan owns live todos.

2026-07-02 Codex: Archived after the Plan 2.x directory was stamped as a closed
evidence archive. Future Plan 2.x follow-up requires a new workplan item rather
than editing `PLAN_2_0/` as a live roadmap.
