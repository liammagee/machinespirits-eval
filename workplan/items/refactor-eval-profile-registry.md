---
id: refactor-eval-profile-registry
title: Establish the canonical evaluation-profile registry
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-25
updated: 2026-07-25
verification: >-
  All 204 YAML cell names are the exact canonical registry; ten explicit legacy
  aliases retain reviewed targets; two-way validation catches either-side
  drift; missing cell and tutor-core targets fail closed; historical database
  usage and focused plus full hermetic parity are recorded.
branch: codex/refactor-eval-profile-registry
depends_on:
  - refactor-field-turn-projection
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - config/tutor-agents.yaml
    - services/evaluationRunner.js
    - scripts/eval-cli.js
    - scripts/report-charisma-desire-router-stage0.js
    - scripts/report-charisma-desire-stage0-matrix.js
  items:
    - codebase-refactoring-program
tags:
  - refactoring
  - configuration
  - registry
  - provenance
milestone: evaluation-infrastructure
---

Bounded R1.4 registry slice: replace the hand-maintained evaluation-cell list
with the YAML source of truth while preserving historical aliases explicitly.

Out of scope:

- Editing any cell architecture, prompt, runner, model, or scenario source.
- Redesigning prompt-type dispatch or adding new empirical conditions.
- Migrating tutor-stub command handlers or the dramatic-derivation facade.
- Running model-backed or paid evaluation calls.

Acceptance:

- Canonical `cell_*` names are derived from `config/tutor-agents.yaml`; aliases
  live in a documented immutable map rather than the canonical cell list.
- Registry validation is two-way and reports YAML-only, registry-only,
  duplicate, malformed, and alias-collision failures.
- A missing `cell_*` name and any missing mapped tutor-core profile fail closed
  instead of continuing through a base-profile fallback.
- Focused registry/resolution/config-validation tests, the cell-discipline
  invariants, full hermetic suite, lint, formatting, cycles, source-only
  workplan, and diff gates pass without model calls.

## Log

- 2026-07-25 — Activated from `origin/main` at `3a4fec48` after confirming
  field-turn projection PR #211 merged. Current inventory is 204 YAML cells,
  one YAML-native `budget` profile, and ten legacy evaluation aliases.
- 2026-07-25 — Audited the real evaluation archive before changing resolution:
  232 historical rows use eight retained aliases (`single_baseline` 44,
  `baseline` 44, `single_baseline_paid` 30, `single_recognition` 29,
  `recognition` 29, `baseline_paid` 27, `recognition_paid` 15, and
  `single_recognition_paid` 14). No historical rows use the two enhanced
  aliases. The archive also contains 218 canonical `budget` rows, 43 `default`
  rows, and four blank profile names; blank provenance remains invalid rather
  than becoming an alias.
- 2026-07-25 — Replaced the 204-entry hand-maintained array with a YAML-derived
  immutable registry and explicit ten-alias map. Unknown `cell_*` names and
  missing in-housed tutor targets now fail closed. `validate-config` reports an
  exact 204-cell/ten-alias match with zero warnings or errors. Two charisma
  report validators that source-grepped `evaluationRunner.js` now consume the
  registry API instead.
- 2026-07-25 — Rebased cleanly onto `origin/main` at `d3b615c3`. Final gates:
  1,587 focused cell/config assertions pass; both report checks pass (18 router
  cases and 72 planned rows); lint, formatting, zero-cycle, manifest, workplan
  source, config validation, and diff checks pass; full hermetic parity passes
  6,692/6,692 root tests plus 137/137 in-housed core tests with zero skips.
