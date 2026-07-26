---
id: refactor-tutor-stub-feature-map-projection
title: Refactor tutor-stub feature-map projection
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-26
updated: 2026-07-26
verification: Launch and live /features bytes remain identical while pure
  projection, focused, hermetic, manifest, static, and source-only gates pass.
branch: codex/refactor-tutor-stub-feature-map-projection
claim_status: planned
depends_on:
  - refactor-tutor-stub-interactive-help-projection
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubFeatureMap.js
    - services/tutorStubCapabilities.js
    - scripts/tutor-stub.js
    - tests/tutorStubFeatureMap.test.js
    - tests/tutorStubHumanDiscourseLayer.test.js
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-interactive-help-projection
tags:
  - refactoring
  - tutor-stub
  - presentation
  - cli
  - capabilities
milestone: evaluation-infrastructure
---

Bounded R3 slice: move the tutor-stub's pure launch and in-session `/features`
line projection out of the CLI while retaining capability lookup, state
resolution, terminal writes, and every runtime responsibility in the
entrypoint.

Out of scope:

- Changing capability groups, labels, descriptions, active/available rules,
  quick-start commands, colors, padding, ordering, or blank lines.
- Moving capability snapshot resolution, hidden always-on filtering, session
  mode/content lookup, slash-command execution, or terminal writes.
- Moving release notes, help, settings, reports, browser/voice, lifecycle,
  model, trace, or tutor-turn behavior.

Acceptance:

- One dependency-free pure projector receives precomputed capability rows,
  optional active context, and the active color tokens.
- `printTutorStubFeatureMap` remains the CLI-owned adapter that resolves
  capabilities, mode, content, visible active mechanisms, and terminal output.
- Frozen launch and active-session fixtures pin exact bytes, quick starts,
  padding, conditional active context, trailing blank lines, and immutability.
- Actual pre/post-refactor `--features` and live `/features` processes exit zero
  with byte-identical output; focused/full hermetic and manifest, lint,
  formatting, cycle, source-only workplan, syntax, and diff gates pass without
  model calls.

Log:

- 2026-07-26 — Activated from rendered `origin/main` at `130efa09` after PR
  #265 merged as `4030d09f` with every required CI lane green. Selected the
  adjacent 42-line feature-map seam because capability/state resolution and
  terminal writes can remain CLI-owned while only deterministic copy and line
  serialization move.
- 2026-07-26 — Baseline launch output is 1,385 bytes; the live scenario process
  is 2,876 bytes, including a 1,608-byte feature-map slice. Recorded exact
  SHA-256 parity before moving the presentation and made no model calls.
- 2026-07-26 — Added one dependency-free 43-line projection leaf and reduced
  the CLI from 26,662 to 26,642 lines. Launch `--features` remains byte-identical
  at 1,385 bytes; the live process remains byte-identical at 2,876 bytes with
  the same 1,608-byte map slice. Exact launch/session fixtures and the complete
  capability, registry, and terminal surface pass 64/64.
- 2026-07-26 — Review parity is green: the complete hermetic root contract
  passes 6,910/6,910 with zero skips and tutor-core passes 137/137 with zero
  skips. ESLint, Prettier, the zero-cycle ratchet across 379 files, synchronized
  test manifest, 207-item source-only workplan, syntax, and diff gates pass;
  generated workplan views remain untouched.
