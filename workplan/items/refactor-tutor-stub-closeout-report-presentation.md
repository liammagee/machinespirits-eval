---
id: refactor-tutor-stub-closeout-report-presentation
title: Refactor tutor-stub closeout report presentation
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: Closeout terminal output remains byte-identical while dense,
  sparse, no-turn, seeded live-process, focused, hermetic, manifest, static,
  and source-only gates pass.
branch: codex/refactor-tutor-stub-closeout-report-presentation
claim_status: planned
depends_on:
  - refactor-tutor-stub-closeout-projection
  - refactor-tutor-stub-technical-debug-presentation
links:
  prs:
    - 320
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubCloseoutReportPresentation.js
    - services/tutorStubCloseoutProjection.js
    - scripts/tutor-stub.js
    - tests/tutorStubCloseoutReportPresentation.test.js
    - tests/tutorStubCloseoutProjection.test.js
    - tests/tutorStubGuardAccounting.test.js
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-closeout-projection
    - refactor-tutor-stub-technical-debug-presentation
tags:
  - refactoring
  - tutor-stub
  - closeout
  - presentation
  - terminal
milestone: evaluation-infrastructure
---

Bounded R3 slice: move only the deterministic closeout terminal-line
projection out of `printDialogueCloseout` while retaining report payload
assembly, state snapshots, trace paths and emission, terminal writes, command
dispatch, and mutable runtime behavior in the CLI.

Out of scope:

- Changing closeout wording, ordering, omissions, colors, rounding,
  truncation, report schema, payload values, trace shape, or lifecycle reason.
- Moving field, learning-summary, comprehension, release-pacing,
  response-visibility, guard-accounting, or final-turn payload assembly.
- Changing terminal effects, report commands, learning-summary HTML,
  transcript persistence, model calls, prompts, settings, or runtime state.
- Consolidating the deliberately distinct auto-eval closeout renderer.

Acceptance:

- One dependency-free presentation service projects no-turn and completed
  closeout terminal lines from explicit prepared inputs and returns frozen
  arrays.
- The CLI retains all report/state preparation, trace resolution, terminal
  writes, the payload schema, and the existing null/payload return contract.
- Dense, sparse, optional-section, trace, rounding, truncation, color,
  immutability, ownership, and exact live terminal-byte branches have direct
  fixtures.
- A seeded fake-provider completed turn has the same normalized output bytes
  and hash on pre-extraction PR #319 and this branch without external model or
  API calls.
- Focused/full hermetic, manifest, lint, formatting, cycle, source-only
  workplan, syntax, ref-status, and diff gates pass.

Log:

- 2026-07-28 — Activated from rendered `origin/main` at `e3d66045` after PR
  #319 merged as `a4925f7a` with all ten CI lanes green. The 25,265-line CLI
  retains every closeout payload and effect boundary; only the deterministic
  line renderer is selected.
- 2026-07-28 — The seeded keyless fake-provider fixture is byte-identical to
  pre-extraction PR #319 after normalizing generation latency and turn ID:
  1,208 bytes and SHA-256
  `e3ca5f7f59498d709331946f65417197bbd9ba22f54b8ae6d7c77b185013c92c`.
- 2026-07-28 — The slice adds a 154-line dependency-free projector and a
  217-line direct test while reducing the CLI from 25,265 to 25,186 lines (79
  net). Dense/sparse/no-turn and adjacent closeout, guard, learning, release,
  response-configuration, and reuse coverage is green at 45/45; tutor-core is
  green at 137/137. Manifest, 245-item source workplan, refs, lint, formatting,
  syntax, diff, and the zero-cycle ratchet across 412 files are green.
- 2026-07-28 — The loaded local monolithic root runner reports all 532 files
  but again trips existing fixed-wall-clock subprocess deadlines (7,195 pass,
  27 fail/cancelled of 7,334 assertions). This presentation slice's live and
  focused tests pass; as with merged PR #319, PR CI remains the final
  cross-version full-root certification rather than recording the loaded-host
  run as green.
- 2026-07-28 — Opened PR #320 with the explicit workplan link and source-only
  board discipline; CI is the final review gate.
