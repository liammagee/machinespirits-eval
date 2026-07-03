---
id: negative-register-effect-estimation-grid
title: Estimate negative-register effects with stance-fidelity gating
status: triaged
type: experiment
priority: P2
owner: unassigned
source: manual
created: 2026-07-03
updated: 2026-07-03
verification: Full five-target grid, or an explicit drop decision, reports assigned-arm effects, faithful-arm effects, exclusions, invalid person-attack violations, and paper/workplan scope.
claim_status: future
links:
  notes:
    - notes/2026-07-03-negative-register-effect-estimation-future-work.md
    - notes/2026-07-02-register-taxonomy-and-negative-registers-plan.md
  paper:
    - docs/research/paper-full-2.0.md#67-architectural-extension-the-id-director-family-and-charismatic-pedagogy
    - docs/research/paper-full-2.0.md#89-scope-of-the-id-director-extension
  exports:
    - exports/charisma-desire-breakthrough-matrix-summary.md
    - exports/charisma-desire-breakthrough-matrix.json
    - exports/negative-register-corrosive-exemplar-results.md
  runs:
    - eval-2026-07-02-e7b15809
    - eval-2026-07-02-7e461a5c
    - eval-2026-07-02-5c4d52e6
  items:
    - register-taxonomy-negative-registers
depends_on:
  - register-taxonomy-negative-registers
tags:
  - registers
  - negative-registers
  - effect-estimation
  - stance-fidelity
---

Future work after the negative-register measurement repair.

The next spend should not be another treatment-fidelity check. The repaired cue
contract already passed small simulated coverage checks across all five
controlled resistance targets. A full grid is warranted only if the question is
whether irony, sarcasm, or simulated face-threat change local learner outcomes
after treatment fidelity is enforced.

Acceptance:

- Run cells 196, 197, and 198 across all five controlled resistance targets, or
  explicitly decide not to spend on this grid.
- Report assigned-arm and faithful-arm estimands separately.
- Keep treatment-noncompliance exclusions separate from invalid person-attack
  violations.
- Include tutor-only v2.2 scores, register-rubric scores, and breakthrough
  matrix outputs.
- Keep any paper claim simulated-only and non-human-facing unless a separate
  human-coded or human-learner check is added.

2026-07-03 Codex: Created after closing the register-taxonomy implementation
branch. The current evidence supports measurement readiness, not a claim that
negative registers are pedagogically safe or effective.
