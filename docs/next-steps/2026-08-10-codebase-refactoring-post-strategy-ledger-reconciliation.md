# Codebase Refactoring Reconciliation — Post Strategy-Ledger Prompt

## Status

- Reconciliation date: 2026-08-10
- Base: `d5759f63` (PR #627, PR #628, and serialized workplan refresh)
- Previous snapshot:
  `docs/next-steps/2026-08-09-codebase-refactoring-post-run-coordinator-reconciliation.md`
- Scope: repository metrics, hotspot and complexity deltas, workplan state,
  characterization strength, and the next bounded R5 decision
- Model/API spend: none
- Production data writes: none

## Executive decision

PR #627 completed child 127 and moved the complexity-68 strategy-ledger prompt
projector into a 189-line owner whose maximum complexity is 16. All 127 linked
children are now done on this base. The parent remains active because R5 still
has a dominant tutor-role owner and R6-R8 remain partial or uninstantiated.

The next bounded macro is
`refactor-dramatic-derivation-tutor-prompt-construction`. `llmRoles.js` remains
5,085 lines and its returned tutor role remains complexity 502. Within it, the
prompt-only boundary is both material and already observable: the 462-line,
complexity-64 `tutorSystem()` plus the 99-line acts/non-acts user-prompt
projection. Existing dramatic tests capture tutor system and user prompts
across release, confrontation, repair, plot, throughline, corruption, proof
debt, cast, field, ownership, conduct, scene, register, and strategy-ledger
arms.

Extract both projections together. Accept already-derived turn sections as
inputs; do not move audits, model calls, retry/refusal behavior, release
arbitration, response parsing, conduct enforcement, or state mutation. This is
large enough to remove at least 450 lines from `llmRoles.js` while retaining a
pure, sub-700-line owner with byte-for-byte prompt parity.

## Fresh repository snapshot

`npm run metrics -- --no-github` on the reconciliation base reports:

| Measure | Current value |
|---|---:|
| Repository files in metric scope | 5,052 |
| Source files | 2,544 |
| Skipped source files | 1 |
| Source code lines | 882,206 |
| Source comment lines | 50,160 |
| Source blank lines | 57,132 |
| Source total lines | 989,498 |
| JavaScript source files | 1,891 |
| JavaScript code lines | 600,397 |
| Repository commits | 4,255 |

Current structural and workplan contracts:

- Before this source update, the workplan had five active items, three review
  items, and no triaged items. Closing merged child 127 leaves the refactoring
  parent as the only active maintenance item and child 128 as its sole triaged
  continuation.
- The hermetic manifest is synchronized.
- Static imports report zero cycles across 573 files.
- Thin compatibility surfaces remain stable: `scripts/tutor-stub.js` is 138
  lines, `scripts/eval-cli.js` is 292 lines, and
  `services/evaluationStore.js` is 103 lines.

## Current hotspot ranking

| Surface | Lines | Maximum measured complexity | Decision |
|---|---:|---:|---|
| `services/dramaticDerivation/llmRoles.js` | 5,085 | returned tutor role: 502 | Recommended prompt-construction macro. |
| `services/dramaticDerivation/engine.js` | 1,217 | view projector: 46; outer loop: 14 | Defer final view seam. |
| `scripts/run-tutor-stub-auto-eval.js` | 11,351 | `buildTurnTrainingExamples`: 114 | Later R6 generation/report split. |
| `scripts/browse-poetics-scripts.js` | 13,292 | `renderDerivationRunHtml`: 66 | Later R6 presentation split. |
| `tutor-core/services/tutorDialogueEngine.js` | 3,909 | `runDialogue`: 238 | Later in-housed engine boundary. |
| `services/rubricEvaluator.js` | 2,716 | `formatDialogueTranscript`: 46 | Preserve after transcript macro. |
| `routes/evalRoutes.js` | 2,773 | remaining async handler: 55 | Freeze metered/mutating remainder. |
| `services/evaluationRunner.js` | 1,763 | `resolveConfigModels`: 58 | Preserve after coordinator macro. |

Complexity values come from ESLint v9 with a zero reporting threshold. They
rank structural risk; they do not establish behavioral defects.

## Acceptance boundary for the next slice

- Preserve exact system and user prompt strings for acts and non-acts modes,
  including blank lines, order, redaction, feature gating, transcript tails,
  register blocks, and JSON response contracts.
- Project prompts only from immutable world/config and already-derived turn
  sections; keep lifecycle decisions and mutable runtime state outside the new
  owner.
- Preserve every `makeLlmTutor()` option, public export, model-call payload,
  mock metadata field, response shape, and trace.
- Reduce `llmRoles.js` by at least 450 lines, keep the new owner below 700
  lines, and keep its maximum function complexity below 30.
- Add direct prompt-owner branch coverage and ratchet existing dramatic,
  hermetic, tutor-core, workplan-source, formatting, lint, manifest, and
  zero-cycle gates without provider calls or production-data writes.

## Programme outlook

Completing child 128 should conclude the currently justified prompt-only R5
macro. Reconcile again after it merges. If `llmRoles.js` still dominates with a
well-characterized pure seam, continue there; otherwise move to R6 and split
the 11,351-line automated-evaluation script or 13,292-line browser presenter.
Do not extract the final engine view projector merely to empty the facade: the
engine is no longer a leading size or orchestration hotspot.

## Accepted-macro outcome

Child 128 is complete locally. The new
`services/dramaticDerivation/tutorPrompt.js` is a 617-line pure owner whose
maximum function complexity is 11. It owns the static tutor system prompt and
the final acts/non-acts user-prompt projection from already-derived sections.
`llmRoles.js` fell from 5,085 to 4,566 lines, while audits, provider calls,
retry/refusal behavior, response parsing, release arbitration, conduct
enforcement, state mutation, mock metadata, and learner prompts stayed in
their prior owner.

Verification passes:

- 6 direct prompt-owner assertions and 612 focused dramatic assertions;
- 100% line, 98.58% branch, and 100% function coverage for the new owner;
- clean hermetic root shards at 4,659/4,659 and 3,704/3,704, zero skips;
- 137/137 tutor-core tests and all twelve risk-coverage groups;
- source-only workplan, formatting, lint, synchronized manifest, diff, and
  zero cycles across 574 files.

The first monolithic root run reported concurrency-sensitive failures. Clean
shards isolated the remaining recurrence to `tutorStubPassthrough`; that file
passed 7/7 alone and the affected shard then passed 3,704/3,704. No provider
calls, production-data writes, or generated workplan-view changes occurred.
