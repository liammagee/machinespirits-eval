---
id: refactor-tutor-stub-macro-decomposition
title: Decompose tutor-stub into cohesive runtime subsystems
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-29
updated: 2026-08-05
verification: Each macro PR removes at least 750 net lines from scripts/tutor-stub.js on a rolling three-PR average, preserves focused byte/contract parity plus the zero-skip hermetic and static gates, introduces no import cycles or replacement oversized module, and leaves the entry script near 2,000 lines
claim_status: planned
depends_on: []
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - scripts/tutor-stub.js
    - services/tutorStubAutomatedLearnerGenerationRuntime.js
    - services/tutorStubApplicationState.js
    - services/tutorStubApplicationTraceContext.js
    - services/tutorStubCharacterControlController.js
    - services/tutorStubClarificationTranslationRuntime.js
    - services/tutorStubCliArguments.js
    - services/tutorStubCommandRuntime.js
    - services/tutorStubDebugReportRuntime.js
    - services/tutorStubFeedbackTuningController.js
    - services/tutorStubInteractiveAutomationController.js
    - services/tutorStubInteractiveApplicationComposition.js
    - services/tutorStubInteractiveCommandComposition.js
    - services/tutorStubInteractiveDialogueController.js
    - services/tutorStubInteractiveDirectorController.js
    - services/tutorStubInteractiveInputPresentation.js
    - services/tutorStubInteractiveLearnerRuntime.js
    - services/tutorStubInteractiveSessionController.js
    - services/tutorStubInteractiveTurnController.js
    - services/tutorStubInterimController.js
    - services/tutorStubLaunchRuntime.js
    - services/tutorStubLaunchApplicationContext.js
    - services/tutorStubLaunchPresentation.js
    - services/tutorStubLaunchSummaryPresentation.js
    - services/tutorStubLearnerAnalysisRuntime.js
    - services/tutorStubLearnerDagState.js
    - services/tutorStubLearnerEvidenceRuntime.js
    - services/tutorStubLiveSettingsController.js
    - services/tutorStubMixedLearnerController.js
    - services/tutorStubNonInteractiveApplication.js
    - services/tutorStubModelPickerController.js
    - services/tutorStubPerformanceControlController.js
    - services/tutorStubOpeningRuntime.js
    - services/tutorStubPromptTransport.js
    - services/tutorStubPublicHistory.js
    - services/tutorStubPublicPresentationRuntime.js
    - services/tutorStubRecoveryAccountingRuntime.js
    - services/tutorStubResponsePolicy.js
    - services/tutorStubScenarioController.js
    - services/tutorStubSessionOrchestration.js
    - services/tutorStubSessionApplicationContext.js
    - services/tutorStubSessionApplicationRuntime.js
    - services/tutorStubSessionStateRuntime.js
    - services/tutorStubTraceRuntime.js
    - services/tutorStubTerminalHost.js
    - services/tutorStubTutorPromptContext.js
    - services/tutorStubTurnOrchestration.js
    - services/tutorStubTypedActionPlanningRuntime.js
    - services/tutorStubVoiceController.js
    - services/tutorStubWorldPresentation.js
    - services/tutorStubTutorTurnPipeline.js
    - tests/tutorStubTutorTurnPipeline.test.js
    - tests/tutorStubEntrypointFacades.test.js
    - tests/tutorStubLearnerAnalysisRuntime.test.js
  prs:
    - 426
    - 427
    - 428
    - 429
    - 430
    - 431
    - 471
    - 474
    - 475
    - 476
    - 478
    - 479
    - 482
    - 484
    - 507
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-extracted-owner-boundaries
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
8. Learner analysis, public-evidence projection, and interim presentation.
9. Interactive mixed-learner control.
10. Interactive session commands and mode/reset/auto orchestration.
11. Final application composition and boundary reassessment.
12. Prompt transport, opening realization, and recovery/accounting boundary.
13. Public debug, field, report, and closeout presentation boundary.
14. Automated-learner and typed-action planning boundary.
15. Terminal host plus shared application-context consolidation.

