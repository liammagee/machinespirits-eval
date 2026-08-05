---
id: refactor-tutor-stub-extracted-owner-boundaries
title: Split oversized tutor-stub pipeline and response-policy owners
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-05
updated: 2026-08-05
verification: The tutor-turn pipeline and response-policy modules are decomposed into cohesive tested owners without changing their public facades; 207 focused policy/configuration tests, 7,836 root tests, and 137 tutor-core tests pass with zero failures or skips; prompt/world, lint, format, source, manifest, benchmark re-audit, and zero-cycle gates pass; no replacement owner exceeds the 1,200-line ceiling.
claim_status: planned
depends_on: []
links:
  prs:
    - 507
  code:
    - services/tutorStubTutorTurnPipeline.js
    - services/tutorStubTutorTurnPreparation.js
    - services/tutorStubTutorAttemptRuntime.js
    - services/tutorStubTutorCommitteeRuntime.js
    - services/tutorStubTutorDeliveryRuntime.js
    - services/tutorStubTutorDraftAudit.js
    - services/tutorStubTutorRepairRuntime.js
    - services/tutorStubTutorTerminalRuntime.js
    - services/tutorStubResponsePolicy.js
    - services/tutorStubResponsePolicySelectionRuntime.js
    - services/tutorStubAdaptiveResponsePolicyRuntime.js
    - services/tutorStubResponseConfigurationSelectionRuntime.js
    - config/stability/baseline-v0.7.0.json
    - config/tutor-pr-benchmark.yaml
    - scripts/generate-baseline-manifest.js
    - tests/tutorStubResponsePolicyRuntime.test.js
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
- 2026-08-05 — Opened first-pass PR #487 at `ce771831`, then started the
  committee/repair continuation on a separate stacked branch. The first seam
  moved the complete Program-2 committee mini/composer, fallback-battery,
  resampling, budget, and trace runtime into a 245-line owner; the compatibility
  pipeline is now 1,705 LOC. Its 19th stability pin and source-boundary ceiling
  check are in place, with 46/46 focused tests, ESLint, Prettier, diff checks,
  the zero-cycle graph, and the complete hermetic suite passing with zero
  skips. Repair orchestration remains the next seam in this pass.
- 2026-08-05 — Opened committee-runtime PR #488 at `a65319ec`, then started the
  repair/fallback continuation on a separate stacked branch. To keep every
  owner below the 1,200-line ceiling, first extracted delivery decisions, safe
  uptake preservation, fallback composition, audit attachment, and recovery
  response envelopes into a 186-line prerequisite owner. The pipeline is now
  1,589 LOC, the stability manifest has 20 pins, and 18/18 focused tests plus
  ESLint, Prettier, diff checks, and the zero-cycle graph pass. The complete
  hermetic suite also passes on the rebased slice (7,780/7,780 root and 137/137
  tutor-core tests; zero failures and zero skips). The model and mechanical
  repair ladder remains the next extraction inside this item.
- 2026-08-05 — Opened delivery-runtime PR #490 at `17026f99`, then extracted
  the complete model/mechanical ladder on the stacked continuation: host-part,
  simplified model, composition, question-support, source-voice, and final
  self-correction repairs now live in a 685-line owner. The compatibility
  pipeline falls from 1,589 to 942 lines, so both it and the new owner are below
  the 1,200-line ceiling. Clue insertion and deterministic terminal fallback
  remain together for the next explicit boundary. Verified with 342/342
  repair/delivery parity tests, the complete hermetic suite (7,787/7,787 root
  and 137/137 tutor-core tests; zero failures and zero skips), ESLint,
  Prettier, workplan and stability-manifest checks, and a zero-cycle import
  graph across 513 files.
