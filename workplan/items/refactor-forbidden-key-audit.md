---
id: refactor-forbidden-key-audit
title: Consolidate dramatic forbidden-key auditing
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-25
updated: 2026-07-25
verification: >-
  One pure recursive walker serves all seven dramatic public-input audits; a
  shared nested mutation corpus proves each caller retains its exact key policy,
  leak order, and path shape; focused and full hermetic suites pass.
branch: codex/refactor-forbidden-key-audit
depends_on:
  - refactor-field-policy-helpers
links:
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/210
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/dramaticDerivation/forbiddenKeyAudit.js
    - tests/dramaticDerivationConductPolicy.test.js
  items:
    - codebase-refactoring-program
tags:
  - refactoring
  - dramatic-derivation
  - non-leak-audit
  - duplication
milestone: evaluation-infrastructure
---

Bounded R1.3 duplicate-removal slice: replace the seven exact recursive
forbidden-key walkers in the dramatic-derivation conduct, ownership,
calibration, learner-drift, cast, didactic-mode, and learner-transformation
modules with one pure helper. Each caller retains its deliberately different
forbidden-key set and established public wrapper.

Out of scope:

- Adding, removing, or reconciling caller-specific forbidden keys.
- Changing traversal order, leak path syntax, return schemas, or public exports.
- Changing proof authority, prompt projection, persistence, or runtime policy.

Acceptance:

- One dependency-free helper owns recursive object and array traversal plus
  leak-path construction; the seven caller-local walker definitions are gone.
- Every established audit wrapper retains its own key set, `ok`, `leaks`, and
  sorted `forbiddenKeys` contract.
- One shared nested mutation corpus proves exact caller-specific leak paths and
  traversal order before and after consolidation.
- Focused dramatic-derivation tests, the full hermetic suite, lint, formatting,
  workplan source validation, cycle, and diff gates pass without model or API
  calls.

Log:

- 2026-07-25 — Activated from merged `main` at `e43fd708` after PR #208 closed
  the field-policy helper slice. Selected as the next duplication leaf under
  the permanent source-only workplan workflow.
- 2026-07-25 — Added one shared nested mutation corpus against all seven public
  wrappers before changing production code; the historical copies passed with
  their deliberate conduct, general, proof-tree, and learner-state policy
  differences intact.
- 2026-07-25 — Replaced seven local recursive walkers with one dependency-free
  helper while preserving every caller-owned key set and wrapper schema. All 82
  focused assertions pass; the complete hermetic gate passes all 459 root test
  files with no skips plus all 11 tutor-core files (137/137), alongside lint,
  formatting, zero static cycles across 346 files, the 177-item workplan source
  check, and diff checks. Ready for review without model or API calls.
- 2026-07-25 — Rebased onto merged `main` at `e43fd708` after PR #208 and
  preserved both child histories in the parent-card resolution. Repeated 82/82
  focused assertions, lint, formatting, zero cycles across 347 files, the
  178-item source-only workplan check, and diff checks; generated board views
  remain outside the feature diff.
- 2026-07-25 — Opened PR #210 with explicit workplan and ref-impact metadata.