The near-2,000-line acceptance criterion remains the architectural destination;
it is not a claim that cycle 7 alone can close the card. After cycle 7, continue
with the remaining cohesive ownership boundaries—learner analysis and interim
presentation, interactive mixed-learner control, interactive session commands,
and final application composition—while enforcing the same rolling-size and
no-replacement-monolith gates. Revise the size target only through an explicit
workplan decision backed by a boundary analysis, not because the series is
longer than first estimated.

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
- 2026-08-04 — Refreshed PR #431 onto the final current-main stack, including
  Paper v3.0.262. Current turn, feedback, timing, passthrough, DAG, dramatic
  release, manner-switch, and golden-delivery contracts pass 162/162; the fully
  composed five-PR head passes the zero-skip hermetic suite at 7,741/7,741 root
  plus 137/137 tutor-core tests. The extraction still removes 1,199 entrypoint
  lines (16,201 to 15,002), with zero static cycles across 464 files.
- 2026-08-04 — Restacked PR #431 onto the post-merge refresh of PR #430. Its
  non-workplan extraction patch remains byte-equivalent; a current broad turn
  recheck passes 138/138, all static gates remain green across 374 workplan
  items with zero cycles across 464 files, and the entrypoint reduction remains
  1,199 lines.
- 2026-08-04 — Started macro cycle 7 from current `origin/main` in the isolated
  `codex/refactor-tutor-stub-subsystem-facades` worktree. The near-2,000-line
  acceptance criterion is retained; cycle 7 is an intermediate entrypoint
  consolidation, not the end of the decomposition series.
- 2026-08-04 — Cycle 7 moved CLI argument parsing, launch/resume/remembered-
  settings precedence, and scenario/curriculum catalogue and keyboard selection
  behind three bounded facades (137, 423, and 293 source lines). The entrypoint
  fell from 15,002 to 14,121 lines, an 881-line net reduction; the rolling
  three-cycle average is 1,304 lines per PR and remains above the 750-line stop
  floor. Focused argument, launch, picker, world-catalogue, recipe, and
  remembered-settings verification passes 43/43, including byte-identical live
  catalogue output.
- 2026-08-04 — Cycle 7 verification passes the zero-skip hermetic suite at
  7,744/7,744 root tests plus 137/137 tutor-core tests. Lint, Prettier, manifest,
  workplan source (375 items), ref governance, syntax, and the static import
  graph all pass with zero cycles across 467 files. The unchanged informational
  surfaces retain exact help, world-list, learner-profile, and canonical
  curriculum-catalogue bytes; no model calls were authorized for this
  structural extraction.
- 2026-08-04 — Opened macro cycle 7 as PR #471.
- 2026-08-04 — Started macro cycle 8 from current `origin/main` in the isolated
  `codex/refactor-tutor-stub-learner-analysis-presentation` worktree. The slice
  assigns public learner-evidence and preflight projection, learner-analysis
  orchestration, and interim terminal lifecycle to separate bounded owners.
- 2026-08-04 — Macro cycle 8 moved combined/separate learner classification and
  learner-DAG orchestration, public evidence/preflight and human-discourse frame
  construction, and interim animation lifecycle behind three bounded owners
  (877, 266, and 247 source lines). `scripts/tutor-stub.js` fell from 14,121 to
  13,011 lines, a 1,110-line reduction; the rolling three-cycle average is 1,063
  lines per PR and remains above the 750-line stop floor.
- 2026-08-04 — Cycle 8 verification passes 131 focused runtime, exact-byte,
  human-discourse, interim, interactive, and ownership assertions plus the
  zero-skip hermetic suite at 7,748/7,748 root tests and 137/137 tutor-core
  tests. Lint, Prettier, manifest, workplan source (375 items), ref governance,
  syntax, and the static import graph pass with zero cycles across 470 files;
  no model calls were authorized for this structural extraction.
- 2026-08-04 — Opened macro cycle 8 as PR #474.
- 2026-08-04 — Started cycles 9–11 from current `origin/main` in the isolated
  `codex/refactor-tutor-stub-mixed-learner-control` worktree: mixed-learner
  control first, interactive session orchestration second, then final
  application composition and a measured reassessment of the near-2,000-line
  destination.
