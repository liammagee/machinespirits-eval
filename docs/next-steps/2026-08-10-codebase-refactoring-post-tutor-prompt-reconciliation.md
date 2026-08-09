# Codebase Refactoring Reconciliation — Post Tutor-Prompt Construction

## Status

- Reconciliation date: 2026-08-10
- Base: `db5b5958` (merged PR #629 plus serialized workplan refresh)
- Previous snapshot:
  `docs/next-steps/2026-08-10-codebase-refactoring-post-strategy-ledger-reconciliation.md`
- Scope: repository metrics, hotspot and complexity deltas, workplan state,
  characterization strength, and the R5-to-R6 decision
- Model/API spend: none
- Production data writes: none

## Executive decision

PR #629 completed child 128. The new 617-line tutor-prompt owner has maximum
complexity 11 and reduced `services/dramaticDerivation/llmRoles.js` from 5,085
to 4,566 lines. All 128 linked refactoring children are now done on this base.

Pause R5. The returned tutor runtime in `llmRoles.js` still measures complexity
493, but its remaining branches are not another prompt-only projection. They
interleave scene/plot/throughline state, release and lemma enforcement, conduct
and proof-debt guards, draft and superego provider calls, response parsing,
revision, and state commits. The complete 612-test dramatic suite covers this
file at 91.11% lines, 79.90% branches, and 87.77% functions. A later split needs
an explicit tutor-runtime state contract; moving the closure wholesale would
only relocate the hotspot.

Advance to R6 with
`refactor-tutor-stub-auto-eval-report-assets`. The 11,351-line auto-eval
executable contains two already-pure presentation owners:
`machineSpiritsReportCss()` spans 2,151 lines and
`tutorStubIndexClientJs()` spans 944. Extracting those 3,095 lines behind one
dependency-free asset module materially shrinks the executable while freezing
the emitted CSS and JavaScript bytes. Existing temporary-root reporting tests
already inspect both assets and syntax-check the client.

## Fresh repository snapshot

`npm run metrics -- --no-github` on the reconciliation base reports:

| Measure | Current value |
|---|---:|
| Repository files in metric scope | 5,056 |
| Source files | 2,546 |
| Skipped source files | 1 |
| Source code lines | 882,661 |
| Source comment lines | 50,131 |
| Source blank lines | 57,173 |
| Source total lines | 989,965 |
| JavaScript source files | 1,893 |
| JavaScript code lines | 600,793 |
| Repository commits | 4,258 |

Current structural and workplan contracts:

- Before this source update, the workplan had five active items, three review
  items, and no triaged items. Closing merged child 128 leaves two review items
  and adds child 129 as the sole triaged refactoring continuation.
- The hermetic manifest is synchronized.
- Static imports report zero cycles across 574 files.
- Thin compatibility surfaces remain stable: `scripts/tutor-stub.js` is 138
  lines, `scripts/eval-cli.js` is 292 lines, and
  `services/evaluationStore.js` is 103 lines.

## Current hotspot ranking

| Surface | Lines | Maximum measured complexity | Decision |
|---|---:|---:|---|
| `services/dramaticDerivation/llmRoles.js` | 4,566 | returned tutor role: 493 | Pause: strong coverage, but the residue is stateful and needs a future explicit state contract. |
| `scripts/run-tutor-stub-auto-eval.js` | 11,351 | `buildTurnTrainingExamples`: 114 | Recommended R6 static report-asset extraction. |
| `scripts/browse-poetics-scripts.js` | 13,292 | `renderDerivationRunHtml`: 66 | Later R6 domain-router/presentation split. |
| `services/tutorStubFirstDraftOuterLoop.js` | 4,609 | validator: 341 | Preserve the closed V-series contract until a separately characterized data migration. |
| `tutor-core/services/tutorDialogueEngine.js` | 3,909 | `runDialogue`: 238 | Later in-housed engine boundary. |
| `services/learnerTutorInteractionEngine.js` | 3,196 | `runTutorTurn`: 148 | Later bilateral interaction boundary; symmetry review required. |
| `routes/evalRoutes.js` | 2,773 | remaining async handler: 55 | Freeze the metered/mutating remainder after read-side extraction. |
| `services/evaluationRunner.js` | 1,763 | `resolveConfigModels`: 58 | Preserve after coordinator extraction. |
| `services/dramaticDerivation/engine.js` | 1,217 | view projector: 46; outer loop: 14 | Continue to defer the final view seam. |

Complexity values come from ESLint v9 with a zero reporting threshold. They
rank structural risk; they do not establish behavioral defects.

## Acceptance boundary for child 129

- Move only the shared report CSS and index-client JavaScript string owners;
  keep report/index data models and every filesystem write in place.
- Preserve emitted asset bytes, paths, syntax, browser load order, accessibility
  behavior, URL/session-state semantics, and the `--index` and `--report-from`
  CLI contracts.
- Keep generation, resume, evidence sealing, summary persistence, placeholder
  shells, and model/provider paths untouched.
- Reduce the auto-eval executable by at least 3,000 lines and add no dependency
  or import cycle to the asset owner.
- Extend direct byte/hash characterization and run the focused reporting,
  complete hermetic root/core, risk-coverage, lint, formatting, manifest,
  source-workplan, and zero-cycle gates without model calls or production-data
  writes.

## Programme outlook

After child 129 merges, refresh hotspot evidence again. The likely second R6
slice is the auto-eval report/index projection boundary—especially the animated
visualization and report-shell owners—before the more entangled generation,
resume, and evidence-transaction paths. The poetics browser remains the next
large R6 application once auto-eval presentation has a stable module boundary.

Do not resume `llmRoles.js` by merely moving its 493-complexity tutor closure to
a new file. Resume R5 only when a child can name and characterize an explicit
tutor-runtime state transition that actually reduces the decision knot.
