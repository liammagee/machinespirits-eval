---
id: refactor-tutor-stub-model-choice-catalog
title: Refactor tutor-stub model-choice catalogue
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: Model admission, exclusions, access labels, fallback, ordering,
  and exact terminal blocks remain unchanged across direct, live, focused,
  hermetic, manifest, static, and source-only gates.
branch: codex/refactor-tutor-stub-model-choice-catalog
claim_status: planned
depends_on:
  - refactor-tutor-stub-launch-mode-contract
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubModelChoicePresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubModelChoicePresentation.test.js
    - tests/tutorStubDialogueSettingsPresentation.test.js
    - tests/tutorStubHumanDiscourseLayer.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-launch-mode-contract
tags:
  - refactoring
  - tutor-stub
  - model
  - catalogue
  - presentation
milestone: evaluation-infrastructure
---

Dependent R3 slice: move deterministic model-choice catalogue construction
into the existing presentation owner with provider/configuration functions
injected. Retain provider loading, environment access, role resolution, slash
commands, picker state, and terminal writes in the CLI.

Acceptance:

- Configured providers and the unconfigured current provider remain admitted;
  provider-config failures and unsupported aliases remain excluded.
- CLI login, API-key, local-endpoint, and current-launch access labels remain
  exact.
- Current model sorts first, followed by the established preferred order and
  provider/alias lexical fallback; unresolved current refs remain tolerated.
- Exact real tutor/classifier terminal blocks and settings behavior remain
  byte-identical.
- The CLI strictly shrinks while loading, commands, state, picker behavior,
  role resolution, and effects stay in their current owners.
- Focused/full hermetic, manifest, lint, formatting, cycle, source-only
  workplan, syntax, ref-status, and diff gates pass.

Out of scope:

- Changing providers, preferred models, aliases, configuration, defaults,
  commands, model selection, terminal copy, or runtime state.

Log:

- 2026-07-28 — Activated from PR #343's reviewed head at `42a01a51`; the
  24,989-line CLI still owned the 55-line model catalogue and ordering seam.
- 2026-07-28 — Added 69 production and 106 direct-test lines to the existing
  model-choice owner while reducing the CLI to 24,942 lines. All 55 focused
  catalogue, settings, live byte-parity, and PTY assertions pass.
- 2026-07-28 — Review parity is green: 7,420/7,420 root assertions across 542
  manifest files and 137/137 tutor-core assertions pass with zero skips.
  Manifest, 264-item source workplan, refs, lint, formatting, syntax, diff, and
  the zero-cycle ratchet across 421 files also pass.