- 2026-08-04 — Macro cycle 9 moved speculative mixed-learner analysis and tutor
  prefetch, cache and attempt-state ownership, profile/suggestion/clue
  presentation, initial mixed setup, and `/use` acceptance behind two bounded
  owners (836 and 594 source lines). `scripts/tutor-stub.js` fell from 13,011 to
  11,810 lines, a 1,201-line net reduction.
- 2026-08-04 — Macro cycle 10 moved session closeout and curriculum/mode/coach
  commands, director and proof-DAG controls, `/auto` and `/demo` scheduling,
  clarification/translation/reset/opening orchestration, and the pending-auto
  queue behind four bounded controllers (457–556 source lines). The entrypoint
  fell from 11,810 to 10,427 lines, a 1,383-line net reduction.
- 2026-08-04 — Macro cycle 11 moved live settings, feedback and tuning,
  stochastic/light performance controls, tutor and learner character control,
  compound-turn processing, learner provenance, and mixed/slash input
  presentation behind six bounded controllers (228–632 source lines). The
  entrypoint fell from 10,427 to 8,315 lines, a 2,112-line net reduction; the
  cycles 9–11 rolling average is 1,565 lines and remains above the 750-line
  stop floor. All new owners remain below the 900-line anti-monolith ceiling.

Boundary reassessment after cycle 11:

- The entrypoint has fallen from 23,299 lines at macro-series start to 8,315
  lines (14,984 removed, 64.3%). Cycles 9–11 alone removed 4,696 lines (36.1%
  of their 13,011-line starting point).
- The remaining 6,315-line gap to 2,000 is concentrated rather than dispersed:
  about 3,565 lines of top-level prompt/model, debug/report, automated-learner,
  and typed-action functions, plus about 3,860 lines in `main()` that now mostly
  compose explicit controllers and host the terminal lifecycle.
- The near-2,000 target remains useful and achievable; it does not need to be
  weakened. Four further cohesive boundaries are visible: prompt transport and
  opening/recovery, public debug/report presentation, automated learner plus
  typed-action planning, and a final terminal-host/application-context pass.
  At the observed 1,565-line rolling rate this is approximately four macro
  cycles, with a fifth allowed if dependency consolidation needs a separate
  parity-preserving step.
- Cycles 9–11 verification passes 84/84 focused mixed-learner, settings,
  character, performance, terminal, turn, reset, auto/demo, and ownership
  assertions. A second 73/73 boundary and exact-byte regression set caught and
  repaired one moved relative import plus stale source-ownership expectations.
  The zero-skip hermetic suite passes 7,748/7,748 root tests and 137/137
  tutor-core tests. Repository-wide lint, Prettier, manifest, workplan source
  (397 items), ref governance, syntax, whitespace, and the static import graph
  all pass with zero cycles across 482 files. The mandatory pre-push strong
  benchmark subsequently completed all six jobs and returned the standing 0/6
  calibration warning; the nearest saved baseline re-audits identically with
  0 improved and 0 regressed, so the report-only hook allowed the push.
- 2026-08-04 — Opened macro cycles 9–11 as PR #475.
- 2026-08-04 — Started macro cycle 12 from current `origin/main` in the
  isolated `codex/refactor-tutor-stub-prompt-transport` worktree. This slice
  assigns prompt transport, opening realization, and recovery/accounting to
  bounded owners while preserving the existing tutor-turn pipeline boundary.
- 2026-08-04 — Macro cycle 12 moved provider and CLI prompt dispatch,
  streaming presentation, opening realization and director notes, response
  recovery and guard accounting, clarification and translation calls, and
  adjacent public prompt-context/state helpers behind five bounded owners
  (22–355 source lines). `scripts/tutor-stub.js` fell from 8,315 to 7,311
  lines, a 1,004-line net reduction; the cycles 10–12 rolling average is 1,500
  lines per PR and remains above the 750-line stop floor.
