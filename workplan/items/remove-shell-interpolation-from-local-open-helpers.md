---
id: remove-shell-interpolation-from-local-open-helpers
title: Remove shell interpolation from local file-opening helpers
status: review
type: infra
priority: P2
owner: codex
source: review
created: 2026-09-03
updated: 2026-09-03
branch: codex/end-to-end-audit-20260903
verification: "All local preview-open paths pass the target as an argv element rather than through a shell, focused tests cover metacharacter-bearing paths and URLs, and lint and format checks pass."
claim_status: planned
links:
  prs:
    - 983
  notes:
    - scripts/render-sequence-diagram.js
    - scripts/generate-paper-figures.js
    - scripts/browse-poetics-scripts.js
tags:
  - security
  - tooling
  - portability
---

Three developer-facing preview helpers build macOS `open` commands with string
interpolation. Their output directory, host, or port can be supplied on the
command line, so quoting alone does not create a safe process boundary.

Use a non-shell child-process call with the target as a distinct argument.
Retain the current best-effort behavior when the host cannot open the preview.

2026-09-03 Codex: Replaced shell-built `open` and screenshot commands with
argument-vector process calls. Focused tests prove a metacharacter-bearing
target remains one argument and guard the affected sources against regression.
The full lint and hermetic suites pass. Implementation is under review in
PR #983.
