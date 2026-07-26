---
id: refactor-tutor-stub-model-choice-presentation
title: Refactor tutor-stub model-choice presentation
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-26
updated: 2026-07-26
verification: Live tutor and classifier model-choice bytes remain identical
  while pure projection, focused, hermetic, manifest, static, and source-only
  gates pass.
branch: codex/refactor-tutor-stub-model-choice-presentation
claim_status: planned
depends_on:
  - refactor-tutor-stub-dialogue-settings-presentation
links:
  prs:
    - 285
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubModelChoicePresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubModelChoicePresentation.test.js
    - tests/tutorStubHumanDiscourseLayer.test.js
    - tests/tutorStubCommandRegistry.test.js
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-dialogue-settings-presentation
tags:
  - refactoring
  - tutor-stub
  - presentation
  - cli
  - settings
  - models
milestone: evaluation-infrastructure
---

Bounded R3 slice: move the deterministic model-choice list serialization shared
by tutor, classifier, reasoning, and learner roles out of the CLI while
retaining live role/current-model resolution, catalog construction, slash
dispatch, keyboard pickers, selection changes, and terminal writes in their
existing owners.

Out of scope:

- Changing configured models, aliases, ordering, current-model selection,
  access labels, role defaults, role routing, or the 16-row visibility limit.
- Moving provider/model resolution, catalog loading, slash dispatch,
  interactive pickers, model mutation, persistence, traces, model calls, or
  terminal writes.
- Changing colors, markers, padding, line ordering, truncation wording, command
  hints, or trailing blank lines.

Acceptance:

- One dependency-free pure presentation leaf returns model-choice lines from
  an explicit role definition, current ref, resolved entry list, visibility
  limit, and colors.
- The CLI retains definition/current-ref lookup, catalog construction, every
  `/settings model(s)` path, keyboard-picker behavior, and the terminal-writing
  adapter.
- Current/non-current, padded-row, truncated, hidden-count, empty-catalog, and
  role-specific footer fixtures pin exact bytes, frozen results, and input
  immutability.
- Actual pre/post-refactor tutor and classifier choice-list processes exit zero
  with byte-identical output; focused/full hermetic and manifest, lint,
  formatting, cycle, source-only workplan, syntax, and diff gates pass without
  model calls.

Log:

- 2026-07-26 — Activated from rendered `origin/main` at `b3f687a1` after PR
  #280 merged as `955a4ec1` with all ten CI lanes green. Selected only shared
  choice-list serialization; role/catalog resolution, commands, pickers,
  mutations, and terminal ownership remain explicitly out of scope.
- 2026-07-26 — Baseline no-model `/settings model` tutor choice output is 1,292
  bytes over 19 lines with SHA-256
  `dcea4ec3ba403c33674654b5c85d20caf6cce9fa4aa62f3b1497efc9ce1b0e87`;
  `/settings models classifier` is 1,304 bytes over 19 lines with
  `453d9508f0d74796a94a14438c0915719dd11db4434ce5e1a6f3c5276ce33d2b`.
- 2026-07-26 — Added one dependency-free 37-line presentation leaf and reduced
  the CLI by 10 lines. Current/non-current, padding, truncation, hidden-count,
  empty-catalog, role-footer, real-process, settings, command, picker, and
  ownership coverage passes 66/66; both live role lists retain their exact
  baseline bytes and hashes.
- 2026-07-26 — Review parity is green: the permitted-loopback natural-teardown
  hermetic root contract passes 7,105/7,105 across 511 files with zero skips and
  tutor-core passes 137/137 with zero skips. ESLint, Prettier, the zero-cycle
  ratchet across 389 files, synchronized manifest, 220-item source-only
  workplan, syntax, and diff gates pass; generated workplan views remain
  untouched.
- 2026-07-27 — Rebased onto `origin/main` at `c7f5d5cd` after PR #282; the only
  incoming overlap was the hermetic manifest. The combined presentation and
  tutor-benchmark overlap passes 48/48, and final-base parity passes 7,112/7,112
  root tests across 513 files plus 137/137 tutor-core tests, both with zero
  skips. The synchronized manifest, 221-item source-only workplan, ESLint,
  Prettier, zero-cycle ratchet across 391 files, syntax, and diff gates pass.
- 2026-07-27 — PR #285 merged as `b2bb02a3` with all ten CI lanes green; the
  serialized generated-workplan refresh followed as `46fd7e0e`.
