# Codebase Refactoring — Final R6 Reconciliation

## Status

- Reconciliation date: 2026-08-10
- Base: `50cfbfee` (merged PR #633 plus serialized workplan refresh)
- Previous snapshot:
  `docs/next-steps/2026-08-10-codebase-refactoring-post-auto-eval-assets-reconciliation.md`
- Scope: final R6 outcome, repository and hotspot refresh, characterization
  strength, workplan state, and the next bounded browser-presentation decision
- Model/API spend: none
- Production data or report writes: none

## Executive decision

Close child 130. PR #633 moved the animated replay guide, payload projection,
HTML fragment, shared report-markup helpers, and inline browser runtime into a
1,130-line, complexity-5 owner while preserving exact empty and populated
fragment hashes. Every CI job passed, and the main-only generated-view refresh
completed the handoff.

The tutor-stub auto-eval presentation arm of R6 is complete. Across children
129 and 130, the 3,094-line CSS/index-client asset owner and 1,130-line
visualization owner reduce `scripts/run-tutor-stub-auto-eval.js` from 11,351 to
7,136 lines. Its remaining complexity leader, `buildTurnTrainingExamples()` at
114, defines persisted transition and reward-proxy data. Do not recast that
data contract as presentation work or move it without separate frozen
serialized examples and ingestion parity.

Continue R6 with the narrower poetics-browser derivation presentation child,
`refactor-poetics-browser-derivation-presentation`. The 13,292-line browser
executable still owns 52 application routes, 29 admin routes, thirteen mounts,
twenty top-level HTML renderers, and mutable plus metered application behavior.
Its complexity-66 `renderDerivationRunHtml()` belongs to an approximately
1,950-line derivation view family. Freeze those page bytes and route responses,
then extract that family before considering broader domain-router movement.

Keep `services/dramaticDerivation/llmRoles.js` paused. Its remaining
complexity-493 tutor runtime interleaves mutable planning, release enforcement,
model calls, revision, and state commits; R6 presentation work does not justify
moving that closure.

## Fresh repository snapshot

`npm run metrics -- --no-github` on the post-merge base reports:

| Measure | Current value |
|---|---:|
| Repository files in metric scope | 5,064 |
| Source files | 2,550 |
| Skipped source files | 1 |
| Source code lines | 882,956 |
| Source comment lines | 50,131 |
| Source blank lines | 57,195 |
| Source total lines | 990,282 |
| JavaScript source files | 1,897 |
| JavaScript code lines | 600,970 |
| Repository commits | 4,270 |

Before this source update, the refactoring parent linked 130 children: 129 were
done and child 130 was in review. Closing child 130 and adding child 131 leaves
130 done children and one triaged continuation. No other card tagged
`refactoring` is open outside the parent and that new child.

The hermetic manifest is synchronized at 665 root files and 11 in-housed
tutor-core files, with four governed skips and one fixture exclusion. Static
imports report zero cycles across 576 files.

## Programme delta from the 2026-07-24 baseline

| Surface | Baseline lines | Current lines | Net reduction | Current maximum complexity |
|---|---:|---:|---:|---:|
| `scripts/tutor-stub.js` | 25,813 | 138 | 25,675 | bounded facade |
| `scripts/eval-cli.js` | 6,642 | 292 | 6,350 | bounded facade |
| `services/evaluationStore.js` | 3,410 | 103 | 3,307 | compatibility facade |
| `services/evaluationRunner.js` | 6,832 | 1,763 | 5,069 | 58 |
| `services/dramaticDerivation/engine.js` | 2,885 | 1,217 | 1,668 | 46 |
| `services/dramaticDerivation/llmRoles.js` | 5,528 | 4,566 | 962 | 493 |
| `routes/evalRoutes.js` | 3,870 | 2,773 | 1,097 | 55 |
| `services/rubricEvaluator.js` | 3,404 | 2,716 | 688 | 46 |
| `scripts/run-tutor-stub-auto-eval.js` | 11,447 | 7,136 | 4,311 | 114 |
| `scripts/browse-poetics-scripts.js` | 13,237 | 13,292 | grew by 55 | 66 |

The original R3 tutor-stub exit target was at most 2,000 lines with no
application function above 300. The current 138-line entrypoint decisively
meets that adapter target; the auto-eval executable is a separate application.

## Current hotspot decision table

| Surface | Lines | Maximum measured complexity | Decision |
|---|---:|---:|---|
| `services/dramaticDerivation/llmRoles.js` | 4,566 | tutor runtime: 493 | Keep paused until mutable state transitions are explicitly characterized. |
| `services/tutorStubFirstDraftOuterLoop.js` | 4,609 | validator: 341 | Preserve the closed versioned contract pending a data migration. |
| `services/learnerTutorInteractionEngine.js` | 3,196 | `runTutorTurn`: 148 | Later bilateral boundary; require tutor-learner symmetry review. |
| `scripts/run-tutor-stub-auto-eval.js` | 7,136 | `buildTurnTrainingExamples`: 114 | Auto-eval R6 presentation complete; characterize persisted data separately. |
| `scripts/browse-poetics-scripts.js` | 13,292 | `renderDerivationRunHtml`: 66 | Select the derivation presentation family as child 131. |
| `services/evaluationRunner.js` | 1,763 | `resolveConfigModels`: 58 | Preserve after coordinator extraction. |
| `routes/evalRoutes.js` | 2,773 | remaining async handler: 55 | Preserve the metered/mutating remainder after read-side extraction. |
| `services/dramaticDerivation/engine.js` | 1,217 | view projector: 46 | Defer; no longer a leading size or orchestration hotspot. |

Complexity values come from ESLint v9 with a zero reporting threshold. They
rank structural risk but do not establish behavioral defects.

## Acceptance boundary for child 131

- Characterize empty and populated derivation index, live-index, live-run, and
  completed-run HTML before moving code.
- Move only the derivation presentation family behind a dependency-light owner;
  preserve HTML bytes, inline scripts, DOM/ARIA contracts, TTS hooks, proof and
  learner DAGs, controlled vocabulary, links, and comparison behavior.
- Preserve Express route fingerprints, response status/content type/body,
  redirects, auth and role gates, mount prefixes, and live refresh semantics.
- Leave filesystem discovery, SSE timers, application startup and shutdown,
  database ownership, compose/job/workplan mutation, and model-call paths in
  their current owners.
- Reduce `scripts/browse-poetics-scripts.js` by at least 1,750 lines, keep the
  new owner below 2,300 lines and complexity below 40, and add no import cycle.
- Add direct risk coverage and run focused browser/desktop/auth, complete
  hermetic root/core, manifest, lint, formatting, workplan-source, diff, and
  cycle gates without model calls or production writes.

## Programme outlook

Child 131 is the sole justified R6 continuation. After it merges, run one
closeout audit: if route/application ownership is clear and no new directly
characterized pure boundary dominates, mark the refactoring parent done and
capture the training projection, bilateral interaction engine, and mutable
`llmRoles.js` runtime as a separately prioritized future phase. Do not keep the
current programme open merely to chase file size or complexity in
behavior-bearing state machines.
