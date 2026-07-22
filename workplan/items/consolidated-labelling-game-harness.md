---
id: consolidated-labelling-game-harness
title: Consolidated labelling game for taxonomy and tutor-stub impasse datasets
status: active
type: infra
priority: P1
owner: codex
source: manual
created: 2026-07-22
updated: 2026-07-22
verification: Both datasets load and save through /human-coding-admin and the
  shared terminal flow; tutor-stub launches that flow with --labelling-game;
  route, store, CLI, syntax, and in-browser checks pass without exposing the
  taxonomy key early.
claim_status: methods
depends_on: []
links:
  notes:
    - docs/research/human-coding-codebook.md
    - notes/impasse/2026-07-17-phase1-labeling-sheet.md
  items:
    - impasse-corpus-phase1
tags:
  - human-labelling
  - tutor-stub
  - impasse-program
  - evaluation-infrastructure
milestone: impasse-program-v1
---

Unify the two outstanding human-judgment packets behind one dataset registry,
one web worklist, and one terminal interaction model. Preserve the original
superego-taxonomy CSV contract because the existing reliability analyzer reads
it directly. Store the multi-field impasse judgments in a structured rater
sidecar suitable for the planned detector test.

Acceptance boundaries:

- The browser can switch datasets without changing the existing admin URL.
- Human labels remain separate per coder and the taxonomy key remains sealed
  until the original completion gate permits comparison.
- The tutor-stub CLI can launch the same harness without starting a model call.
- The impasse form records presence, type(s), tutor response, resolution within
  two turns, and notes against the 29 frozen candidate episodes.

2026-07-22 Codex: Implemented the shared dataset registry, backward-compatible
taxonomy adapter, structured impasse rater sidecar, dataset-aware web worklist,
standalone terminal command, and tutor-stub launch flags. Targeted route/store
and CLI tests, existing tutor-stub interaction tests, ESLint, workplan
validation, and a live in-app-browser pass over both 40-item and 29-item
packets passed. No real human labels or hidden-key comparisons were created.
