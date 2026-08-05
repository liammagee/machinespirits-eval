---
id: refactor-eval-cli-generation-commands
title: Extract eval-cli generation, chat, and rejudge commands
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-06
updated: 2026-08-06
branch: codex/refactor-eval-cli-generation-commands
verification: The eval-cli facade dispatches quick/test, run, chat, and rejudge through bounded command owners while generation selection, model guards, adaptive budgets, live reporting, chat tools, rubric overrides, judge provenance, arguments, stdout/stderr, and exit codes remain unchanged; focused, zero-skip hermetic, lint, format, manifest, workplan, coverage-risk, and zero-cycle gates pass.
claim_status: planned
depends_on:
  - refactor-eval-cli-operational-commands
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - scripts/eval-cli.js
    - scripts/eval-cli/commands/generationIndex.js
    - scripts/eval-cli/commands/quickCommand.js
    - scripts/eval-cli/commands/runCommand.js
    - scripts/eval-cli/commands/chatCommand.js
    - scripts/eval-cli/commands/chatTools.js
    - scripts/eval-cli/commands/rejudgeCommand.js
    - tests/eval-cli-smoke.test.js
    - tests/dryRun.test.js
    - tests/evalCliGenerationCommands.test.js
  items:
    - codebase-refactoring-program
    - refactor-eval-cli-operational-commands
tags:
  - refactoring
  - evaluation
  - cli
  - generation
  - rejudge
  - maintainability
milestone: evaluation-infrastructure
---

Execute the second bounded part of R4 step 4. Use the registry seam from PR
#514 to move generation, conversational tooling, and rejudge orchestration out
of the executable facade without entering the larger scoring-command family.

Acceptance:

- Give `quick`/`test`, `run`, `chat`, and `rejudge` explicit command owners;
  split chat tool execution from chat transport and keep every new production
  module below 500 lines.
- Move the canonical-factorial guard and constants with `run`, and move chat
  tool schemas/execution plus interactive model transport out of the facade.
- Preserve exact profile/scenario selection, tutor model-mix guard, adaptive
  cost ceilings, external ego extension loading, live/token/cost reporting,
  factorial post-analysis, chat lifecycle, rubric override cleanup, rejudge
  provenance, output text, and error exits.
- Keep `evaluate`, `backfill-first-turn`, `evaluate-learner`, and
  `evaluate-dialogue` byte-equivalent in the facade for the next slice.
- Add registry/size/source ratchets and process-level argument/output parity.
  Tests use mock/frozen fixtures only and never touch production DBs or logs.
  This structural slice authorizes no paid model calls or empirical changes.

Log:

- 2026-08-06 — Activated as a stacked follow-up from PR #514 at `e86599f1`.
  Baseline: `eval-cli.js` is 4,526 lines after the operational slice. The
  quick/run cases span about 425 lines, rejudge about 122, and the chat schema,
  tool executor, transport, and loop about 480. Scoring commands remain
  deliberately out of scope.
- 2026-08-06 — Reached review with explicit quick/test, run, chat, and
  rejudge owners plus a separate chat-tool boundary. `eval-cli.js` fell from
  4,526 to 3,456 lines (1,070 lines, 23.6% removed); across both R4 step 4
  slices it is down 2,844 lines (45.1%) from the 6,300-line baseline. The
  largest new owner is `runCommand.js` at 452 lines and every new production
  module stays below the 500-line ceiling.
- 2026-08-06 — Exact process parity passed all nine safe old/new quick, run,
  chat, and rejudge cases. The focused hermetic set passed 171 tests; the
  complete zero-skip hermetic root and 137-test in-housed core suites passed.
  Risk coverage, lint, format, manifest, workplan source, diff, and zero-cycle
  gates are green. A one-scenario dry run exercised generation without API
  keys; no paid model calls or production DB/log writes were made.
- 2026-08-06 — After PR #514 merged, rebased the staged follow-up onto current
  `origin/main` at `e3cbe611`; the focused 171-test hermetic suite and static
  gates remained green without conflict.
