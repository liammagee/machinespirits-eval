---
id: refactor-tutor-stub-world-vocabulary
title: Refactor tutor-stub world presentation vocabulary
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-08-04
verification: Authored ledger and narrative-flavour labels remain byte-exact
  across direct, prompt, response-policy, focused, hermetic, static, manifest,
  and source-only gates.
branch: codex/refactor-tutor-stub-world-vocabulary
claim_status: planned
depends_on:
  - refactor-tutor-stub-world-grouping
links:
  prs:
    - 342
    - 349
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubWorldPresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubWorldCatalogPresentation.test.js
    - tests/tutorStubResponsePolicyContext.test.js
    - tests/tutorStubPromptBehavior.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-world-grouping
tags:
  - refactoring
  - tutor-stub
  - world
  - vocabulary
  - presentation
milestone: evaluation-infrastructure
---

Dependent R3 slice: move the authored public-ledger term and narrative-diction
flavour phrase into the world presentation owner. These are world metadata
labels, not tutor register or engagement stance.

Acceptance:

- Authored `ledger_term` and `narrative_diction` values remain exact.
- Missing metadata retains `evidence record` and `world's authored diction`.
- Existing speaking-tutor, response-policy, and automated-learner prompt tests
  pass without golden changes.
- The CLI strictly shrinks while prompts, call sites, state, traces, register
  policy, and effects remain in their current owners.
- Focused/full hermetic, manifest, lint, formatting, cycle, source-only
  workplan, syntax, ref-status, and diff gates pass.

Out of scope:

- Changing world files, prompt wording, register selection, engagement stance,
  model calls, commands, state, traces, or terminal behavior.

Log:

- 2026-07-28 — Activated from PR #341's reviewed head at `f93e1204`; both pure
  accessors remained inline in the 25,032-line CLI.
- 2026-07-28 — Added nine production and nine direct-test lines to the world
  presentation owner while reducing the CLI to 25,024 lines. All 11 focused
  world, response-policy, and live prompt assertions pass.
- 2026-07-28 — Review parity is green: 7,416/7,416 root assertions across 541
  manifest files and 137/137 tutor-core assertions pass with zero skips.
  Manifest, 262-item source workplan, refs, lint, formatting, syntax, diff, and
  the zero-cycle ratchet across 420 files also pass.
- 2026-07-28 — Opened dependent PR #342 on PR #341's branch with no managed ref
  or version impact.
- 2026-08-04 — Review confirmed the stacked implementation reached `main`
  through consolidated PR #349 after dependent PR #342 was closed unmerged.
