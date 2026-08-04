---
id: refactor-tutor-stub-human-discourse-config
title: Refactor tutor-stub human discourse config
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-08-04
verification: All three human-discourse mode envelopes remain exact across
  direct, live, focused, hermetic, manifest, static, and source-only gates.
branch: codex/refactor-tutor-stub-human-discourse-config
claim_status: planned
depends_on:
  - refactor-tutor-stub-world-speaker-prompt
links:
  prs:
    - 348
    - 349
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubHumanDiscourseConfig.js
    - scripts/tutor-stub.js
    - tests/tutorStubHumanDiscourseConfig.test.js
    - tests/tutorStubHumanDiscourseLayer.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-world-speaker-prompt
tags:
  - refactoring
  - tutor-stub
  - human-discourse
  - configuration
milestone: evaluation-infrastructure
---

Dependent R3 slice: move the pure three-mode human-discourse run contract and
its stable schema/phase constants into a dependency-free owner. Retain mode
normalization, prompt construction, turn state, DAG execution, model calls,
traces, and effects in their existing owners.

Acceptance:

- Strict, human-scaffold, and defeasible-scaffold config envelopes remain
  deep-equal, including policies, trace fields, and flag coercion.
- Schema and phase identifiers remain exact for every CLI consumer.
- The CLI strictly shrinks while normalization, prompts, state, execution,
  models, traces, and effects stay in their current owners.
- Focused/full hermetic, manifest, lint, formatting, cycle, source-only
  workplan, syntax, ref-status, and diff gates pass.

Out of scope:

- Changing discourse semantics, DAG modes, prompt wording, trace schemas,
  runtime state, model behavior, or terminal behavior.

Log:

- 2026-07-28 — Activated from PR #347's reviewed head at `b7e3c7bb`; the
  24,883-line CLI still owned the pure human-discourse configuration contract.
- 2026-07-28 — Added a 49-line dependency-free config owner and 91 lines of
  direct table tests while reducing the CLI to 24,838 lines. All 51 focused
  config, live human-discourse, prompt-behavior, and world-prompt assertions
  pass.
- 2026-07-28 — Review parity is green: 7,427/7,427 root assertions across 544
  manifest files and 137/137 tutor-core assertions pass with zero skips.
  Manifest, 268-item source workplan, refs, lint, formatting, syntax, diff, and
  the zero-cycle ratchet across 423 files also pass. The first static pass
  identified one stale import and one formatting mismatch; both were removed,
  and the focused/static gates then passed cleanly.
- 2026-07-28 — Opened dependent PR #348 on PR #347's branch; managed refs are
  unchanged.
- 2026-08-04 — Review confirmed the stacked implementation reached `main`
  through consolidated PR #349 after dependent PR #348 was closed unmerged.
