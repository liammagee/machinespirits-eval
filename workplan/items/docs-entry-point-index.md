---
id: docs-entry-point-index
title: Create the documentation entry point and repoint the live-arc references
status: triaged
type: maintenance
priority: P2
owner: claude
source: review
created: 2026-08-05
updated: 2026-08-05
verification: "A root-level docs index exists, is linked from README.md and CLAUDE.md, names the live arc, and every layer (paper, board, notes, exports, servers, deploy) is one hop from it."
links:
  notes: notes/poetics/2026-08-05-documentation-map.html
  items: docs-coherence-structure
tags:
  - docs
  - structure
---

No root document points a reader at the current work:

- `CLAUDE.md` names `DRAMATIC-RECOGNITION-PLAN.md` as the fork's master plan,
  but that doc self-labels "historical pre-registration plus closeout ledger".
- `ADAPTIVE-TUTOR-ACTIVE-PLAN.md` self-declares "canonical active plan"
  (2026-06-15) and has been dormant since 1 July.
- `ADAPTATION-PLAN-3.0.md` closed 2026-08-03 and hands off to
  `notes/2026-08-03-adaptive-causality-living-log.md` plus board cards.
- `DEPLOYMENT.md` is linked from almost nothing; same for
  `docs/design/machinespirits-house-style.md`.

Build one entry point (proposal: `DOCS.md` at root, or `docs/README.md` linked
from root) that maps the six layers, names the authorities, links DEPLOYMENT
and the house style, and states where the live arc lives (the board plus the
current living log). Repoint the CLAUDE.md/AGENTS.md/GEMINI.md fork sections to
match. Keep it short — a map, not a duplicate of CLAUDE.md.
