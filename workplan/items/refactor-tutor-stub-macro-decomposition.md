---
id: refactor-tutor-stub-macro-decomposition
title: Decompose tutor-stub into cohesive runtime subsystems
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-29
updated: 2026-08-04
verification: Each macro PR removes at least 750 net lines from scripts/tutor-stub.js on a rolling three-PR average, preserves focused byte/contract parity plus the zero-skip hermetic and static gates, introduces no import cycles or replacement oversized module, and leaves the entry script near 2,000 lines
branch: codex/refactor-tutor-stub-turn-orchestration
claim_status: planned
depends_on: []
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - scripts/tutor-stub.js
    - services/tutorStubCommandRuntime.js
    - services/tutorStubModelPickerController.js
    - services/tutorStubResponsePolicy.js
    - services/tutorStubSessionOrchestration.js
    - services/tutorStubSessionStateRuntime.js
    - services/tutorStubTraceRuntime.js
    - services/tutorStubTurnOrchestration.js
    - services/tutorStubVoiceController.js
    - services/tutorStubTutorTurnPipeline.js
    - tests/tutorStubTutorTurnPipeline.test.js
  prs:
    - 426
    - 427
    - 428
    - 429
    - 430
    - 431
  items:
    - codebase-refactoring-program
tags:
  - refactoring
  - tutor-stub
  - macro-decomposition
  - maintainability
milestone: evaluation-infrastructure
---

Replace helper-sized tutor-stub extractions with a bounded series of cohesive
subsystem PRs. The target is a small composition entrypoint, not a relocated
monolith.

Acceptance:

- Target 1,000–3,000 net lines removed from `scripts/tutor-stub.js` per PR;
  stop and re-plan if the rolling three-PR average falls below 750.
- Keep focused behavioral/byte parity, the zero-skip hermetic suite, lint,
  formatting, manifest, refs, workplan, syntax, and import-cycle gates green.
- Keep runtime state ownership explicit and avoid replacing the entry script
  with another oversized or cyclic module.
- Reuse this card across the macro series rather than creating a card for every
  moved helper.

Planned order:

1. Tutor generation, audit, repair, and committee pipeline.
2. Slash-command routing and dialogue-settings handlers.
3. Session state, trace, resume, and transcript orchestration.
4. Mixed-learner, model-selection, voice, and picker controllers.
5. Response-configuration policy subsystem.
6. Turn processing and automated-learner orchestration.
7. Subsystem facades and entrypoint/import consolidation.

Log:

- 2026-07-29 — Started macro PR 1 from current `origin/main`: extract the
  complete tutor-turn generation pipeline rather than another inner helper.
- 2026-07-29 — Macro PR 1 moved the complete 2,265-line `callTutor`
  generation, streaming, prompt-audit, response-audit, repair, committee, and
  deterministic-fallback pipeline behind one injected dependency boundary.
  `scripts/tutor-stub.js` fell from 23,299 to 21,131 lines, a 2,168-line net
  reduction and a first-cycle rolling average above the 750-line stop floor.
- 2026-07-29 — Three direct transport-path tests and 55 focused
  transport/guard/recovery/prompt/interactive assertions pass. Ownership tests
  now pin the new service boundary, both Program 2 provider-budget reservations
  remain before dispatch, the zero-skip hermetic suite passes 7,664/7,664 root
  tests plus 137/137 tutor-core tests, and the static import graph remains at
  zero cycles across 449 files.
- 2026-07-29 — A manual strong tutor PR benchmark on runtime commit `567df2b5`
  completed all 6 model calls and reported 0 pass / 6 audit failures. This is a
  standing head result, not a base/head regression attribution; the focused
  byte/contract tests and full hermetic suite provide the parity evidence for
  this structural extraction. The new pipeline path is now explicitly in the
  benchmark hook scope so subsequent behavioral edits cannot be skipped.
- 2026-07-29 — Opened macro PR 1 as PR #426.
- 2026-07-29 — Macro cycle 2 moved the 1,305-line dialogue-settings and
  slash-command dispatch bodies behind one injected command-runtime boundary.
  The entrypoint fell from 21,131 to 19,932 lines, a 1,199-line net reduction;
  the two-cycle rolling average is 1,684 lines per PR.
- 2026-07-29 — Cycle 2 verification passes 83 focused command/settings and
  interactive assertions, 13 director/status ownership and exact-byte checks,
  the zero-skip hermetic suite at 7,667/7,667 root plus 137/137 tutor-core
  tests, and every static gate with zero import cycles across 450 files.
- 2026-07-29 — Opened macro cycle 2 as PR #427.
- 2026-08-04 — Refreshed PR #427 onto current `origin/main` after 228 intervening
  commits. The same command-runtime boundary now retains the newer manner-switch,
  quiet-detector, stress-schedule, dramatic-release, and speaker-advisory work;
  `scripts/tutor-stub.js` falls from 21,485 to 20,286 lines. Focused current-main
  contracts pass 56/56, the zero-skip hermetic suite passes 7,732/7,732 root plus
  137/137 tutor-core tests, and all static gates remain green with zero cycles
  across 457 files.
