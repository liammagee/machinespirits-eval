---
id: refactor-tutor-stub-extracted-owner-boundaries
title: Split oversized tutor-stub pipeline and response-policy owners
status: active
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-05
updated: 2026-08-05
branch: codex/refactor-tutor-stub-extracted-owner-boundaries
verification: The tutor-turn pipeline and response-policy modules are decomposed into cohesive tested owners without changing their public facades; focused parity, zero-skip hermetic, lint, source, and zero-cycle gates pass; no replacement owner exceeds the agreed boundary ceiling.
claim_status: planned
depends_on: []
links:
  code:
    - services/tutorStubTutorTurnPipeline.js
    - services/tutorStubTutorTurnPreparation.js
    - services/tutorStubTutorAttemptRuntime.js
    - services/tutorStubTutorDraftAudit.js
    - services/tutorStubResponsePolicy.js
    - scripts/tutor-stub.js
  items:
    - refactor-tutor-stub-macro-decomposition
    - codebase-refactoring-program
tags:
  - refactoring
  - tutor-stub
  - boundaries
  - maintainability
milestone: evaluation-infrastructure
---

The entrypoint has reached its near-2,000 functional-body destination. The
remaining structural risk is concentrated in two extracted owners rather than
in `scripts/tutor-stub.js`: the 2,581-line tutor-turn pipeline and 1,975-line
response-policy module.

Acceptance:

- Preserve `createTutorStubTutorTurnPipeline()` and
  `createTutorStubResponsePolicy()` as compatibility facades while assigning
  prompt assembly, draft audit, repair/committee execution, policy
  selection/sampling, and response-configuration composition to explicit
  owners.
- Set a concrete owner-size ceiling before implementation and stop if the
  extraction merely relocates either monolith.
- Preserve byte/contract behavior, Program-2 budget reservations, trace shape,
  guard dispositions, seeded policy sampling, and current public exports.
- Run the focused ownership and behavioral suites, complete zero-skip hermetic
  suite, lint/format/source checks, and static import-cycle gate.

Log:

- 2026-08-05 — Created during board reconciliation after PR #484 merged. This
  is the next bounded refactoring slice; it is not yet active and has no branch
  or worktree.
- 2026-08-05 — Activated from merged PR #486 on current `origin/main`. The
  owner-size ceiling is 1,200 production source lines: the existing facades may
  remain smaller delegators, but neither extracted implementation owner may
  replace the current monolith above that ceiling. Start with prompt assembly
  and draft-audit ownership inside the tutor-turn pipeline; response policy is
  the second bounded pass.
- 2026-08-05 — First pipeline pass moved prompt/context preparation (391 LOC),
  provider-attempt execution (317 LOC), and the draft-audit battery (343 LOC)
  behind dependency-injected owners. The compatibility pipeline fell from
  2,581 to 1,887 LOC; all new owners remain below the 1,200-line ceiling, and a
  source-boundary test protects both delegation and that ceiling. Program-2
  reservation order, guard-call sequencing, trace events, prompt recovery, and
  streaming/CLI/direct response envelopes remain on their original behavioural
  paths. The card stays active: committee/repair ownership and the separately
  bounded response-policy pass remain.
- 2026-08-05 — Verified the first pass with 92/92 focused tests, the complete
  hermetic suite (7,776/7,776 root and 137/137 tutor-core tests; zero skips),
  ESLint, Prettier, workplan source validation, diff checks, and a zero-cycle
  static import graph across 510 files. Extended the v0.7.0 stability manifest
  from 15 to 18 pins so all three new runtime owners remain covered rather than
  leaving the compatibility facade as a misleading sole pin.
- 2026-08-05 — Rebased the uncommitted slice without conflicts after
  `origin/main` advanced through the tutor-prompt agency audit and generated
  board refresh. On that exact updated base, 96/96 focused-plus-baseline tests,
  the synchronized hermetic manifest, all static gates, and the complete
  zero-skip hermetic suite passed again.
