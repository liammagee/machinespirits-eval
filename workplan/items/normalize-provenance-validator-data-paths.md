---
id: normalize-provenance-validator-data-paths
title: Honor canonical data-home paths in provenance validators
status: triaged
type: maintenance
priority: P2
owner: unassigned
source: manual
created: 2026-06-28
updated: 2026-06-28
verification: "`npm run provenance:validate`, `npm run paper:provable-discourse -- --epoch 2.0 --strict --no-color`, and `npm run wp:check` pass from a fresh worktree without repo-local DB/log symlinks."
links:
  items: consolidate-logs-db-private-archive
tags:
  - provenance
  - logs
  - data-home
  - validators
milestone: paper-2-evidence-cleanup
---

Follow-up split from `consolidate-logs-db-private-archive`.

The writer path now resolves dialogue logs through `EVAL_LOGS_DIR` /
`MS_DATA_HOME` / `~/.machinespirits-data`, but several validation scripts still
default to repo-relative paths:

- `scripts/validate-provenance.js` (`LOG_DIR` / `DB_PATH`)
- `scripts/validate-bug-claims.js`
- `scripts/validate-paper-manifest.js`

Make their default resolution match the canonical data-home contract while
preserving explicit CLI flags and hermetic/CI overrides. The goal is that a fresh
worktree can validate against the canonical DB and logs without manual symlinks.
