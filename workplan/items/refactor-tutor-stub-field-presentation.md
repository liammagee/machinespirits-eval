---
id: refactor-tutor-stub-field-presentation
title: Refactor tutor-stub field presentation
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-26
updated: 2026-07-26
verification: One pure field-presentation service preserves bars, shift
  narratives, chart geometry, and byte-stable accessible SVG output; focused,
  hermetic, static, and source-only gates pass without model calls.
branch: codex/refactor-tutor-stub-field-presentation
claim_status: planned
depends_on:
  - refactor-tutor-stub-response-details
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubFieldPresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubFieldPresentation.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-response-details
tags:
  - refactoring
  - tutor-stub
  - presentation
  - interaction-field
milestone: evaluation-infrastructure
---

Bounded R3 slice: move the tutor-stub's pure interaction-field presentation
helpers out of the interactive CLI without moving field computation or any
application behavior.

Out of scope:

- Changing the lightweight-field schema, scores, deltas, thresholds, labels,
  colors, geometry, SVG bytes, accessibility text, or terminal wording.
- Consolidating or redesigning the deliberately distinct auto-eval SVG
  renderer in `scripts/run-tutor-stub-auto-eval.js`.
- Moving `/field`, `/viz`, filesystem writes, path selection, terminal output,
  trace persistence, model calls, commands, or mutable runtime state.
- Running model-backed or paid evaluations.

Acceptance:

- One pure service owns field bars, XML escaping, shift delta/narrative text,
  chart polylines and markers, and interactive SVG serialization.
- The CLI imports those helpers behind the same call sites while retaining
  field projection, terminal printing, file writes, path selection, trace
  events, commands, and state changes.
- Frozen fixtures pin rounding and clamping, the established falsy baseline
  sentinel, shift thresholds and grammar, chart coordinates, XML escaping,
  accessibility text, and complete SVG bytes.
- Focused and full hermetic tests, manifest, lint, formatting, cycles,
  source-only workplan, syntax, and diff gates pass without model calls.

Log:

- 2026-07-26 — Activated from rendered `origin/main` at `e7c86cb3` after PR
  #240 merged with every CI lane green. The CLI began at 27,372 lines; selected
  this pure presentation seam because field computation and all application
  behavior remain behind existing boundaries.
- 2026-07-26 — Moved nine pure formatting/serialization helpers into a
  189-line leaf service and reduced the CLI to 27,206 lines. Direct field
  presentation plus existing trajectory/projection characterization is green
  at 19/19; broader parity remains to run.
- 2026-07-26 — Review parity is green: the complete hermetic root and
  tutor-core run exited cleanly with zero skips (core 137/137), and direct field
  characterization remains 19/19. Repository-wide ESLint and formatting,
  manifest, zero-cycle (364 files), 194-item source-only workplan, syntax, and
  diff checks pass with no model calls.
- 2026-07-26 — Rebased cleanly onto current rendered `origin/main` at
  `4b69df9b` after PR #241 merged the independent concealed-answer guard. Its
  overlapping guard/replay tests plus field coverage pass 51/51; the complete
  hermetic suite is green again on the final base with zero skips and tutor-core
  137/137. Current-main CLI movement is 27,371 to 27,205 lines, still a 166-line
  reduction.
- 2026-07-26 — Rebased cleanly again onto `origin/main` at `296550eb` after PR
  #242 merged the independent audience-pragmatics runtime. The final-base
  overlap suite covering audience pragmatics, auto-eval projection, frozen
  replay, field presentation, and interactive discourse passes 129/129; static
  and source-only gates remain green. Current-main CLI movement is 27,389 to
  27,223 lines, preserving the 166-line reduction.
- 2026-07-26 — The repository-wide format gate exposed one long assertion in
  PR #242's newly merged compact-speaking-prompt test. Applied Prettier's
  line-only repair so this branch does not inherit a known-red CI gate; that
  focused file remains green at 5/5 with no production behavior change.
