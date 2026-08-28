---
id: consolidate-versioned-semantic-study-modules
title: "Consolidate the copy-pasted versioned semantic study modules"
status: review
type: maintenance
priority: P2
owner: codex
branch: codex/consolidate-versioned-semantic-study-modules
source: manual
created: 2026-08-27
updated: 2026-08-27
verification: The 40-module inventory records before/after SHA-256 evidence;
  22 hard-protected and 14 deliberately preserved historical modules plus two
  protected tests remain byte-identical; four demonstrably source-unpinned
  pure V5-V8 builders preserve their legacy paths over one parameterized
  builder and deeply frozen descriptors; the 62-test focused suite, manifest
  check, cycle check, focused lint and format checks, workplan source check,
  and diff check pass.
claim_status: methods
links:
  notes:
    - notes/2026-08-27-versioned-semantic-study-module-consolidation.md
tags:
  - tutor-stub
  - refactor
  - codex-sol
  - effort-ultra
---

The broad inventory contains 40 modules: 20 directly SHA-pinned, two protected
by `.prettierignore`, 14 historical modules deliberately preserved, and four
demonstrably source-unpinned pure builders migrated. The initial 34-file
near-copy estimate is the narrower subset of 18 hard-protected modules, 12
policy-preserved historical governance carriers, and those four builders. Two
adjacent historical tests are also protected by `.prettierignore`.

This is a forward-only consolidation. Every source file protected by an
existing byte pin, sealed study record, GO closure, or `.prettierignore` remains
byte-identical. The 12 unpinned but governance-bearing validation, report, and
analysis carriers also remain byte-identical so the retired source- and
digest-bound approval machinery is not re-entered through new shared code. The
four pure heldout builders retain their legacy paths as side-effect-free
compatibility wrappers over one parameterized builder and deeply frozen
per-version descriptors. The evidence note records baseline and after hashes
without turning those observations into a new source-pin gate.

- 2026-08-27 — Started from clean `origin/main` at `ee2f3db3` in an isolated
  worktree; model-backed study activity remains disabled. Protection and
  migration inventories preceded source edits.
- 2026-08-27 — Recorded the 40-module inventory with before/after SHA-256
  evidence. All 22 hard-protected and 14 deliberately preserved historical
  modules plus two protected tests are byte-identical; no sealed corpus,
  report, registration, GO record, or adjudication instrument changed.
- 2026-08-27 — Routed only the four pure source-unpinned V5-V8 heldout builders
  through one shared deterministic implementation with deeply frozen version
  descriptors and preserved compatibility entrypoints. Equivalence tests
  reproduce all four existing sealed corpora exactly.
- 2026-08-27 — Verification passed: 62/62 focused tests, synchronized hermetic
  manifest, zero static import cycles, focused ESLint and Prettier checks,
  542/542 workplan items valid, and clean diff checks. Dependencies were
  restored mechanically with `npm ci`; no model-backed or paid study ran and
  no model calls were made.
