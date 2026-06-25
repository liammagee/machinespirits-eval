---
id: charisma-desire-generalizability-matrix
title: Generalize accountable-bid charisma under authority refusal
status: active
type: research
priority: P2
owner: codex
source: manual
created: 2026-06-25
updated: 2026-06-25
verification: Plan note exists, current evidence is reconstructed from DB rows, scenario/comparator/judge/model choices are frozen before paid evals, and workplan render plus validate pass.
claim_status: planned
branch: codex/charisma-recognition-desire
links:
  notes:
    - notes/2026-06-25-charisma-desire-generalizability-plan.md
    - notes/2026-06-24-weber-id-charisma-recognition-thread.md
  paper:
    - docs/research/paper-full-2.0.md#67-architectural-extension-the-id-director-family-and-charismatic-pedagogy
    - docs/research/paper-full-2.0.md#89-scope-of-the-id-director-extension
  runs:
    - eval-2026-06-25-b9608606
    - eval-2026-06-25-428ccd8f
    - eval-2026-06-25-19ee106a
    - eval-2026-06-25-63e98149
    - eval-2026-06-25-0acee3fb
  exports:
    - exports/charisma-desire-stage0-matrix-sanity.md
  items:
    - refresh-weber-id-charisma-recognition-thread
tags:
  - id-director
  - charisma
  - recognition
  - generalizability
  - paper-2
milestone: paper-2-evidence-cleanup
---

Plan and gate the next-stage generalizability study for
`cell_169_id_director_charisma_accountable_bid_clean_floor_verified`.

The starting point is bounded: cell 169 is a clean local pass on two simulated
authority-refusal scenarios, not evidence that charismatic tutoring works
generally or that real learners recognize tutor authority.

Acceptance:

- Save the standalone plan note with current DB-derived evidence.
- Keep `charisma_desire_partial_uptake` out of the primary decision rule.
- Freeze scenario, comparator, judge, and model choices before paid evals.
- Run only cleanup and no-paid validation before any high-powered matrix.
- Promote the claim only after multi-scenario, repeated-run, judge/model
  robustness, and human-facing gates are satisfied.

2026-06-25 Codex: Created the generalizability plan note and reconstructed the
current evidence table from DB rows. Cleaned accidental interrupted run
`eval-2026-06-25-87a4bef6` plus its progress log before opening this item.

2026-06-25 Codex: Began Stage 0 implementation. Added the AI-syllabus transfer
scenario using `content/courses/479/lecture-8.md` plus the recent generated
campus FAQ formulation-card fixture as source context, and added a no-paid
matrix sanity report for the frozen 6 x 4 x 3 pilot grid.
