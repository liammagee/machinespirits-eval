---
id: refactor-tutor-stub-world-grouping
title: Refactor tutor-stub world family grouping
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: World family keys and base-first grouping remain deep-equal while
  identity, immutability, catalogue hash, picker, focused, hermetic, manifest,
  static, and source-only gates pass.
branch: codex/refactor-tutor-stub-world-grouping
claim_status: planned
depends_on:
  - refactor-tutor-stub-picker-entries
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubWorldPresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubWorldCatalogPresentation.test.js
    - tests/tutorStubPickerPresentation.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-picker-entries
tags:
  - refactoring
  - tutor-stub
  - world
  - grouping
  - presentation
milestone: evaluation-infrastructure
---

Dependent R3 slice: move presentation-family key resolution and deterministic
base-first family grouping into the existing world presentation owner while
retaining filesystem discovery, world loading, production eligibility, picker
and catalogue calls, commands, and terminal effects in the CLI.

Acceptance:

- Family key precedence remains authored family, variant base, then world ID.
- First family occurrence controls family order; an authored base moves before
  its variants; a variant-only family treats its first member as the base.
- World and file-path identity, family sizes, input order, and input
  immutability are pinned directly.
- The live catalogue remains 71 lines, 6,670 bytes, and SHA-256
  `a7f97c026e1f19d18d56b3f061ecf51772a76c22fa2dc121df9a58d91dafd42c`.
- The CLI strictly shrinks and retains loading, eligibility, commands, picker,
  and terminal ownership.
- Focused/full hermetic, manifest, lint, formatting, cycle, source-only
  workplan, syntax, ref-status, and diff gates pass.

Out of scope:

- Changing world metadata, order, eligibility, summaries, catalogue lines,
  picker behavior, commands, prompts, register policy, or terminal effects.
- Moving filesystem discovery or world loading.

Log:

- 2026-07-28 — Activated from PR #340's reviewed head at `1dcdb53c`; the CLI
  was 25,050 lines and world grouping remained an 18-line inline algorithm.
- 2026-07-28 — Added 23 production lines and 33 direct-test lines to the world
  presentation owner while reducing the CLI to 25,032 lines. All 21 focused
  world, quality, picker, grouping, identity, and live hash assertions pass.
- 2026-07-28 — Review parity is green: 7,416/7,416 root assertions across 541
  manifest files and 137/137 tutor-core assertions pass with zero skips.
  Manifest, 261-item source workplan, refs, lint, formatting, syntax, diff, and
  the zero-cycle ratchet across 420 files also pass.
