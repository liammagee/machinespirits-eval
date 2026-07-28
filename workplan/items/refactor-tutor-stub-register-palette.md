---
id: refactor-tutor-stub-register-palette
title: Refactor tutor-stub register palette
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: Register palette modes and diagnostics remain exact across
  direct, live, focused, hermetic, manifest, static, and source-only gates.
branch: codex/refactor-tutor-stub-register-palette
claim_status: planned
depends_on:
  - refactor-tutor-stub-stack-recovery
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubRegisterPalette.js
    - scripts/tutor-stub.js
    - tests/tutorStubRegisterPalette.test.js
    - tests/tutorStubHumanDiscourseLayer.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-stack-recovery
tags:
  - refactoring
  - tutor-stub
  - register
  - configuration
milestone: evaluation-infrastructure
---

Second-loop run 1: move pure register-palette selection into a dependency-free
owner, injecting registry definitions, safe/negative sets, and alias
resolution. Retain registry loading, CLI parsing, runtime state, and effects in
their existing owners.

Acceptance:

- Named modes, custom lists, aliases, ordering, de-duplication, and exact
  unknown-register errors remain unchanged.
- Registry inputs remain unchanged.
- The CLI strictly shrinks while registry loading, parsing, state, and effects
  stay in their current owners.
- Focused/full hermetic, manifest, lint, formatting, cycle, source-only
  workplan, syntax, ref-status, and diff gates pass.

Out of scope:

- Changing available registers, safety/simulation classification, alias
  behavior, runtime selection policy, or terminal behavior.

Log:

- 2026-07-28 — Activated from recovery PR #349's reviewed head at `e0ebfc79`;
  the 24,838-line CLI still owned pure register-palette selection.
- 2026-07-28 — Added a 33-line dependency-free owner and 35 lines of direct
  tests while reducing the CLI to 24,816 lines. All 67 focused palette, live
  dry-run, and register-policy assertions pass.
- 2026-07-28 — Review parity is green: 7,429/7,429 root assertions across 545
  manifest files and 137/137 tutor-core assertions pass with zero skips.
  Manifest, 270-item source workplan, refs, lint, formatting, syntax, diff, and
  the zero-cycle ratchet across 424 files also pass.
