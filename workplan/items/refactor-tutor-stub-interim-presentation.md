---
id: refactor-tutor-stub-interim-presentation
title: Refactor tutor-stub interim presentation
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-26
updated: 2026-07-26
verification: One pure interim-presentation service preserves signed deltas,
  capability and strength labels, bottleneck copy, and every contextual CLI
  hint; focused, PTY, hermetic, static, and source-only gates pass without model
  calls.
branch: codex/refactor-tutor-stub-interim-presentation
claim_status: planned
depends_on:
  - refactor-tutor-stub-closeout-projection
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubInterimPresentation.js
    - services/tutorStubLearningSummary.js
    - scripts/tutor-stub.js
    - tests/tutorStubInterimPresentation.test.js
    - tests/tutorStubHumanDiscourseLayer.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-closeout-projection
tags:
  - refactoring
  - tutor-stub
  - presentation
  - terminal
  - loading-indicator
milestone: evaluation-infrastructure
---

Bounded R3 slice: move the tutor-stub's pure interim/loading presentation
primitives out of the interactive CLI and share its bottleneck wording with the
learning summary, without moving terminal or animation behavior.

Out of scope:

- Changing interim wording, thresholds, ordering, hint precedence, phase
  matching, colors, animation frames, timing, rotation, or terminal layout.
- Moving panel data assembly, lightweight-field or DAG computation, timers,
  TTY detection, concurrent-terminal coordination, terminal writes, commands,
  model calls, traces, or mutable runtime state.
- Redesigning the loading indicator or adding new help copy.
- Running model-backed or paid evaluations.

Acceptance:

- One pure service owns signed delta formatting, active-capability summaries,
  strength bands, bottleneck labels, and context-sensitive CLI hint panels.
- The CLI imports those helpers behind the same call sites while retaining
  complete panel assembly, rendering, animation, terminal, and runtime control.
- The learning-summary service imports the shared bottleneck projection rather
  than carrying a duplicate authored mapping.
- Frozen fixtures pin null and rounding behavior, every threshold boundary,
  every authored bottleneck, fallback normalization, all hint-precedence
  branches, exact copy, and input immutability.
- The existing real PTY loading scenario plus full hermetic tests, manifest,
  lint, formatting, cycles, source-only workplan, syntax, and diff gates pass
  without model calls.

Log:

- 2026-07-26 — Activated from rendered `origin/main` at `7a22b818` after PR
  #247 merged with every CI lane green. Selected the remaining pure interim
  presentation primitives because timers, TTY I/O, panel assembly, commands,
  traces, and runtime state remain behind their existing boundaries.
- 2026-07-26 — Moved five pure helpers into an 89-line leaf, reduced the CLI
  from 27,090 to 27,013 lines on current main, and removed the learning-summary
  service's ten-line bottleneck mapping duplicate. Direct/shared-summary coverage passes
  9/9 and the real PTY loading-indicator scenario remains green.
- 2026-07-26 — Review parity is green: 16/16 focused presentation, summary,
  HTML, and concurrent-terminal tests plus the real PTY loading scenario pass;
  the complete hermetic root and tutor-core run exits cleanly with zero skips
  (core 137/137). ESLint, formatting, manifest, zero-cycle (367 files),
  196-item source-only workplan, syntax, and diff gates pass without model
  calls.
- 2026-07-26 — Rebased cleanly onto rendered `origin/main` at `a577fa6a` after
  PRs #245, #246, and #248 merged independent adaptive-refusal,
  resume-reconstruction, and tutor-PR benchmark work. Their overlapping
  tutor-stub and manifest surface plus this slice pass 30/30 and the real PTY
  loading scenario; the complete hermetic suite is green again with zero skips
  and tutor-core 137/137. ESLint, formatting, zero-cycle (368 files), manifest,
  198-item source-only workplan, syntax, and diff gates pass on the final base.
- 2026-07-26 — PR #249 merged as `2e8f0708` with every CI lane green; the
  serialized workplan render followed as `315cbaed`. Closed this child and
  carried the still-pure panel ordering and frame serialization seam into
  `refactor-tutor-stub-interim-frame-projection`.