- 2026-08-04 — Cycle 12 verification passes 100/100 focused transport,
  prompt-audit, guard, opening/director, history/context, Program 2 budget,
  benchmark-hook, and ownership assertions plus the zero-skip hermetic suite
  at 7,748/7,748 root tests and 137/137 tutor-core tests. Lint, Prettier,
  manifest, workplan source (397 items), ref governance, syntax, and the static
  import graph pass with zero cycles across 487 files; no model calls were
  authorized for this structural extraction.
- 2026-08-04 — Opened macro cycle 12 as PR #476; merged at `d5a6dd04`.
- 2026-08-04 — Started macro cycle 13 from current `origin/main` in the
  isolated `codex/refactor-tutor-stub-debug-report-presentation` worktree. This
  slice assigns startup/help, public debug, field visualization, and closeout
  report effects to bounded presentation owners while retaining the existing
  pure projection services and explicit terminal/filesystem adapters.
- 2026-08-04 — Macro cycle 13 moved launch-summary rendering, help/features/
  release-notes and tutor-DAG presentation, response timing/details,
  explanatory and technical debug, field visualization writes, and closeout
  report assembly behind three bounded owners (122, 321, and 435 source
  lines). `scripts/tutor-stub.js` fell from 7,311 to 6,694 lines, a 617-line net
  reduction; the cycles 11–13 rolling average is 1,244 lines per PR and remains
  above the 750-line stop floor. All new owners remain below the 900-line
  anti-monolith ceiling.
- 2026-08-04 — Cycle 13 verification passes 82/82 focused help, launch,
  debug, report, field, exact-byte, live CLI, and ownership assertions plus the
  zero-skip hermetic suite at 7,757/7,757 root tests and 137/137 tutor-core
  tests. Lint, Prettier, manifest, workplan source (397 items), ref governance,
  syntax, whitespace, and the static import graph pass with zero cycles across
  492 files; no model calls were authorized for this structural extraction.
- 2026-08-04 — Restacked the uncommitted cycle 13 patch without conflict onto
  current `origin/main` at `74ab5721` after PR #477 landed. Repeated the focused,
  static, and full hermetic gates against that exact composition; the counts
  above are the post-restack results.
- 2026-08-04 — Opened macro cycle 13 as PR #478 at `a36d2ce5`; initial CI is
  running after the hermetic-contract, validation, and risk-coverage jobs
  passed. Started macro cycle 14 in the isolated stacked
  `codex/refactor-tutor-stub-automated-learner-typed-action` worktree from that
  exact commit. Until #478 merges, cycle 14 is explicitly based on and depends
  on its presentation-runtime extraction.
- 2026-08-04 — Macro cycle 14 moved automated-learner prompt construction,
  profile enforcement, stress/corruption controls, provider calls, and mixed
  learner artifacts into `tutorStubAutomatedLearnerGenerationRuntime.js`, and
  moved learner-belief, scaffold lifecycle, intervention closure, typed action
  selection, provenance, and trace assembly into
  `tutorStubTypedActionPlanningRuntime.js`. `scripts/tutor-stub.js` fell from
  6,694 to 5,740 lines, a 954-line net reduction; the cycles 12–14 rolling
  average is 858 lines per PR and remains above the 750-line stop floor. Both
  new owners remain below the 900-line anti-monolith ceiling.
- 2026-08-04 — Cycle 14 verification passes 100/100 focused profile,
  typed-action, orchestration, interaction-controller, facade, discourse, and
  QA assertions plus the complete zero-skip hermetic root and tutor-core
  phases (core: 137/137). Lint, Prettier, manifest, workplan source (397
  items), ref governance, syntax, whitespace, and the static import graph pass
  with zero cycles across 494 files; no model calls were authorized for this
  structural extraction.
- 2026-08-04 — PR #478 merged with every CI job green. Fast-forwarded the
  uncommitted cycle 14 worktree to post-merge `origin/main` at `c34870a3` and
  restored the extraction without conflict; the 100/100 focused suite and
  source/import/diff gates pass again on that exact composition.
