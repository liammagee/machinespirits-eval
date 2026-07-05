---
id: workplan-board-focus-policy
title: Add open-work focus policy to the board
status: done
type: maintenance
priority: P2
owner: codex
source: manual
created: 2026-07-01
updated: 2026-07-01
branch: codex/docs-board-consolidation
verification: "`node --test --test-force-exit tests/workplanBoardFocus.test.js`, `node --test tests/workplan.test.js tests/workplanSetField.test.js`, `node --check scripts/browse-poetics-scripts.js tests/workplanBoardFocus.test.js`, `node scripts/workplan.js render`, `node scripts/workplan.js validate`, and `npm run wp:check` pass."
links:
  notes:
    - workplan/README.md
    - desktop/README.md
    - desktop/ARCHITECTURE.md
  items:
    - docs-board-plan-consolidation
    - workplan-governance-checks-and-github-mirror
tags:
  - workplan
  - dashboard
  - documentation
---

The board should reduce visual noise without rewriting historical item status.
This pass changes `/board` presentation only:

- naked `/board` focuses on open work;
- `?focus=all` shows every item from generated `board.json`;
- `?focus=settled` shows completed, archived, and dropped history;
- item/type/tag/milestone deep links default to all items so existing links keep
  finding historical cards.

Generated `workplan/BOARD.md` and `workplan/board.json` remain complete.
