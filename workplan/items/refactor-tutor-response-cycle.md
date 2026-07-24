---
id: refactor-tutor-response-cycle
title: Break the tutor-stub response-configuration import cycle
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-24
updated: 2026-07-24
verification: >-
  Response configuration, dramatic release, and source accessibility import
  only leaf contracts rather than one another; their existing exports retain
  the exact leaf bindings; the static import-cycle gate reports zero cycles;
  and focused plus full hermetic parity passes.
branch: codex/refactor-tutor-response-cycle
depends_on:
  - refactor-tutor-core-cycle
links:
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/200
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  items:
    - codebase-refactoring-program
tags:
  - refactoring
  - tutor-stub
  - imports
  - cycles
  - accessibility
  - contracts
milestone: evaluation-infrastructure
---

Bounded R1.2 slice: remove the tutor-stub response cycle formed by role-surface
predicates, source-accessibility measurement, and a shared audit schema. Do not
change response policy, clue-release behavior, accessibility budgets, prompts,
schemas, public exports, trace shapes, or deterministic fallbacks.

Acceptance:

- Move role-visibility predicates from dramatic release into a dependency-free
  leaf and retain the original dramatic-release exports.
- Move surface-accessibility measurement out of response configuration and
  retain the original response-configuration export.
- Move shared dramatic/source schema identifiers into one dependency-free leaf
  and retain the original dramatic-release and source-contract exports.
- Add exact compatibility-binding coverage and keep the existing focused
  response-configuration, release, and accessibility suites green.
- Ratchet the checked-in static import-cycle baseline from one component to
  zero without weakening the analyzer.
- Pass focused and full hermetic suites, lint, formatting, workplan, and diff
  gates without model or API calls.

Log:

- 2026-07-24 — Activated from merged `main` at `0695cbbf` after PR #198 closed
  R1.1. The static gate reproduced one three-file cycle across 338 production
  service files: response configuration imported dramatic role predicates,
  dramatic release imported the source audit schema, and source accessibility
  imported response surface measurement.
- 2026-07-24 — Extracted those three seams into role-visibility,
  surface-accessibility, and response-schema leaves. All 213 focused assertions
  pass, facade exports retain the exact leaf bindings, and the static gate now
  reports zero cycles across 341 production service files.
- 2026-07-24 — Review gate passed without model or API calls: the full hermetic
  suite completed all 456 root files and all 11 tutor-core files (137/137 core
  tests), while lint, formatting, the 172-item workplan check, and diff checks
  remain green. R1.2 is ready for review.
- 2026-07-24 — PR #200 merged to `main` at `8a48ae04`; the zero-cycle ratchet
  and compatibility projections are now integrated, so R1.2 is closed.
