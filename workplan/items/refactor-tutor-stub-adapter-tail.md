---
id: refactor-tutor-stub-adapter-tail
title: Finish the tutor-stub adapter boundary
status: triaged
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-09
updated: 2026-08-09
branch: codex/refactor-tutor-stub-adapter-tail
verification: >-
  The tutor-stub entrypoint is at most 2,000 lines and contains no application
  function above 300 lines; focused command, policy, host, terminal, process,
  browser/Electron, hermetic, risk-coverage, source, lint, formatting,
  manifest, and cycle gates preserve exact public behavior and lifecycle.
claim_status: planned
depends_on: []
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
    - docs/next-steps/2026-08-09-codebase-refactoring-reconciliation.md
  code:
    - scripts/tutor-stub.js
    - services/tutorStubSessionRuntime.js
    - services/tutorStubSessionHost.js
    - services/tutorStubProcessSessionFactory.js
  items:
    - codebase-refactoring-program
tags:
  - refactoring
  - tutor-stub
  - cli
  - application-context
  - terminal
  - lifecycle
  - maintainability
milestone: tutor-super-app
---

Close the remaining measurable R3 gap after the macro decomposition series.
The entrypoint is now 2,699 lines and its `main()` is approximately 705 lines:
far smaller than the July baseline, but still above the programme's explicit
2,000-line adapter and 300-line application-function ceilings.

Acceptance:

- Move the remaining learner-turn policy/context bindings out of
  `scripts/tutor-stub.js` behind a cohesive application-facing module; do not
  create another duplicate policy implementation or generic dumping ground.
- Move interactive host/session assembly out of `main()` so the entrypoint owns
  only argument admission, terminal/process wiring, top-level invocation, and
  exit-code reporting.
- Reduce `scripts/tutor-stub.js` to at most 2,000 physical lines and every
  application function remaining there to at most 300 lines.
- Preserve command tokens, slash help, completion, CLI options and defaults,
  prompt/context text, trace ordering, fake-provider golden behavior, terminal
  output, learner/tutor control symmetry, reset/finalize/cancellation, voice,
  browser/Electron, and process-session behavior.
- Preserve lazy imports, explicit lifecycle ownership, natural disposal, and
  the existing rule that the tutor-stub makes no evaluation-store write.
- Ratchet or retain focused branch coverage for every moved conditional and
  keep static import cycles at zero.
- Run the symmetry reviewer for any trace, learner/tutor control, scoring, or
  data-structure movement.
- Do not make provider/model calls, write production evaluation data, redesign
  the tutor, or commit generated workplan views.

Log:

- 2026-08-09 — Triaged by the post-PR-#595 reconciliation at `3ed950d9`.
  Baseline: 2,699 entrypoint lines; `main()` begins at line 1,992 with complexity
  32 and spans approximately 705 lines; the largest remaining local policy
  helpers have complexities 40 and 26. This is the sole queued continuation;
  later R4–R8 candidates require another evidence refresh before activation.
