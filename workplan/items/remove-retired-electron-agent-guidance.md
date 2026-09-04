---
id: remove-retired-electron-agent-guidance
title: Remove retired Electron instructions from live agent guidance
status: active
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-09-03
updated: 2026-09-03
branch: codex/end-to-end-audit-20260903
verification: "Live Claude, Gemini, and documentation-map guidance names the browser surfaces as supported, contains no command or path that implies the retired Electron target still exists, and directs cell lookups to config/tutor-agents.yaml rather than a static cell range."
claim_status: planned
links:
  items:
    - decommission-electron-desktop-target
  notes:
    - CLAUDE.md
    - GEMINI.md
    - DOCS.md
tags:
  - documentation
  - codex
  - claude
  - gemini
  - electron
---

Electron was removed from the supported product in PR #690, but the live Claude
and Gemini instruction files still tell agents that `desktop/`, `desktop-dev`,
and `npm run desktop:*` exist. Claude also identifies this checkout as an old
fork and describes the cell registry as a fixed 1--125 range.

Replace these operational instructions with the current browser-surface and
source-of-truth contract. Historical plans and completed cards remain
unchanged. Add a small regression assertion so live agent guidance cannot
silently reintroduce commands for the retired target.
