---
id: refactor-eval-cli-operational-commands
title: Extract eval-cli operational command modules
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-05
updated: 2026-08-05
branch: codex/refactor-eval-cli-operational-commands
verification: The eval-cli facade dispatches read, monitoring, lifecycle, resume, export, configuration-validation, and play commands through bounded modules while their arguments, stdout/stderr, exit codes, long-running cleanup, data selection, and side effects remain unchanged; focused, zero-skip hermetic, lint, format, manifest, workplan, coverage-risk, and zero-cycle gates pass.
claim_status: planned
depends_on:
  - refactor-evaluation-resume-rejudge-runtime
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - scripts/eval-cli.js
    - scripts/eval-cli/commands/index.js
    - scripts/eval-cli/runProgressPresentation.js
    - scripts/eval-cli/runsPresentation.js
    - scripts/eval-cli/tracePresentation.js
    - tests/eval-cli-smoke.test.js
    - tests/evalCliOperationalCommands.test.js
    - tests/dryRun.test.js
  items:
    - codebase-refactoring-program
    - refactor-evaluation-resume-rejudge-runtime
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/514
tags:
  - refactoring
  - evaluation
  - cli
  - command-dispatch
  - maintainability
milestone: evaluation-infrastructure
---

Execute the first bounded part of R4 step 4. Establish an explicit command
registry and move operational commands out of the 6,300-line `eval-cli.js`
entrypoint before the generation and scoring families are decomposed.

Acceptance:

- Give `list`, `runs`, `report`, `status`, `watch`, `transcript`, `cleanup`,
  `delete-runs`, `resume`, `revert`, `export`, `validate-config`, and `play`
  explicit command owners and keep every new module below 500 lines.
- Preserve exact argument aliases, filtering, stdout/stderr, exit codes,
  progress polling, signal cleanup, DB interactions, resume ANOVA reporting,
  export formats, validation failure summaries, and dynamic play loading.
- Keep `scripts/eval-cli.js` as the executable compatibility facade and do not
  change quick/run/chat/rejudge/evaluate command behavior in this slice.
- Add registry/size/source ratchets plus process-level output and exit parity;
  production databases and logs must remain untouched by tests.
- Use existing mock/frozen fixtures only. This structural slice authorizes no
  paid model calls and no empirical claim changes.

Log:

- 2026-08-05 — Activated from `origin/main` at `23816179` after PR #513 merged
  R4 step 3. Baseline: `scripts/eval-cli.js` is 6,300 lines and its main switch
  owns 21 command labels. The first operational slice covers thirteen command
  owners spanning about 1,300 lines; generation and scoring commands remain for
  follow-up slices behind the same registry seam.
- 2026-08-05 — Reached review with thirteen explicit command modules plus
  three presentation owners. `eval-cli.js` fell from 6,300 to 4,526 lines
  (1,774 lines, 28.2% removed); the largest new owner is the 303-line config
  validator and every new production module stays below the 500-line ceiling.
  The facade retains the executable/help/error boundary, host-relative dynamic
  imports, generation commands, chat, rejudge, and all scoring families.
- 2026-08-05 — Exact process parity passed across twenty-two safe old/new
  command cases, covering normal reads, filters, missing arguments, missing
  runs, guarded deletion, play validation, and full config validation. The
  focused hermetic set passed 156 tests; the zero-skip hermetic root suite
  passed 7,852 tests and the in-housed core suite passed 137. Risk coverage,
  lint, format, manifest, workplan source/tests, diff, and zero-cycle gates are
  green. No model calls or production DB/log writes were made.
- 2026-08-06 — Rebased without conflict onto `origin/main` at `3d5c0ded`,
  reran the focused and static gates, and opened the reviewed slice as PR #514.
  The implementation commit is `72747dec` before this PR-link follow-up.