- 2026-08-04 — Opened macro cycle 14 as PR #479; it merged at `0b092ac4`.
  Started macro cycle 15 from current `origin/main` at `38d3e391` in the
  isolated `codex/refactor-tutor-stub-terminal-host-context` worktree. This
  final planned boundary separates terminal lifecycle ownership from shared
  application composition while preserving the existing controller contracts.
- 2026-08-04 — Macro cycle 15 moved launch-option normalization, model/prompt
  and capability assembly, dry-run and provider preflight, trace construction,
  mutable application state, session restoration and launch reporting,
  non-interactive dispatch, and readline lifecycle ownership behind eight
  bounded application modules (228–815 source lines). `scripts/tutor-stub.js`
  fell from 5,740 to 3,568 lines, a 2,172-line net reduction; the cycles 13–15
  rolling average is 1,248 lines per PR and remains above the 750-line stop
  floor. Every new owner remains below the 900-line anti-monolith ceiling.
- 2026-08-04 — Cycle 15 verification passes 102/102 focused profile,
  typed-action, orchestration, terminal, discourse, QA, live CLI, and ownership
  assertions plus the zero-skip hermetic suite at 7,769/7,769 root tests and
  137/137 tutor-core tests. The full gate caught and closed both a stale
  DAG-snapshot caller inventory and a live theme/motion persistence closure.
  Lint, Prettier, manifest, workplan source (397 items), ref governance,
  syntax, whitespace, and the static import graph pass with zero cycles across
  503 files; no model calls were authorized for this structural extraction.
- 2026-08-05 — Opened macro cycle 15 as PR #482 at `dd1c62eb`; initial CI
  inspection follows the source-card link commit.
- 2026-08-05 — PR #482 merged at `47ec7513`. Started macro cycle 16 from the
  post-merge `origin/main` head `ed8cb948` in the isolated
  `codex/refactor-tutor-stub-interactive-application` worktree.
- 2026-08-05 — Macro cycle 16 moved terminal, voice, learner, model-picker,
  mixed-learner, session, settings, feedback, performance, character, command,
  and interactive-turn assembly behind two explicit composition owners (848
  and 762 source lines). `scripts/tutor-stub.js` fell from 3,568 to 2,657
  lines, a 911-line net reduction; the cycles 14–16 rolling average is 1,346
  lines per PR and remains above the 750-line stop floor. Both new owners stay
  below the 900-line anti-monolith ceiling.
- 2026-08-05 — Cycle 16 verification passes 213/213 focused interactive,
  session, command, character, settings, lab, discourse, and facade assertions,
  plus 50/50 presentation/ownership regressions after updating stale caller
  inventories to the composition owners. The complete zero-skip hermetic suite
  passes 7,775/7,775 root tests and 137/137 tutor-core tests. Lint, Prettier,
  manifest, workplan source (397 items), ref governance, syntax, whitespace,
  and the static import graph pass with zero cycles across 506 files; no model
  calls were authorized for this structural extraction.
- 2026-08-05 — PR #484 merged with every CI and shared surface-acceptance job
  green. On the resulting `origin/main`, the entrypoint is 2,657 lines; its
  functional body begins after roughly 612 lines of import declarations, so the
  executable composition body is approximately 2,045 lines and has reached the
  card's near-2,000 architectural destination. The merged cycle branch is no
  longer recorded as active.
- 2026-08-05 — The card remains active only for its no-replacement-monolith
  boundary: `tutorStubTutorTurnPipeline.js` is 2,581 lines and
  `tutorStubResponsePolicy.js` is 1,975. Their decomposition is now isolated in
  `refactor-tutor-stub-extracted-owner-boundaries`; do not resume by shaving
  imports or moving composition into another facade.
- 2026-08-05 — Closed after PR #507 completed the extracted-owner boundary.
  The tutor-turn facade is 661 lines; the response-policy facade is 26 lines;
  the replacement runtime owners range from 186 to 726 lines, below the
  1,200-line ceiling. Together with the approximately 2,045-line executable
  entrypoint body and the green #507 CI matrix, this satisfies the macro
  programme without further helper-sized entrypoint shaving.
