# Codebase Refactoring Reconciliation — Post Read-Routes

## Status

- Reconciliation date: 2026-08-09
- Base: `e5ea93df33` (PR #612 plus the serialized workplan refresh)
- Previous snapshot:
  `docs/next-steps/2026-08-09-codebase-refactoring-reconciliation.md`
- Scope: repository metrics, hotspot and complexity deltas, structural gates,
  workplan state, and the next bounded implementation decision
- Model/API spend: none
- Production data writes: none

## Executive decision

PR #612 completed the only accepted child from the preceding reconciliation.
All 120 children linked by `codebase-refactoring-program` are now done, while
the parent remains active because R4-R8 are still partial or uninstantiated.

The next bounded macro slice is
`refactor-evaluation-run-coordinator-runtime`. `runEvaluation()` remains a
572-line, complexity-93 coordinator inside the 2,261-line evaluation-runner
facade. It has stronger existing boundaries than the larger remaining
hotspots: request-local store ownership, extracted turn/multi-turn runtimes,
resume/rejudge owners, dry-run integration coverage, progress reporters,
hermetic persistence, and route admission are already characterized.

Move the coordinator behind an injected runtime and split its work into
planning, run setup, scenario-first execution, result/error accounting, and
finalization. Preserve the public facade and exact operational behavior. Do
not change generation, scoring, persistence schemas, concurrency, retry,
progress-event, monitoring, or result semantics.

The dramatic-derivation engine and role owner remain larger risks, but their
complexity-544 and complexity-502 functions still need dedicated transition
and role-contract characterization before movement. The rubric evaluator is
scoring-sensitive, and the remaining eval routes are mostly metered,
streaming, Codex-session, or state-changing surfaces. Those are not safer than
the characterized run coordinator.

## Fresh repository snapshot

`npm run metrics` on the reconciliation base reports:

| Measure | Current value |
|---|---:|
| Repository files in metric scope | 4,986 |
| Source files | 2,500 |
| Source code lines | 870,784 |
| Source comment lines | 49,894 |
| Source blank lines | 56,257 |
| Source total lines | 976,935 |
| JavaScript source files | 1,848 |
| JavaScript code lines | 590,317 |
| Repository commits | 4,180 |
| GitHub pull requests | 611 total / 589 merged / 1 open |

Current structural contracts:

- Workplan: 479 valid items — 455 done, nine dropped, six blocked, four
  archived, two active, two triaged, and one in review. The refactoring parent
  has 120 linked children, all done before this reconciliation adds the next
  child.
- Hermetic manifest: synchronized.
- Static imports: zero cycles across 557 files.
- `routes/evalRoutes.js`: 2,773 lines after PR #612; all 30 non-metered GET
  endpoints have bounded domain registrars and the exact 50-route order is
  ratcheted.
- Thin compatibility surfaces remain stable: `scripts/tutor-stub.js` is 137
  lines, `scripts/eval-cli.js` is 292 lines, and `services/evaluationStore.js`
  is 103 lines.

## Current hotspot ranking

| Surface | Lines | Maximum measured complexity | Decision |
|---|---:|---:|---|
| `services/dramaticDerivation/engine.js` | 2,885 | `runDrama`: 544 | Characterize transitions first. |
| `services/dramaticDerivation/llmRoles.js` | 5,532 | returned tutor role: 502 | Characterize role/provider contracts first. |
| `services/rubricEvaluator.js` | 3,290 | `buildDialogueFullTranscript`: 126 | Preserve until scoring-sensitive fixtures are expanded. |
| `scripts/run-tutor-stub-auto-eval.js` | 11,351 | `buildTurnTrainingExamples`: 114 | Later R6 generation/report split. |
| `services/evaluationRunner.js` | 2,261 | `runEvaluation`: 93 | Recommended next characterized macro. |
| `scripts/browse-poetics-scripts.js` | 13,292 | `renderDerivationRunHtml`: 66 | Later R6 presentation split. |
| `routes/evalRoutes.js` | 2,773 | remaining async handler: 55 | Freeze metered/mutating remainder for now. |

Complexity values come from ESLint v9 with a zero reporting threshold. They
rank structural risk; they do not establish behavioral defects.

## Acceptance boundary for the next slice

- Keep `runEvaluation(options)` and `createEvaluationRunner()` compatible for
  direct, CLI, and request-bound callers.
- Preserve validation, profile/scenario resolution, model overrides, run
  metadata, admission snapshots, scenario-first test order, worker-pool
  parallelism, delays, live reporting, transient-error resumability, permanent
  failure storage, progress events, monitoring, completion writes, and return
  projections.
- Add direct characterization around the injected coordinator instead of
  relying only on broad CLI/API integration tests.
- Reduce `services/evaluationRunner.js` below 1,800 lines, keep the new owner
  below 900 lines, and reduce the extracted owner's maximum complexity below
  40 without introducing a static cycle.
- Pass focused runner, dependency, CLI bridge, negotiation, API, admission,
  progress, lifecycle, and persistence tests plus complete hermetic,
  tutor-core, risk-coverage, source, formatting, lint, manifest, and cycle
  gates without provider calls or production-data writes.
