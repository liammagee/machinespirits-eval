---
id: refactor-tutor-stub-dialogue-memory-context
title: Refactor tutor-stub dialogue-memory and classifier prompt context
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-27
updated: 2026-07-27
verification: Public replay, compact dialogue-memory, and tutor-only learner
  classifier bytes remain exact while focused, hermetic, manifest, static, and
  source-only gates pass.
branch: codex/refactor-tutor-stub-dialogue-memory-context
claim_status: planned
depends_on:
  - refactor-tutor-stub-tutor-prompt-context
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubPublicHistory.js
    - services/tutorStubTutorPromptContext.js
    - scripts/tutor-stub.js
    - tests/tutorStubDialogueMemoryContext.test.js
    - tests/tutorStubTutorPromptContext.test.js
    - tests/tutorStubPromptBehavior.test.js
    - tests/tutorStubRoleHistory.test.js
    - tests/tutorStubPromptSizeReport.test.js
    - tests/tutorStubFirstDraftContract.test.js
    - tests/tutorStubHumanDiscourseLayer.test.js
    - tests/tutorStubAbHarness.test.js
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-tutor-prompt-context
tags:
  - refactoring
  - tutor-stub
  - prompt
  - public-history
  - memory
  - classifier
milestone: evaluation-infrastructure
---

Bounded R3 slice: move deterministic public turn replay, compact public
dialogue-memory serialization, tutor message-context assembly, and tutor-only
learner-classifier serialization out of the CLI while retaining runtime state,
default resolution, prompt assembly, model calls, traces, and effects in their
existing owners.

Out of scope:

- Changing history-window size, memory enablement, learner classification,
  message roles, character-change replay, automated-learner context, or prompt
  assembly semantics.
- Moving `STUB` defaults, state access, classifier invocation, `callTutor`,
  provider calls, model retries, traces, terminal writes, or command handling.
- Changing prompt labels, line order, whitespace, truncation limits, fallback
  values, or learner-safe/public versus tutor-only/private separation.

Acceptance:

- The public-history service owns only public replay and memory projections
  from explicit inputs; tutor-only classifier context remains in the tutor
  prompt-context service.
- The CLI retains thin compatibility wrappers that resolve live state and
  defaults, and every existing runtime call site remains unchanged.
- Public-role filtering, absolute turn numbering, memory-disabled/empty/full
  branches, bounded older milestones, analysis fallbacks, classifier fallbacks,
  exact bytes, immutability, and ownership boundaries have direct fixtures.
- Focused/full hermetic and manifest, lint, formatting, cycle, source-only
  workplan, syntax, commit-link, ref-status, and diff gates pass without model
  or API calls.

Log:

- 2026-07-27 — Activated from rendered `origin/main` at `1dcafabe` after PR
  #311 merged as `2713ea20` with all ten CI lanes green. Selected the adjacent
  pure dialogue-memory and classifier serializers while keeping public-only
  history separate from tutor-only advisory context.
- 2026-07-27 — Added 113 lines across the two existing owner services and
  reduced `scripts/tutor-stub.js` by 80 net lines. A 944-byte compact-memory
  fixture with SHA-256
  `3416b61643d416157224d97f302f3ad93a1e419a78ccb031aedc22d13aace5c7`
  pins truncation, history-window, learner-analysis, and public/private
  boundaries; the widened prompt/replay neighborhood passes 108/108 tests.
- 2026-07-27 — Final parity is green across all 528 selected root test files
  plus 137/137 tutor-core tests with zero core skips. The synchronized
  manifest, 240-item source-only workplan, current ref registry, ESLint,
  Prettier, syntax, diff, and zero-cycle ratchet across 408 files all pass on
  current `origin/main` at `1dcafabe`.
