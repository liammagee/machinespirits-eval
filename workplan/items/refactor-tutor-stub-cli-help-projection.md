---
id: refactor-tutor-stub-cli-help-projection
title: Refactor tutor-stub CLI help projection
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-26
updated: 2026-07-26
verification: The pre/post-refactor --help processes exit zero with
  byte-identical output; a frozen synthetic-default hash pins the full
  projection and every supplied runtime value, while focused, hermetic,
  manifest, static, and source-only gates pass without model calls.
branch: codex/refactor-tutor-stub-cli-help-projection
claim_status: planned
depends_on:
  - refactor-tutor-stub-interim-frame-projection
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubCliHelp.js
    - scripts/tutor-stub.js
    - tests/tutorStubCliHelp.test.js
    - tests/tutorStubLabsRecipeCli.test.js
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-interim-frame-projection
tags:
  - refactoring
  - tutor-stub
  - presentation
  - cli
  - help
milestone: evaluation-infrastructure
---

Bounded R3 slice: move the tutor-stub's pure launch-time help string projection
out of the CLI while retaining terminal output and every runtime responsibility
in the entrypoint.

Out of scope:

- Changing help copy, ordering, spacing, defaults, option names, examples,
  interactive command documentation, or environment documentation.
- Moving argument parsing, option validation, command handlers, runtime
  defaults, terminal writes, colors, interactive help, or command completion.
- Changing tutor generation, deterministic audits, model calls, traces,
  session state, or any public tutoring behavior.

Acceptance:

- One dependency-free pure renderer receives the current runtime defaults and
  catalog values and returns the established launch help string.
- `printHelp` remains the CLI-owned terminal wrapper, passing explicit values
  into the pure renderer before its existing `console.log` call.
- A frozen synthetic-default fixture pins the complete help bytes, all dynamic
  substitutions, trailing newline, and input immutability.
- The actual pre/post-refactor `--help` processes exit zero with byte-identical
  output, and informational launch paths remain keyless and model-free.
- Focused and full hermetic tests plus manifest, lint, formatting, cycle,
  source-only workplan, syntax, and diff gates pass without model calls.

Log:

- 2026-07-26 — Activated from rendered `origin/main` at `16deb64b` after PR
  #254 merged with every CI lane green. Chose the single-expression 469-line
  launch help template because it is a pure terminal-presentation boundary and
  does not cross into command handlers or turn orchestration.
- 2026-07-26 — Moved the byte-identical help projection into one dependency-free
  leaf, reduced the CLI from 27,137 to 26,687 lines, and registered a direct
  frozen-hash test. The old/new `--help` processes both exit zero with identical
  28,938-byte output; the direct plus informational-launch set passes 10/10.
- 2026-07-26 — Rebased cleanly onto rendered `origin/main` at `e7d3ba0f` after
  the independent tutor resume-handoff, Program-2 stall-audit, and world-030
  work merged. The resume change overlaps the CLI and the new tests overlap the
  hermetic manifest, but neither touches the extracted help projection; the
  final-base informational-launch set passes 30/30.
- 2026-07-26 — Review parity is green on the final base: the complete hermetic
  root suite passes 6,821/6,821 with zero skips and tutor-core passes 137/137
  with zero skips. ESLint, Prettier, the zero-cycle ratchet across 375 files,
  synchronized test manifest, 202-item source-only workplan, syntax, and diff
  gates pass without model calls.
- 2026-07-26 — Fast-forwarded to `origin/main` at `8f7bca6e` before handoff;
  intervening PRs #257–#261 change documentation, dedicated fallback,
  benchmark/Program-2 surfaces, and the hermetic runner/test layout. The only
  direct overlaps, independent test-manifest entries, merged cleanly. Parity is
  green:
  focused 30/30, hermetic root 6,940/6,940, and tutor-core 137/137, all with zero
  skips; lint, formatting, zero-cycle, manifest, source, syntax, and diff gates
  also pass.
- 2026-07-26 — PR #262 merged as `cb1ab520` with every CI lane green; the
  serialized workplan render followed as `85ccfb7a`. Closed this child and
  activated `refactor-tutor-stub-interactive-help-projection` for the remaining
  pure in-session `/help` presentation seam.
