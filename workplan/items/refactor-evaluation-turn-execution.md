---
id: refactor-evaluation-turn-execution
title: Split evaluation single-turn and multi-turn execution owners
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-05
updated: 2026-08-05
branch: codex/refactor-evaluation-turn-execution
verification: The existing evaluationRunner facade delegates shared generation plus single-turn and multi-turn execution to bounded tested owners; fixture rows, dialogue traces, checkpoints, score shapes, CLI output contracts, and attempt indexes remain unchanged; focused, zero-skip hermetic, lint, format, manifest, workplan, coverage-risk, and zero-cycle gates pass with no production owner above 1,200 lines.
claim_status: planned
depends_on:
  - refactor-eval-profile-registry
  - refactor-adaptive-trace-projection
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/evaluationRunner.js
    - services/evaluationTurnContext.js
    - services/evaluationTurnExecutionRuntime.js
    - services/evaluationMultiTurnExecutionRuntime.js
    - services/evaluationMultiTurnSetupRuntime.js
    - services/evaluationBetweenTurnAdaptationRuntime.js
    - services/evaluationMultiTurnTranscriptRuntime.js
    - services/evaluationMultiTurnCompletionRuntime.js
    - services/evaluationCheckpointStore.js
    - tests/evaluationRunner.test.js
    - tests/evaluationTurnExecutionBoundaries.test.js
    - services/__tests__/dialogueTranscript.test.js
    - tests/checkpointE2E.test.js
    - tests/checkpointResume.test.js
  items:
    - codebase-refactoring-program
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/512
tags:
  - refactoring
  - evaluation
  - runner
  - multi-turn
  - maintainability
milestone: evaluation-infrastructure
---

Execute R4 step 2 from the canonical refactoring plan. Preserve
`services/evaluationRunner.js` as the compatibility surface while moving the
shared generation path, single-turn execution, and multi-turn coordination into
explicit owners rather than relocating the 6,440-line module wholesale.

Acceptance:

- Remove 1,500–2,500 lines from `services/evaluationRunner.js` in the first
  macro slice, or stop and record why its dependency boundary needs a smaller
  prerequisite.
- Keep every new production owner at or below 1,200 lines; prefer 800 lines or
  fewer and split transcript, context, between-turn, or persistence concerns
  before they become a replacement monolith.
- Preserve the existing named/default exports and import-time provider-hook
  contract while callers migrate.
- Preserve tutor/learner trace symmetry, message-chain behavior, checkpoint
  semantics, Program-2/id-director dispatch, retry/accounting order, provenance
  hashes, and stored result shapes.
- Use mock/frozen fixtures only; this structural refactor authorizes no paid
  model calls and no empirical claim changes.

Log:

- 2026-08-05 — Activated from current `origin/main` at `aaeb1dbf` after PR
  #507 completed the tutor-stub macro programme. The canonical profile registry
  and adaptive trace projection prerequisites are done. The initial baseline is
  6,440 lines in `services/evaluationRunner.js`; active experimental worktrees
  do not currently modify the R4 runner, CLI, store, rubric, or route hotspots.
- 2026-08-05 — Reached review with the compatibility facade reduced from 6,440
  to 3,534 lines (2,906 lines, 45.1% removed). The cohesive boundary exceeded
  the initial 1,500-2,500-line estimate because context, checkpoints,
  transcript effects, setup, between-turn adaptation, completion, and both
  execution loops separated cleanly in the same dependency-injection seam.
  The largest new production owner is 885 lines; an architectural test ratchets
  every extracted owner at 1,200 lines and prevents the turn loops returning to
  the facade.
- 2026-08-05 — Validation is green without model calls: 237 focused runner,
  transcript, message-chain, negotiation, checkpoint, and boundary tests; the
  zero-skip hermetic root suite (7,838 tests) plus in-housed core suite (137
  tests); risk-coverage floors; lint; format; static-cycle zero gate; manifest;
  workplan source/tests; and diff checks. The first sandboxed coverage attempt
  could not bind loopback ports; the authorized loopback rerun passed all five
  coverage groups.
- 2026-08-05 — PR #512 merged to `main` as `5fe625cf`; the generated workplan
  refresh followed at `dd377147`. The merged source and CI evidence satisfy the
  card, which is now closed before R4 step 3 begins.
