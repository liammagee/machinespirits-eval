---
id: refactor-tutor-stub-stack-recovery
title: Recover orphaned tutor-stub refactor stack
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: The seven preserved slices pass focused, full hermetic, manifest,
  static, source-only workplan, ref-status, syntax, and diff gates on current
  origin/main ancestry.
branch: codex/refactor-tutor-stub-human-discourse-config
claim_status: planned
links:
  prs:
    - 349
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - scripts/tutor-stub.js
    - services/tutorStubHumanDiscourseConfig.js
    - services/tutorStubWorldPromptContext.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-world-vocabulary
    - refactor-tutor-stub-launch-mode-contract
    - refactor-tutor-stub-model-choice-catalog
    - refactor-tutor-stub-director-context
    - refactor-tutor-stub-world-public-prompt
    - refactor-tutor-stub-world-speaker-prompt
    - refactor-tutor-stub-human-discourse-config
tags:
  - refactoring
  - tutor-stub
  - git
  - stack-recovery
milestone: evaluation-infrastructure
---

Recover the seven reviewed refactor slices that remained on intermediate
feature branches after stacked PRs were merged out of order. Rebase their
preserved final branch onto current `origin/main` and expose the cumulative,
source-only delta through one explicit recovery PR before extending the stack.

Acceptance:

- Current `origin/main` is an ancestor of the recovery branch.
- The cumulative delta contains exactly the seven reviewed implementation
  slices, their tests/manifests, and authored workplan sources.
- No generated workplan view is included.
- Focused/full hermetic, manifest, lint, formatting, cycle, source-only
  workplan, syntax, ref-status, and diff gates pass.

Out of scope:

- Changing the behavior or scope of any recovered refactor, rewriting generated
  board views, merging the PR, or deleting historical branches.

Log:

- 2026-07-28 — Audited PRs #340–#348 after the first ten-run loop. Only runs
  1–3 reached `main`; later slices were alternately merged into intermediate
  feature branches or automatically closed when those bases disappeared.
- 2026-07-28 — Rebased the preserved final branch cleanly onto current
  `origin/main` at `ac292dad`. The cumulative delta is 22 source/test/workplan
  files with no generated board view.
- 2026-07-28 — Recovery verification is green: 69/69 focused assertions,
  7,427/7,427 root assertions across 544 manifest files, and 137/137 tutor-core
  assertions pass with zero skips. Manifest, 269-item source workplan, refs,
  lint, formatting, syntax, diff, and the zero-cycle ratchet across 423 files
  also pass.
- 2026-07-28 — Opened recovery PR #349 directly against `main`; managed refs
  are unchanged.
