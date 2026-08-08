# Codebase Refactoring Reconciliation — 2026-08-09

## Status

- Reconciliation date: 2026-08-09
- Base: `3ed950d963` (post-PR-#595 generated workplan refresh)
- Original audit: `docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md`
- Scope: repository metrics, original hotspot deltas, programme exit criteria,
  and live workplan state
- Model/API spend: none
- Production data writes: none

This is the current planning snapshot for the refactoring programme. The July
24 review remains the historical source for its original evidence and design;
this note decides what that plan means after the merged implementation series.

## Executive decision

The programme has delivered its safety foundation and three large structural
outcomes:

1. required root and tutor-core suites are explicit, hermetic, and cannot
   silently disappear;
2. static import cycles are at zero and the early duplicate/registry work is
   complete; and
3. the tutor-stub, evaluation CLI, and evaluation-store facades are radically
   smaller, with all internal evaluation-store migration targets eliminated.

It is not honest to close the parent yet. The tutor-stub adapter is 2,699 lines
against an explicit target of at most 2,000, and its approximately 705-line
`main()` still exceeds the 300-line application-function ceiling. The original
R4–R8 programme also contains substantial uninstantiated work. Those later
phases should not be represented as completed merely because every currently
linked child has landed.

The immediate next slice is therefore one bounded macro extraction:
`refactor-tutor-stub-adapter-tail`. It closes the remaining measurable R3 gap.
After that merges, refresh the hotspot evidence again before choosing among the
evaluation runner, dramatic derivation, route/rubric, or presentation surfaces.
File size alone is not authority to start any of those higher-risk migrations.

## Fresh repository snapshot

`npm run metrics` on the reconciliation base reports:

| Measure | Current value |
|---|---:|
| Repository files in metric scope | 4,953 |
| Source files | 2,476 |
| Source code lines | 868,019 |
| Source comment lines | 49,927 |
| Source blank lines | 56,102 |
| Source total lines | 974,048 |
| JavaScript source files | 1,826 |
| JavaScript code lines | 588,133 |
| Repository commits | 4,129 |
| GitHub pull requests | 595 total / 573 merged / 1 open |

The repository-wide totals are a new baseline, not a direct delta from the July
24 table: the maintained metrics command excludes generated, data, dependency,
and vendor directories, while the original audit used several narrower custom
scopes. Named-file deltas below are directly comparable because both sides use
physical line counts from Git.

Current structural contracts:

- `npm run test:manifest`: synchronized; 638 required root files and 11
  required tutor-core files, with zero allowed skips;
- `npm run lint:cycles`: zero static cycles across 554 files; and
- `npm run eval-store:boundary-check`: 19 tracked consumers resolve to zero
  migration targets, one retained package-compatibility boundary, four
  archived one-offs, and 14 tests. The retained facade is 103 lines.

## Comparable hotspot deltas

| Surface | 2026-07-24 | 2026-08-09 | Reconciliation |
|---|---:|---:|---|
| `scripts/tutor-stub.js` | 25,813 | 2,699 | 23,114 lines removed; R3 is near-complete, not complete. |
| `scripts/eval-cli.js` | 6,642 | 292 | Command-family extraction achieved; keep as a bounded adapter. |
| `services/evaluationStore.js` | 3,410 | 103 | Explicit repositories/lifecycle achieved; retained public package facade is intentional. |
| `services/evaluationRunner.js` | 6,832 | 2,261 | Major execution extraction landed; residual orchestration remains. |
| `routes/evalRoutes.js` | 3,870 | 3,802 | Store injection landed, but router decomposition did not. |
| `services/rubricEvaluator.js` | 3,404 | 3,290 | Parser characterization landed; evaluator-family separation remains. |
| `services/dramaticDerivation/engine.js` | 2,885 | 2,885 | Original R5 transition extraction remains unstarted. |
| `services/dramaticDerivation/llmRoles.js` | 5,528 | 5,532 | Original R5 role/provider split remains unstarted. |
| `scripts/browse-poetics-scripts.js` | 13,237 | 13,292 | Original R6 router/presentation split remains unstarted. |
| `scripts/run-tutor-stub-auto-eval.js` | 11,447 | 11,349 | Original R6 generation/report split remains unstarted. |

The largest current complexities reinforce the same prioritization. Tutor-stub
has fallen from a complexity-529, 10,225-line `main()` to complexity 32 and
approximately 705 lines, but it still fails the programme's function-size exit
criterion. The untouched dramatic-derivation functions remain much riskier:
`runDrama` is complexity 544 and the returned tutor role reaches complexity
502. `evaluationRunner.runEvaluation` is complexity 93. These are ranking
signals, not permission to move behavior without characterization.

## Workplan reconciliation

Before this update, the parent linked 118 child items: 117 were `done` and the
only `review` item was the already merged package-boundary PR #593. This update:

- marks `refactor-evaluation-store-package-compatibility-boundary` done and
  links PR #593;
- adds this current snapshot to the parent;
- adds one triaged child, `refactor-tutor-stub-adapter-tail`; and
- leaves `codebase-refactoring-program` active.

The resulting parent has 119 linked children: 118 done and one triaged. That is
the accurate distinction between the delivered execution history and remaining
accepted work.

| Phase | Current disposition | Evidence boundary |
|---|---|---|
| R0 safety nets | Complete | Required-run manifest, zero allowed skips, hermetic fixtures, lifecycle and risk gates landed. |
| R1 cycles/duplication/registries | Complete | Cycles are zero; linked consolidation and registry cards are done. |
| R2 correctness boundaries | Complete as scoped | All six pre-existing integrity/decision cards named by the plan are done. |
| R3 tutor-stub separation | Near-complete | Entry point fell 89.5%, but misses both explicit size ceilings. |
| R4 evaluation separation | Partial | CLI/store ownership completed; runner, route, and rubric residuals remain. |
| R5 dramatic derivation | Not instantiated | Original hotspots and complexities are materially unchanged. |
| R6 presentation separation | Not instantiated | Browser and auto-eval applications remain large integrated surfaces. |
| R7 surface governance | Partial | Package/store boundary is explicit; broader live/historical candidate governance remains. |
| R8 configuration sprawl | Not instantiated | No current child slice or refreshed inventory. |

## Next bounded slice

`refactor-tutor-stub-adapter-tail` should move the remaining policy/context
bindings and interactive host assembly behind explicit application seams while
preserving CLI argument parsing, terminal wiring, and process bootstrap in the
entry point. Its non-negotiable gates are:

- `scripts/tutor-stub.js` at or below 2,000 lines;
- no application function in the entry point above 300 lines;
- unchanged command/help/completion, fake-provider trace, learner/tutor
  symmetry, browser/Electron, reset/finalize, and disposal contracts; and
- no new import cycle, ambient database ownership, provider call, production
  data write, or empirical-output change.

After that child lands, the parent should be reconciled again. Do not
automatically start R4–R8 in file-size order. Choose a vertical seam whose
characterization already exists and whose maintenance cost is visible; if none
has a concrete consumer or failure burden, formally defer it rather than
manufacturing refactoring work.
