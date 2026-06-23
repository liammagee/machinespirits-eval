---
id: scriptorium-review-workplan-loop
title: Scriptorium review queue and workplan loop
status: triaged
type: ops
priority: P1
owner: unassigned
source: manual
created: 2026-06-23
updated: 2026-06-23
verification: A flagged case can be found, reviewed, connected to a workplan item, and resolved through the existing workplan source-of-truth workflow without creating a second board.
links:
  notes: notes/poetics/2026-06-23-scriptorium-dashboard-ux-audit-plan.md
  items:
    - scriptorium-evidence-workbenches
tags:
  - scriptorium
  - ux
  - workplan
  - review
---

Context: the workplan now has a structured board and the Scriptorium reads
`workplan/board.json`. The next UX step is to connect evidence review to the
board without letting the dashboard become a parallel source of truth.

Acceptance criteria:
- [ ] Add dashboard entry points for flags, labels, and adjudication progress.
- [ ] Link review cases to workplan items, notes, exports, or paper sections.
- [ ] Keep mutations in `workplan/items/` and CLI-supported workflows.
- [ ] Add a Scriptorium UX roadmap board view or filter using these epics.
- [ ] Show open/review/done state from generated `board.json`.
