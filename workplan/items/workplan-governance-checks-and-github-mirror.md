---
id: workplan-governance-checks-and-github-mirror
title: Workplan governance checks and GitHub mirror
status: done
type: ops
priority: P2
owner: codex
source: manual
created: 2026-06-23
updated: 2026-06-24
branch: codex/ops-board-items
verification: "`npm run wp:check`, `npm run wp:test`, GitHub mirror dry-run, and
  `/board` Scriptorium smoke all passed before the branch was merged to main."
links:
  items:
    - build-workplan-tooling
    - auto-drop-daily-routine
  notes: workplan/README.md
tags:
  - workplan
  - ci
  - github
  - governance
milestone: board-pm
---

This closes the governance slice that made `workplan/items/` harder to drift
from the generated board and GitHub-facing workflow:

- [x] Add `wp:check` to validate item frontmatter and prove `BOARD.md` plus
      `board.json` are current.
- [x] Add PR workplan-link validation and a PR template slot for the item id.
- [x] Add a dry-run-first GitHub Issues mirror for selected workplan statuses.
- [x] Add a board refresh path in the Scriptorium dashboard.
- [x] Document `workplan/` as the live todo source of truth and `TODO.md` as
      historical context.

Merge notes:
- Branch commit: `341c8a45 workplan: add ops governance checks`.
- Main merge commit: `044f291b Merge branch 'codex/ops-board-items'`.
