# Codebase Refactoring Reconciliation — Post Run Coordinator

## Status

- Reconciliation date: 2026-08-09
- Base: `2b26e4e825` (PRs #614-#617 plus the serialized workplan refresh)
- Previous snapshot:
  `docs/next-steps/2026-08-09-codebase-refactoring-post-read-routes-reconciliation.md`
- Scope: repository metrics, hotspot and complexity deltas, workplan state,
  characterization strength, and the next bounded implementation decision
- Model/API spend: none
- Production data writes: none

## Executive decision

PR #614 completed child 121 and reduced the evaluation-runner facade from
2,261 to 1,744 lines while moving its complexity-93 coordinator into a
complexity-17 owner. All 121 linked children are done on this base. The parent
remains active because the scoring residuals and R5-R8 are still partial or
uninstantiated. PRs #615-#617 subsequently added the independent Course 479
Tutor Lab instrument, Codex default-model configuration, and register/paper
stack; none alters this ranking.

The next bounded macro is `refactor-rubric-transcript-projection-runtime`.
`services/rubricEvaluator.js` remains 3,290 lines, and its 257-line
`buildDialogueFullTranscript()` is now the safest remaining high-complexity
function at 126. Unlike the larger dramatic-derivation and role owners, its
contract is already characterized by the 2,476-line dialogue-transcript suite:
public/full parity, historical trace schemas, missing-index inference, stored
artifacts, event round trips, exact tutor and learner deliberation labels, and
bilateral backbone consistency are executable.

Extract the complete judge-facing transcript domain behind the existing
`rubricEvaluator` exports. Move public, full, stored-artifact, event, learner
architecture, and context reconstruction together; decompose the high-
complexity dispatcher rather than relocating it unchanged. Preserve exact
consumer APIs and scoring prompts.

## Fresh repository snapshot

`npm run metrics` on the reconciliation base reports:

| Measure | Current value |
|---|---:|
| Repository files in metric scope | 5,023 |
| Source files | 2,522 |
| Source code lines | 876,551 |
| Source comment lines | 50,447 |
| Source blank lines | 56,726 |
| Source total lines | 983,724 |
| JavaScript source files | 1,869 |
| JavaScript code lines | 595,121 |
| Repository commits | 4,213 |

Current structural and workplan contracts:

- Workplan open state: seven active items, one triaged item, and two review items.
  `codebase-refactoring-program` is the only active maintenance programme.
- Hermetic manifest is synchronized on the base.
- Static imports report zero known cycles on the prior merged gate.
- Thin compatibility surfaces remain stable: `scripts/tutor-stub.js` is 137
  lines, `scripts/eval-cli.js` is 292 lines, `services/evaluationStore.js` is
  103 lines, and `services/evaluationRunner.js` is 1,763 lines.

## Current hotspot ranking

| Surface | Lines | Maximum measured complexity | Decision |
|---|---:|---:|---|
| `services/dramaticDerivation/engine.js` | 2,885 | `runDrama`: 544 | Characterize transitions first. |
| `services/dramaticDerivation/llmRoles.js` | 5,532 | returned tutor role: 502 | Characterize role/provider contracts first. |
| `services/rubricEvaluator.js` | 3,290 | `buildDialogueFullTranscript`: 126 | Recommended characterized macro. |
| `scripts/run-tutor-stub-auto-eval.js` | 11,351 | `buildTurnTrainingExamples`: 114 | Later R6 generation/report split. |
| `scripts/browse-poetics-scripts.js` | 13,292 | `renderDerivationRunHtml`: 66 | Later R6 presentation split. |
| `routes/evalRoutes.js` | 2,773 | remaining async handler: 55 | Freeze metered/mutating remainder. |
| `services/evaluationRunner.js` | 1,763 | no longer a top hotspot | Preserve after PR #614. |

Complexity values come from ESLint v9 with a zero reporting threshold. They
rank structural risk; they do not establish behavioral defects.

## Acceptance boundary for the next slice

- Preserve the named and default transcript exports from
  `services/rubricEvaluator.js` for every existing caller.
- Preserve public/full transcript text, stored-artifact precedence, event
  serialization, historical `user` labels, inferred turn indexes, tutor-final
  delivery, and unified plus ego-superego learner behavior.
- Keep tutor and learner ego/superego traces bilateral; do not change labels,
  suppression, order, truncation, or judge prompt contents.
- Make direct transcript tooling depend on the extracted owner rather than the
  full rubric implementation.
- Reduce `services/rubricEvaluator.js` below 2,800 lines, keep the extracted
  owner below 650 lines, and reduce its maximum complexity below 30 without a
  static import cycle.
- Ratchet direct compatibility, bilateral ordering, full transcript parity,
  risk coverage, hermetic manifest, source, formatting, lint, and cycle gates
  without provider calls or production-data writes.

## Outcome

The accepted macro is complete locally. `services/rubricEvaluator.js` is now
2,716 lines and retains its named and default transcript exports. The extracted
`services/dialogueTranscriptProjection.js` is 552 lines; its maximum function
complexity is 23 rather than 126. Shared `transcriptProjection.js` now imports
the transcript owner directly instead of depending on the full rubric service.

Verification passes:

- 166 focused transcript, projection, compatibility, and bilateral-order
  assertions;
- extracted-owner coverage of 95.47% lines, 84.58% branches, and 97.22%
  functions, with all six risk groups green;
- both hermetic root shards: 4,563/4,563 and 3,636/3,636, zero skips;
- 137/137 tutor-core recognition and memory tests;
- source-only workplan, formatting, lint, synchronized manifest, and zero
  cycles across 561 files.

The concurrent shard-2 runs reported one unrelated `tutorStubPassthrough`
failure. That file passed 7/7 alone after each occurrence, and complete
sequential shard reruns passed 3,632/3,632 before the rebase and 3,636/3,636
after it. No provider calls, production-data writes, or generated workplan-view
changes occurred.
