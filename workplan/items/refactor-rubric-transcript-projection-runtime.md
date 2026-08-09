---
id: refactor-rubric-transcript-projection-runtime
title: Extract the rubric dialogue transcript projection runtime
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-09
updated: 2026-08-09
branch: codex/refactor-post-run-coordinator-reconciliation
verification: >-
  166 focused transcript/projection assertions, direct facade and bilateral
  ordering checks, 95.47% line/84.58% branch/97.22% function owner coverage,
  all six risk groups, 8,199 hermetic root tests, 137 tutor-core tests, source,
  formatting, lint, synchronized manifest, and zero-cycle gates preserve the
  judge-facing contract without provider calls or production-data writes.
claim_status: planned
depends_on:
  - refactor-evaluation-run-coordinator-runtime
links:
  notes:
    - docs/next-steps/2026-08-09-codebase-refactoring-post-run-coordinator-reconciliation.md
    - docs/next-steps/2026-08-09-codebase-refactoring-post-read-routes-reconciliation.md
  code:
    - services/rubricEvaluator.js
    - services/dialogueTranscriptProjection.js
    - services/transcriptProjection.js
    - services/__tests__/dialogueTranscript.test.js
    - tests/dialogueTranscriptProjectionBoundary.test.js
    - config/coverage-risk-floors.json
  items:
    - codebase-refactoring-program
tags:
  - refactoring
  - evaluation
  - rubric
  - transcripts
  - symmetry
milestone: evaluation-infrastructure
---

Continue R4 from merged PR #614 and the post-run-coordinator reconciliation.
The 3,290-line rubric service still owns the complexity-126 full dialogue
transcript projection, but its public/full, stored-artifact, historical-schema,
and bilateral behavior now has unusually deep executable characterization.

Acceptance:

- Move the complete judge-facing transcript projection domain behind a bounded
  owner while keeping `rubricEvaluator` named and default exports compatible.
- Move public, full, stored-artifact, event, learner-architecture, and learner-
  context reconstruction together rather than leaving a split authority.
- Decompose the complexity-126 full builder into bounded turn inference,
  tutor, learner, protocol, fallback, and artifact helpers.
- Preserve exact public/full text, truncation, ordering, labels, historical
  `user` compatibility, turn inference, stored-artifact precedence, and prompt
  consumers.
- Keep tutor and learner ego/superego projections bilateral and directly test
  their ordering through the extracted owner.
- Reduce `rubricEvaluator.js` below 2,800 lines; keep the new owner below 650
  lines and its maximum function complexity below 30; introduce no static
  import cycle.
- Pass direct boundary, complete dialogue-transcript, transcript-projection,
  evaluator-risk, hermetic, source, formatting, lint, manifest, and cycle gates
  without provider calls or production-data writes.

Out of scope:

- Judge providers, scoring, rubric definitions, score parsing, score scales,
  prompts, persistence, schemas, CLI syntax, generation, or trace emission.
- Dramatic derivation, auto-eval, browser rendering, or route behavior.
- Generated workplan views.

Log:

- 2026-08-09 — Activated from post-PR-#614 main `c4e7f298`. Fresh metrics
  confirm 121 completed refactoring children and select the rubric transcript
  domain over the larger dramatic, browser, and auto-eval hotspots because its
  2,476-line characterization suite already ratchets the scoring-sensitive
  representation boundary.
- 2026-08-09 — Completed the extraction. `rubricEvaluator.js` fell from 3,290
  to 2,716 lines while keeping its named and default exports. The 552-line
  transcript owner separates public projection, turn inference, tutor,
  learner, protocol, fallback, stored-artifact, and event concerns; maximum
  complexity is 23 instead of 126. `transcriptProjection.js` now consumes that
  owner directly, removing its dependency on the full rubric implementation.
  Focused tests pass 141/141; owner coverage is 95.47% lines, 84.58% branches,
  and 97.22% functions; all six risk groups, 8,191 hermetic root tests, 137
  tutor-core tests, source, formatting, lint, manifest, and zero cycles across
  559 files pass. An initial concurrent shard run had one unrelated
  `tutorStubPassthrough` failure; that file passed 7/7 alone and the complete
  shard rerun passed 3,632/3,632 with zero skips.
- 2026-08-09 — Rebased cleanly over independent Course 479 PR #615 and its
  generated-view refresh at `0dffa15f`. Post-rebase focused coverage passes
  166/166, and the current hermetic roots pass 4,563/4,563 plus 3,636/3,636
  with zero skips. The same passthrough file failed only under concurrent shard
  pressure, passed 7/7 alone, and the sequential complete shard was green.
- 2026-08-09 — Rebased again over independent Codex default-model PR #616 and
  its generated-view refresh at `5c2eadee`. Its provider and tutor-stub changes
  do not overlap the transcript domain; post-rebase focused, source,
  formatting, lint, manifest, and cycle contracts remain the final gate.
- 2026-08-09 — Rebased cleanly over independent register/paper PR #617 and its
  generated-view refresh at `2b26e4e8`. The 166 focused transcript assertions
  and source, formatting, lint, manifest, and zero-cycle gates remain green.