- 2026-07-29 — Macro cycle 3 moved trace/provenance and provider-budget
  bookkeeping, public session snapshots and remembered settings, transcript and
  learning-summary construction, resume/opening/reset state, and scenario or
  workplan relaunch orchestration behind three cohesive injected boundaries.
  The entrypoint fell from 19,932 to 18,944 lines, a 988-line net reduction;
  the rolling three-cycle average is 1,452 lines per PR.
- 2026-07-29 — Cycle 3 verification passes 103 focused session, trace,
  relaunch, transcript, settings, and Program 2 assertions plus the zero-skip
  hermetic suite at 7,671/7,671 root and 137/137 tutor-core tests. The focused
  regression set also covers the early non-interactive, passthrough, and
  metered-lab lifecycle paths that caught and closed two initialization-order
  regressions during extraction.
- 2026-08-04 — Refreshed PR #428 onto the updated PR #427 base. Session, trace,
  transcript, resume, training-reuse, passthrough, HTTP, and Program 2 focused
  contracts pass 95/95; the zero-skip hermetic suite passes 7,736/7,736 root
  plus 137/137 tutor-core tests. The extraction still removes 988 lines from
  the entrypoint (20,286 to 19,298), with zero static cycles across 460 files.
- 2026-08-04 — After PR #427 merged, rebased PR #428 onto current
  `origin/main`. The session-orchestration runtime patch remains byte-equivalent;
  a current focused recheck passes 87/87, all static gates remain green across
  374 workplan items with zero cycles across 460 files, and the entrypoint
  reduction remains 988 lines.
- 2026-07-29 — Opened macro cycle 3 as stacked PR #428.
- 2026-07-29 — Macro cycle 4 moved live tutor/model-role mutation,
  model/register/character/profile/settings pickers, and the Realtime voice
  bridge lifecycle behind two controller boundaries. The entrypoint fell from
  18,944 to 17,678 lines, a 1,266-line net reduction; the rolling three-cycle
  average is 1,151 lines per PR.
- 2026-07-29 — Cycle 4 verification passes 88 focused voice, model, settings,
  profile, character, and TTY assertions plus the zero-skip hermetic suite at
  7,673/7,673 root and 137/137 tutor-core tests. Direct boundary tests pin the
  disabled voice projection, four-role model catalog, and TTY picker ownership.
- 2026-07-29 — Opened macro cycle 4 as stacked PR #429.
- 2026-08-04 — Refreshed PR #429 onto the updated PR #428 base without a source
  conflict. Current controller, model, picker, profile, character, and voice
  contracts pass 41/41; the zero-skip hermetic suite passes 7,738/7,738 root
  plus 137/137 tutor-core tests. The extraction still removes 1,266 entrypoint
  lines (19,298 to 18,032), with zero static cycles across 462 files.
- 2026-08-04 — Restacked PR #429 onto the post-merge refresh of PR #428. The
  non-workplan extraction patch remains byte-equivalent; a current focused
  controller and voice recheck passes 35/35, all static gates remain green
  across 374 workplan items with zero cycles across 462 files, and the
  entrypoint reduction remains 1,266 lines.
- 2026-07-29 — Macro cycle 5 moved engagement-stance selection, field/state/
  trajectory/dynamical policies, explicit and stochastic character
  directives, overlay composition, sampling, and final response-configuration
  normalization behind one policy boundary. The entrypoint fell from 17,678
  to 15,847 lines, a 1,831-line net reduction; the rolling three-cycle average
  is 1,362 lines per PR.
- 2026-07-29 — Cycle 5 verification passes 226 focused policy, configuration,
  field, state, trajectory, dynamical, character, and stochastic-adaptation
  assertions plus the zero-skip hermetic suite at 7,675/7,675 root and 137/137
  tutor-core tests.
- 2026-08-04 — Refreshed PR #430 onto the updated PR #429 base. The newer
  manner-switch, quiet, stress, dramatic-release, and speaker-advisory paths
  remain in their current owners while the response-policy boundary replays
  intact. A broad focused set passes 400/400, the zero-skip hermetic suite
  passes 7,740/7,740 root plus 137/137 tutor-core tests, and the extraction
  still removes 1,831 entrypoint lines (18,032 to 16,201), with zero static
  cycles across 463 files.
- 2026-08-04 — Restacked PR #430 onto the post-merge refresh of PR #429,
  resolving only the additive workplan history. Its non-workplan extraction
  patch remains byte-equivalent; a broader current policy recheck passes
  452/452, all static gates remain green across 374 workplan items with zero
  cycles across 463 files, and the entrypoint reduction remains 1,831 lines.
- 2026-07-29 — Opened macro cycle 5 as stacked PR #430.
- 2026-07-29 — Macro cycle 6 moved passthrough and guarded turn execution,
  analyzed-turn preparation, quarantine continuation, opening emission, and
  automated-learner loop orchestration behind one turn-runtime boundary. The
  entrypoint fell from 15,847 to 14,648 lines, a 1,199-line net reduction; the
  rolling three-cycle average is 1,432 lines per PR.
- 2026-07-29 — Cycle 6 verification passes 80 focused turn, auto-learner,
  passthrough, timing, cancellation, DAG-snapshot ownership, and direct boundary
  assertions plus the zero-skip hermetic suite at 7,676/7,676 root and 137/137
  tutor-core tests.
- 2026-07-29 — Opened macro cycle 6 as stacked PR #431.
