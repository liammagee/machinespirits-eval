---
id: docs-techne-token-sync-test
title: Test-enforce the techne token mirror (served subset vs editorial source)
status: triaged
type: infra
priority: P3
owner: claude
source: review
created: 2026-08-05
updated: 2026-08-05
verification: "A test fails when the shared tokens in public/components/techne.css drift from notes/poetics/assets/techne.css (light and dark), and the current --paper mismatch is resolved one way or the other."
links:
  notes: notes/poetics/2026-08-05-documentation-map.html
  items: docs-coherence-structure
tags:
  - docs
  - design
  - tests
---

Two copies of the techne tokens exist by design — the full editorial stylesheet
(`notes/poetics/assets/techne.css`, ~54 KB) and the served app-UI subset
(`public/components/techne.css`, ~11 KB) — synced today by hand-maintained
"keep in sync" comments only.

Already drifted: light-mode `--paper` is `#F1E9D8` in the served copy (matching
the scriptorium dashboard) and `#F4EEDD` in the editorial copy. The stark skin
block is duplicated in three places (both files plus the dashboard's inline
base CSS).

Work:

- [ ] Decide the canonical value for the drifted token(s) and align.
- [ ] Add a small test that parses the shared token block from both files
      (and the dashboard inline copy if practical) and fails on mismatch —
      same spirit as the desktop route-parity test.
- [ ] Register the new test in the manifest (`npm run test:manifest:update`).
