---
id: build-workplan-tooling
title: Build the workplan executable layer (CLI, ingester, dashboard panel, test)
status: done
type: infra
priority: P1
owner: claude
source: manual
created: 2026-06-22
updated: 2026-06-22
branch: claude/derivation-fast-iteration
verification: scripts/workplan.js
  list/show/add/triage/set/validate/render/ingest all run green;
  tests/workplan.test.js passes under npm run test:hermetic; board.json renders
  a panel in the scriptorium (:3466); npm run wp:* wired in package.json.
links:
  notes: workplan/README.md
tags:
  - workplan
  - tooling
  - meta
---

The backbone (this folder, schema, playbook, skill) exists. This item tracks the
executable layer that makes the board operable by CLI, routine, and dashboard.

Acceptance criteria:
- [ ] `scripts/workplan.js` — subcommand dispatch (template: `scripts/build-atlas.js`),
      using the bundled `yaml` + `zod` deps; commands: `list`, `show`, `add`,
      `triage`, `set`, `validate` (against `schema/item.schema.json`), `render`
      (emit `BOARD.md` + `board.json`), `ingest` (TODO.md open items +
      `notes/daily-notes/` actions → `inbox/`).
- [ ] `npm run wp:*` scripts in package.json.
- [ ] `tests/workplan.test.js` — schema validation + render round-trip, hermetic.
- [ ] Scriptorium read-only board panel reading `workplan/board.json`
      (seam: `scripts/browse-poetics-scripts.js`, canonical port 3466).
- [ ] Optional: a routine hook so the daily roundup drops actions into `inbox/`.

Keep it lightweight; the dashboard panel is display-only (mutations go through
the CLI / item files) so the metered server stays simple.
