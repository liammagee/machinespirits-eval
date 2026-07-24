---
id: refactor-tutor-core-cycle
title: Break the tutor-core dialogue and writing-pad import cycle
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-24
updated: 2026-07-24
verification: >-
  Writing-pad logging imports only a dependency-free quiet-mode leaf; the
  dialogue engine preserves its existing named and package exports; the static
  import-cycle gate reports only the separately queued tutor-stub cycle; and
  focused plus full hermetic parity passes.
branch: codex/refactor-tutor-core-cycle
depends_on:
  - refactor-rubric-parser-tests
links:
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/198
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  items:
    - codebase-refactoring-program
tags:
  - refactoring
  - tutor-core
  - imports
  - cycles
  - logging
  - hermetic
milestone: evaluation-infrastructure
---

Bounded R1.1 slice: remove the tutor-core orchestration cycle caused solely by
`writingPadService` importing quiet-mode state from `tutorDialogueEngine`. Do
not change dialogue behavior, logging output, memory semantics, provider
routing, database schemas, public exports, or the separate tutor-stub cycle.

Acceptance:

- Move `setQuietMode` and `isQuietOrTranscript` into one dependency-free leaf;
  import that leaf from the dialogue engine and writing-pad service.
- Preserve the dialogue engine named exports and the package-level
  `setQuietMode` facade with the same shared state.
- Remove the writing-pad tests' now-unnecessary `aiService` cycle workarounds.
- Add a dependency-free static import analyzer, an exact checked-in cycle
  baseline, focused detector tests, and a CI/package gate.
- Ratchet the repository cycle baseline from the two reviewed strongly
  connected components to only the three-file tutor-stub component queued for
  R1.2.
- Pass focused cycle, dialogue, writing-pad, full hermetic, lint, formatting,
  and workplan gates without model or API calls.

Log:

- 2026-07-24 — Activated from merged `main` at `5026e544` after PR #196 closed
  R0.6. The reviewed static scan reproduced exactly two components: the
  five-file tutor-core component and the three-file tutor-stub response
  component.
- 2026-07-24 — Extracted shared quiet-mode state into
  `dialogueLoggingState.js`; writing-pad imports no orchestrator, the dialogue
  engine re-exports the exact leaf bindings, and obsolete `aiService` mocks are
  removed. Focused core parity is 137/137 and the three-test cycle gate reports
  only the expected tutor-stub component across 338 production service files.
- 2026-07-24 — Fast-forwarded onto merged `main` at `bcfa1d3d` after PR #197,
  then reverified the slice. The final hermetic run passes all 455 root test
  files with zero skips and all 11 tutor-core files (137/137 tests); lint,
  formatting, workplan, and exact static-cycle gates are green without model or
  API calls. R1.1 is ready for review; R1.2 remains the separate tutor-stub
  response-cycle slice.
- 2026-07-24 — Closed after PR #198 merged at `0695cbbf` with all required
  checks green.
