---
id: refactor-tutor-stub-director-context
title: Refactor tutor-stub director initial context
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-08-04
verification: Initial director context and live context/reprise terminal blocks
  remain exact across direct, live, focused, hermetic, manifest, static, and
  source-only gates.
branch: codex/refactor-tutor-stub-director-context
claim_status: planned
depends_on:
  - refactor-tutor-stub-model-choice-catalog
links:
  prs:
    - 345
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubDirectorPresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubDirectorPresentation.test.js
    - tests/tutorStubHumanDiscourseLayer.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-model-choice-catalog
tags:
  - refactoring
  - tutor-stub
  - director
  - context
  - presentation
milestone: evaluation-infrastructure
---

Dependent R3 slice: move deterministic initial director-context construction
beside its existing line projection, with audience-pragmatics lines injected.
Retain audience derivation, prelude state, trace emission, release-note state,
commands, and terminal writes in the CLI.

Acceptance:

- Stage, tutor, learner, audience, and voice fields remain deep-equal,
  including trimming, fallback learner character, and null audience behavior.
- The existing real director context and reprise remain byte/hash exact.
- World and injected audience inputs remain unchanged.
- The CLI strictly shrinks while state, withholding, traces, commands, and
  terminal effects stay in their current owners.
- Focused/full hermetic, manifest, lint, formatting, cycle, source-only
  workplan, syntax, ref-status, and diff gates pass.

Out of scope:

- Changing director wording, audience pragmatics, release scheduling, notes,
  state, commands, traces, prompts, or terminal behavior.

Log:

- 2026-07-28 — Activated from PR #344's reviewed head at `7d89e724`; the
  24,942-line CLI still owned initial director-context construction.
- 2026-07-28 — Added 23 production and 35 direct-test lines to the director
  presentation owner while reducing the CLI to 24,927 lines. All 48 focused
  director, live byte-parity, and human-discourse assertions pass.
- 2026-07-28 — Review parity is green: 7,421/7,421 root assertions across 542
  manifest files and 137/137 tutor-core assertions pass with zero skips.
  Manifest, 265-item source workplan, refs, lint, formatting, syntax, diff, and
  the zero-cycle ratchet across 421 files also pass.
- 2026-07-28 — Opened dependent PR #345 on PR #344's branch; managed refs are
  unchanged.
