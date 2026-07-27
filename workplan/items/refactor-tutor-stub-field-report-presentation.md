---
id: refactor-tutor-stub-field-report-presentation
title: Refactor tutor-stub field report presentation
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: Field and visualization terminal output remains byte-identical
  while dense, no-turn, truncation, seeded live-process, focused, hermetic,
  manifest, static, and source-only gates pass.
branch: codex/refactor-tutor-stub-field-report-presentation
claim_status: planned
depends_on:
  - refactor-tutor-stub-field-presentation
  - refactor-tutor-stub-closeout-report-presentation
links:
  prs:
    - 323
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubFieldPresentation.js
    - services/tutorStubFieldTurnProjection.js
    - scripts/tutor-stub.js
    - tests/tutorStubFieldPresentation.test.js
    - tests/tutorStubFieldReportPresentation.test.js
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-field-presentation
    - refactor-tutor-stub-closeout-report-presentation
tags:
  - refactoring
  - tutor-stub
  - field
  - presentation
  - terminal
milestone: evaluation-infrastructure
---

Bounded R3 slice: move only the deterministic `/field` and `/viz` terminal-line
projection into the existing field presentation leaf while retaining field
calculation, visualization file writes, trace events, command dispatch, and
mutable runtime behavior in the CLI.

Out of scope:

- Changing field values, schema, rounding, bars, wording, colors, truncation,
  line order, newline behavior, visualization paths, or serialized SVG/JSON.
- Moving field construction, visualization path selection, directory or file
  writes, trace persistence, command handling, model calls, or runtime state.
- Consolidating the deliberately distinct auto-eval field renderer.
- Starting command-handler extraction before the browser/Electron acceptance
  gate is executable.

Acceptance:

- The existing dependency-free field presentation service projects completed
  and no-turn `/field` lines plus completed and no-turn `/viz` lines as frozen
  arrays.
- The CLI retains field construction, visualization effects, traces, commands,
  state, and the established null/object return contracts.
- Direct fixtures pin dense tables, no-turn guidance, colors, bars, signed
  deltas, path lines, blank lines, label truncation, immutability, and ownership.
- A seeded fake-provider turn has the same normalized `/field` plus `/viz`
  bytes and hash on pre-extraction `main` and this branch without external model
  or API calls.
- Focused/full hermetic, manifest, lint, formatting, cycle, source-only
  workplan, syntax, ref-status, and diff gates pass.

Log:

- 2026-07-28 — Activated from rendered `origin/main` at `0110ccb0` after PR
  #320 merged with all ten CI lanes green. The browser/Electron acceptance gate
  remains triaged, so this slice stays within the residual pure presentation
  boundary explicitly left by the earlier field-helper extraction.
- 2026-07-28 — The seeded keyless fake-provider fixture pins the predecessor's
  normalized `/field` plus `/viz` reports at 521 bytes and SHA-256
  `1b946db75fdc6d8403538d335d1768323eb5711ba83f38f67ef5b8619142863c`.
- 2026-07-28 — The same 521-byte hash passes after extraction. Two pure
  projectors add 62 lines to the existing field presenter, a 175-line direct
  test pins dense/no-turn/path/truncation/ownership branches, and the CLI falls
  from 25,186 to 25,156 lines (30 net). Field construction, file and directory
  writes, trace events, commands, state, and null/object returns stay CLI-owned.
- 2026-07-28 — Review parity is green: 37/37 focused assertions, all 7,337 root
  tests across 533 manifest files, and 137/137 tutor-core tests pass with zero
  skips. Manifest, 246-item source workplan, refs, lint, formatting, syntax,
  diff, and the zero-cycle ratchet across 412 files also pass. The first full
  run was invalid under sandboxed loopback (`EPERM`); the permissioned rerun is
  the recorded complete result.
- 2026-07-28 — Opened PR #323 with the explicit workplan link and source-only
  board discipline; CI is the final review gate.
