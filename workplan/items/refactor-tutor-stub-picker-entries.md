---
id: refactor-tutor-stub-picker-entries
title: Refactor tutor-stub picker entry projection
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-08-04
verification: Scenario and curriculum picker entries remain deep-equal while
  direct identity, fallback, live PTY, focused, hermetic, manifest, static, and
  source-only gates pass.
branch: codex/refactor-tutor-stub-picker-entries
claim_status: planned
depends_on:
  - refactor-tutor-stub-picker-presentation
links:
  prs:
    - 340
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubPickerPresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubPickerPresentation.test.js
    - tests/labellingGameCli.test.js
    - tests/tutorStubHumanDiscourseLayer.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-picker-presentation
tags:
  - refactoring
  - tutor-stub
  - picker
  - scenario
  - curriculum
milestone: evaluation-infrastructure
---

Dependent R3 slice: move deterministic scenario and curriculum picker entry
shaping into the side-effect-free picker owner introduced by PR #339. Retain
world and curriculum loading, family grouping, default reference resolution,
selection, viewport state, keyboard input, and terminal effects in the CLI.

Acceptance:

- Scenario entries preserve base/variant titles, authored-summary and setting
  fallbacks, discipline defaults, custom-world insertion, file paths, and
  original world identity.
- Curriculum entries preserve public row fields, authored module identity, and
  null fallback for unmatched modules.
- Frozen inputs remain unchanged and existing live PTY selection tests pass.
- The CLI and both touched keyboard functions strictly shrink.
- Focused/full hermetic, manifest, lint, formatting, cycle, source-only
  workplan, syntax, ref-status, and diff gates pass.

Out of scope:

- Loading or resolving worlds, curricula, files, or defaults.
- Changing entry order, text, summaries, grouping, viewport behavior, keys,
  commands, traces, or terminal effects.
- Moving command or turn orchestration before the browser/Electron acceptance
  gate.

Log:

- 2026-07-28 — Activated from PR #339's reviewed head at `68a3329c`. The CLI
  was 25,069 lines; scenario and curriculum keyboard functions were 118 and
  103 lines.
- 2026-07-28 — Entry projection adds 33 lines to the existing pure owner and
  direct identity/fallback fixtures while reducing the CLI to 25,050 lines;
  the two keyboard functions are now 99 and 102 lines. All 55 combined direct
  and PTY assertions pass after correcting the fixture to the established
  authored-summary and question-fallback semantics.
- 2026-07-28 — Review parity is green: 7,415/7,415 root assertions across all
  541 manifest files and 137/137 tutor-core assertions pass with zero skips.
  Manifest, 260-item source workplan, refs, lint, formatting, syntax, diff, and
  the zero-cycle ratchet across 420 files also pass.
- 2026-07-28 — Opened dependent PR #340 on PR #339's branch with no managed ref
  or version impact.
