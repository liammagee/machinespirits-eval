---
id: charisma-desire-heldout-quality-gate
title: Charisma/desire held-out artifact quality gate
status: active
type: research
priority: P2
owner: codex
source: manual
created: 2026-07-02
updated: 2026-07-02
branch: codex/charisma-desire-heldout-quality-gate
verification: Held-out scenario pool validates; command sheet emits six guarded
  role-isolation arms; breakthrough reporter supports `--scenario-set heldout`;
  gate report returns PASS/FAIL/PENDING with explicit runtime, role-swap quality,
  and scripted-control criteria; workplan render/validate and focused gate tests
  pass.
claim_status: planned
links:
  items:
    - charisma-desire-generalizability-matrix
  exports:
    - exports/charisma-desire-heldout-quality-gate-summary.md
    - exports/charisma-desire-heldout-quality-gate.json
    - exports/charisma-desire-breakthrough-heldout-matrix-summary.md
    - exports/charisma-desire-breakthrough-heldout-matrix.json
tags:
  - id-director
  - charisma
  - recognition
  - heldout
  - engagement-routing
milestone: paper-2-evidence-cleanup
---

Define and run the next gate after the completed role-isolation closeout: does
the local charisma/desire selector retain artifact-level quality on held-out
traces across model-role swaps, while scripted controls remain negative and GLM
runtime completion stays guarded?

Acceptance:

- Keep the held-out artifact pool separate from the lecture-3 controlled matrix.
- Freeze the role-isolation machinery; do not tune policy behavior during this gate.
- Treat scripted controls as tutor-register checks only, never learner-outcome evidence.
- Produce a pass/fail/pending gate report with explicit positive-local-outcome,
  route-hit, target-match, runtime-completion, and scripted-control criteria.
- Advance only a bounded claim if the gate passes: held-out artifact-level signal,
  no runtime promotion, deployment claim, or human-learning claim.

2026-07-02 Codex: Opened the held-out quality gate branch from the completed
role-isolation branch because the prior runtime/reporter fixes have not yet
landed on `main`.

2026-07-02 Codex: Added five held-out artifact probes spanning lectures 1, 4,
5, 6, and 8; added `--scenario-set heldout` support to the breakthrough matrix
reporter; added the held-out quality gate command sheet and PASS/FAIL/PENDING
criteria. Focused reporter checks, focused gate tests, lint, and workplan
validation pass locally. Gate state is intentionally `PENDING_NO_RUNS` until the
six guarded held-out arms are generated.
