---
id: refactor-tutor-stub-prompt-blocks
title: Refactor tutor-stub prompt blocks
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: focused 6/6 prompt-block fixtures plus full hermetic root and tutor-core zero-skip contracts preserve delimit/replace and multiple-choice guidance bytes; every static and source-only gate passes
branch: codex/refactor-tutor-stub-prompt-blocks
claim_status: planned
depends_on:
  - refactor-tutor-stub-director-notes-model
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubPromptBlocks.js
    - scripts/tutor-stub.js
    - tests/tutorStubPromptBlocks.test.js
  prs:
    - 368
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-director-notes-model
tags:
  - refactoring
  - tutor-stub
  - prompts
milestone: evaluation-infrastructure
---

Third-loop run 8: move deterministic prompt block delimit/replace behavior and
response-choice guidance into a dependency-free model with injected world
vocabulary.

Acceptance:

- Existing/missing/unterminated block behavior, blank lines, multiple-choice
  and open-response rule order, wording, and world vocabulary remain exact.
- Authored constants, full prompt assembly, world selection, state, and effects
  remain in their current owners.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing prompt content, curriculum blocks, choice policy, or model calls.

Log:

- 2026-07-28 — Moved prompt delimiting, replacement, and response-choice rule
  projection into a dependency-free model, reducing the CLI by 20 lines. Six
  focused assertions and the complete zero-skip hermetic contract pass.
- 2026-07-28 — The required strong benchmark retained the six existing fresh
  candidate quality failures; zero-call same-response re-audit found zero
  regressions and zero safety changes. Recorded on PR #368.
