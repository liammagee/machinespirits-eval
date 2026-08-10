# Codebase Refactoring Reconciliation — Post Auto-Eval Assets

## Status

- Reconciliation date: 2026-08-10
- Base: `5e2238a5` (merged PR #631 plus serialized workplan refresh)
- Previous snapshot:
  `docs/next-steps/2026-08-10-codebase-refactoring-post-tutor-prompt-reconciliation.md`
- Scope: R6 closeout, repository metrics, hotspot and complexity deltas,
  characterization strength, workplan state, and the child-130 decision
- Model/API spend: none
- Production data or report writes: none

## Executive decision

Close child 129. PR #631 moved the shared 84,221-byte report CSS and
82,509-byte index client into a dependency-free, fully covered owner while
preserving their SHA-256 hashes. The auto-eval executable fell from 11,351 to
8,257 lines, and the generated-view refresh completed the workplan handoff.

Continue R6 with
`refactor-tutor-stub-auto-eval-visualization-renderer`. The original programme
plan names the embedded visualization renderer as the third large presentation
boundary after CSS and the index client. `renderAnimatedVizSection()` remains
approximately 1,004 lines but has complexity 2: it is a large, already-pure
HTML/inline-runtime owner with a strong saved-report parity surface.

Do not select the complexity-114 `buildTurnTrainingExamples()` merely because
it is now the auto-eval complexity leader. It defines persisted transition and
reward-proxy data, is consumed by ingestion/reporting, and lacks a direct frozen
data-shape contract. Characterize that projection independently before a later
move; do not fold it into a presentation-only extraction.

## Fresh repository snapshot

`npm run metrics -- --no-github` on the post-merge base reports:

| Measure | Current value |
|---|---:|
| Repository files in metric scope | 5,060 |
| Source files | 2,548 |
| Skipped source files | 1 |
| Source code lines | 882,752 |
| Source comment lines | 50,131 |
| Source blank lines | 57,181 |
| Source total lines | 990,064 |
| JavaScript source files | 1,895 |
| JavaScript code lines | 600,826 |
| Repository commits | 4,264 |

Current structural and workplan contracts:

- Before this source update, the workplan had five active items, three review
  items, and no triaged items. Closing merged child 129 leaves two review items
  and adds child 130 as the sole triaged refactoring continuation.
- The hermetic manifest is synchronized at 664 root files and 11 in-housed
  tutor-core files, with four governed skips and one fixture exclusion.
- Static imports report zero cycles across 575 files.
- Thin compatibility surfaces remain stable: `scripts/tutor-stub.js` is 138
  lines, `scripts/eval-cli.js` is 292 lines, and
  `services/evaluationStore.js` is 103 lines.

## Current hotspot ranking

| Surface | Lines | Maximum measured complexity | Decision |
|---|---:|---:|---|
| `services/dramaticDerivation/llmRoles.js` | 4,566 | returned tutor role: 493 | Keep R5 paused until an explicit mutable tutor-runtime transition is characterized. |
| `services/tutorStubFirstDraftOuterLoop.js` | 4,609 | validator: 341 | Preserve the closed V-series contract until a separately characterized data migration. |
| `services/learnerTutorInteractionEngine.js` | 3,196 | `runTutorTurn`: 148 | Later bilateral interaction boundary; symmetry review is mandatory. |
| `scripts/run-tutor-stub-auto-eval.js` | 8,257 | `buildTurnTrainingExamples`: 114 | Continue R6 with the pure 1,004-line visualization renderer; characterize the persisted training projection separately. |
| `scripts/browse-poetics-scripts.js` | 13,292 | `renderDerivationRunHtml`: 66 | Next large R6 application after the auto-eval visualization boundary. |
| `routes/evalRoutes.js` | 2,773 | remaining async handler: 55 | Freeze the metered/mutating remainder after read-side extraction. |
| `services/evaluationRunner.js` | 1,763 | `resolveConfigModels`: 58 | Preserve after coordinator extraction. |
| `services/dramaticDerivation/engine.js` | 1,217 | view projector: 46; outer loop: 14 | Continue to defer the final view seam. |

Complexity values come from ESLint v9 with a zero reporting threshold. They
rank structural risk; they do not establish behavioral defects. The R6 choice
also considers phase fit, purity, characterization, and amount of code removed.

## Acceptance boundary for child 130

- Move the animated visualization guide, payload/row identity projection,
  HTML fragment, and inline replay runtime behind one presentation owner.
- Preserve empty and populated output bytes, serialized JSON, DOM/data
  contracts, browser load order, control semantics, accessibility, text and
  keyboard fallback, resize behavior, turn jumps, and policy comparison.
- Leave frame/transcript/training construction, trace and report data models,
  report/index shells, all filesystem paths and writes, CLI behavior,
  generation, resume, evidence transactions, and summary persistence in place.
- Reduce the auto-eval executable by at least 1,000 lines; keep the new owner
  below 1,250 lines and complexity below 10 with no import cycle.
- Add direct byte/hash and inline-runtime syntax tests, then run focused saved
  reporting, complete hermetic root/core, risk coverage, lint, formatting,
  manifest, source-workplan, diff, and zero-cycle gates.

## Programme outlook

After child 130 merges, refresh R6 evidence again. The next decision should be
between a separately characterized trace/training projection and the poetics
browser's domain-router/presentation split. Keep `llmRoles.js` paused until a
child can name a state transition rather than merely relocate its
complexity-493 closure.

## Accepted-macro outcome

Child 130 is complete locally. The animated replay guide, payload projection,
HTML fragment, shared report-markup helpers, and inline browser runtime now
live in `services/tutorStubAutoEvalVisualizationReport.js`. The new owner is
1,130 lines with maximum complexity 5, while
`scripts/run-tutor-stub-auto-eval.js` fell from 8,257 to 7,136 lines. Trace and
training projection, report/index shells, filesystem writes, CLI routing,
generation, resume, evidence transactions, and summary persistence remain in
the executable.

Pre/post fragment output is byte-identical:

- empty state: 83 bytes,
  `742b174eb670dba7393b4bb4d66992145e3ed7da0285f1407230cae00ae9baf0`;
- two-policy, three-frame state: 51,443 bytes,
  `ca2e986a42d00727464e0c8f7ec9f87a1419475b556afbf028be62970936da37`.

Verification passes:

- 4/4 direct renderer assertions and 100/100 focused reporting assertions;
- 100% line, branch, and function coverage for the new owner;
- clean isolated root shards at 4,666/4,666 and 3,704/3,704, zero skips;
- 137/137 tutor-core tests and all fourteen risk-coverage groups;
- source-only workplan, formatting, lint, synchronized manifest, diff, and
  zero cycles across 576 files.

The first sandboxed root-shard run reproduced expected loopback/PTY permission
failures; both shards passed with the required isolated localhost permissions.
No model calls, production artifact writes, or generated workplan-view changes
occurred.