- 2026-08-05 — Opened repair-ladder PR #491 at `14ecebed`, then moved the final
  contiguous terminal path behind a 406-line owner: narrowly licensed clue-span
  insertion runs first, followed by deterministic fallback selection,
  construction, audit, accounting, delivery, or fail-closed rejection. The
  compatibility pipeline falls from 942 to 647 lines; the stability manifest
  now pins 22 owners and the boundary test prevents the terminal implementation
  from returning to the facade. Verified with 342/342 repair/delivery parity
  tests, the complete hermetic suite (7,787/7,787 root and 137/137 tutor-core
  tests; zero failures and zero skips), ESLint, Prettier, workplan and manifest
  checks, and a zero-cycle import graph across 514 files. This completes the
  tutor-turn pipeline boundary; the separately bounded response-policy pass
  remains active on this card.
- 2026-08-05 — Rebased the terminal-runtime extraction onto current `main`
  after PRs #494 and #495 merged. The owner continues to call the current guard
  calibration, fallback-composition, progression, and request-only plan paths
  through injected dependencies rather than preserving stale copies. PR #495's
  request-only path adds two lines to the compatibility facade, leaving it at
  649 LOC on the current base. Verified on that base with 247/247 focused
  terminal, orchestration, guard, composition, closure, disclosure, and
  benchmark-regression tests; the complete hermetic suite (7,806/7,806 root
  and 137/137 tutor-core tests; zero failures and zero skips); ESLint; Prettier;
  workplan, hermetic-manifest, stability-manifest, and diff checks; a zero-cycle
  import graph across 515 files; and a zero-call re-audit of the saved six-case
  tutor benchmark (0 improved, 0 regressed).
- 2026-08-05 — Activated the response-policy pass from current `origin/main` at
  `271d01ca` on `codex/refactor-tutor-stub-policy-selection-owner`. The
  1,975-line policy owner will become three bounded implementation owners—core
  seeded selection, adaptive policy families, and final response-configuration
  composition—behind the unchanged `createTutorStubResponsePolicy()` facade.
  The existing 1,200-line production-owner ceiling applies independently to
  all three, preventing this pass from replacing one monolith with another.
- 2026-08-05 — Completed the response-policy pass without changing the public
  facade: the former 1,975-line owner is now a 26-line compatibility facade over
  core seeded selection (643 LOC), adaptive policy families (726 LOC), and
  final response-configuration composition (671 LOC). A direct boundary test
  enforces the 1,200-line ceiling and exact ten-method facade contract; the
  stability manifest now pins all three owners plus the facade, and the tutor
  PR benchmark scope follows their new paths.
- 2026-08-05 — Verification passed: 207/207 focused policy, configuration,
  character, light-adaptation, continuous, overlay, and interactive tests;
  derivation quality 35/35; prompt/world boundary tests 21/21; complete root
  hermetic 7,836/7,836 and tutor-core hermetic 137/137 with zero skips; ESLint,
  Prettier, workplan source, hermetic manifest, stability manifest, diff, and a
  518-file zero-cycle import graph. A zero-call re-audit of the saved six-case
  strong tutor benchmark passed with 0 improved and 0 regressed. The first
  sandboxed root attempt failed only because localhost listeners were denied;
  the permitted hermetic rerun is the recorded result. Moved the item to review.
- 2026-08-05 — Refreshed the uncommitted worktree without conflict onto current
  `origin/main` at `a6377faa` after seven paper/ref-status/workplan-only commits
  landed. Repeated all 207 focused tests, every static and manifest gate, the
  exact-base root 7,836/7,836 and tutor-core 137/137 hermetic suites, the 35/35
  world and 21/21 prompt/world quality gates, and the zero-call six-case
  benchmark re-audit; all remain green with zero skips and zero regressions.
- 2026-08-05 — Committed the completed response-policy boundary at `fe48c254`,
  pushed `codex/refactor-tutor-stub-policy-selection-owner`, and opened PR #507
  for review. The pre-push benchmark hook recorded a reasoned bypass because
  fresh external-model calls were not authorized; the PR reports the complete
  deterministic suite and zero-call saved-response re-audit instead.
- 2026-08-05 — PR #507 merged at `7c8e77fd` with the complete CI matrix green.
  Confirmed its clean head `c36f3b7f` is contained in `origin/main`, removed the
  isolated worktree, and closed the card with every facade, owner-ceiling, and
  parity acceptance criterion satisfied.
