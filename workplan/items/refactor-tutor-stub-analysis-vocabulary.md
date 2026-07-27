---
id: refactor-tutor-stub-analysis-vocabulary
title: Refactor tutor-stub analysis vocabulary helpers
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-27
updated: 2026-07-27
verification: Policy labels, field-signal explanations, dominant-signal
  selection, and strategy-text normalization remain exact while focused,
  hermetic, static, and source-only gates pass.
branch: codex/refactor-tutor-stub-analysis-vocabulary
claim_status: planned
depends_on:
  - refactor-tutor-stub-dialogue-memory-context
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubResponseDetails.js
    - scripts/tutor-stub.js
    - tests/tutorStubResponseDetails.test.js
    - tests/tutorStubDialogueSettingsPresentation.test.js
    - tests/tutorStubSessionStatusPresentation.test.js
    - tests/tutorStubInterimPresentation.test.js
    - tests/tutorStubInteractiveHelp.test.js
    - tests/tutorStubCommandRegistry.test.js
    - tests/tutorStubRegisterPolicyComposition.test.js
    - tests/tutorStubCapabilities.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-dialogue-memory-context
tags:
  - refactoring
  - tutor-stub
  - presentation
  - analysis
  - vocabulary
  - register-policy
milestone: evaluation-infrastructure
---

Bounded R3 slice: move shared teaching-policy labels, learner-state signal
explanations, dominant-signal selection, and internal-jargon normalization out
of the CLI and into the existing response-details presentation owner. This
prepares the larger turn-analysis renderer without moving its terminal or state
boundaries.

Out of scope:

- Changing register selection, field vectors, the 0.15 display threshold,
  classifier data, teaching policy semantics, prompts, traces, or runtime state.
- Moving `printCurrentTurnAnalysis`, technical analysis, interim-state
  derivation, settings/status derivation, commands, terminal writes, or model
  calls.
- Changing labels, replacement order, numeric coercion, sorting, limits,
  punctuation, or fallback text.

Acceptance:

- The existing response-details service owns the four pure helpers from
  explicit inputs and performs no effects.
- Existing CLI call sites retain their local compatibility names through
  import aliases; no caller or state derivation moves.
- Every authored policy and signal label, fallback, threshold, numeric-string,
  ordering, limit, immutability, jargon replacement, and null branch has direct
  characterization coverage.
- Focused/full hermetic, lint, formatting, cycle, source-only workplan,
  manifest, syntax, ref-status, and diff gates pass without model or API calls.

Log:

- 2026-07-27 — Activated from rendered `origin/main` at `2f38e863` after PR
  #312 merged as `0bbd95a5` with all ten CI lanes green. Selected only the four
  pure vocabulary helpers reused by analysis, interim, settings, and status
  surfaces; the larger renderers and runtime remain CLI-owned.
- 2026-07-27 — Added 62 lines to the existing response-details service and
  reduced `scripts/tutor-stub.js` by 59 net lines. Direct coverage pins all 11
  policy labels, all 17 signal explanations, the 0.15 dominance threshold,
  numeric coercion, ordering/limits, immutability, fallback normalization, and
  jargon-replacement order; the widened presentation/command neighborhood
  passes 62/62 tests.
- 2026-07-27 — Final parity is green across all 528 selected root test files
  plus 137/137 tutor-core tests with zero core skips. The 241-item source-only
  workplan, synchronized manifest, current ref registry, ESLint, Prettier,
  syntax, diff, and zero-cycle ratchet across 408 files all pass on
  `origin/main` at `2f38e863`.
