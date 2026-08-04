---
id: refactor-tutor-stub-world-public-prompt
title: Refactor tutor-stub world public prompt
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-08-04
verification: Public world prompt lines remain exact across direct, live,
  focused, hermetic, manifest, static, and source-only gates.
branch: codex/refactor-tutor-stub-world-public-prompt
claim_status: planned
depends_on:
  - refactor-tutor-stub-director-context
links:
  prs:
    - 346
    - 349
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubWorldPromptContext.js
    - scripts/tutor-stub.js
    - tests/tutorStubWorldPromptContext.test.js
    - tests/tutorStubPromptBehavior.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-director-context
tags:
  - refactoring
  - tutor-stub
  - world
  - prompt
  - presentation
milestone: evaluation-infrastructure
---

Dependent R3 slice: move deterministic public world-prompt projection into a
dependency-free owner, with audience-pragmatics lines injected. Retain world
loading, audience derivation, prompt assembly, model calls, state, and effects
in their existing owners.

Acceptance:

- Public scene, role, question, audience, and task lines remain exact.
- Optional discipline/setting/learner fields and null-world behavior remain
  unchanged.
- World and injected audience inputs remain unchanged.
- The CLI strictly shrinks while loading, audience derivation, prompts, state,
  model calls, and terminal effects stay in their current owners.
- Focused/full hermetic, manifest, lint, formatting, cycle, source-only
  workplan, syntax, ref-status, and diff gates pass.

Out of scope:

- Changing prompt wording, audience pragmatics, evidence rules, release
  scheduling, runtime state, model behavior, or terminal behavior.

Log:

- 2026-07-28 — Activated from PR #345's reviewed head at `0da00401`; the
  24,927-line CLI still owned deterministic public world-prompt projection.
- 2026-07-28 — Added a 29-line dependency-free projector and 58 lines of direct
  tests while reducing the CLI to 24,902 lines. All 53 focused public-prompt,
  world-presentation, live behavior, and human-discourse assertions pass.
- 2026-07-28 — Review parity is green: 7,423/7,423 root assertions across 543
  manifest files and 137/137 tutor-core assertions pass with zero skips.
  Manifest, 266-item source workplan, refs, lint, formatting, syntax, diff, and
  the zero-cycle ratchet across 422 files also pass. The initial sandboxed
  hermetic attempt could not bind localhost (`listen EPERM`); the authorized
  hermetic rerun passed in full.
- 2026-07-28 — Opened dependent PR #346 on PR #345's branch; managed refs are
  unchanged.
- 2026-08-04 — Review confirmed the stacked implementation reached `main`
  through consolidated PR #349 after dependent PR #346 was closed unmerged.
