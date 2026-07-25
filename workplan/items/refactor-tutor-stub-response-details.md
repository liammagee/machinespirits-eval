---
id: refactor-tutor-stub-response-details
title: Refactor tutor-stub response details
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-26
updated: 2026-07-26
verification: One pure response-details service preserves human-readable
  diagnostic, setting, repair, and model-response metadata text; focused,
  hermetic, static, and source-only gates pass without model calls.
branch: codex/refactor-tutor-stub-response-details
claim_status: planned
depends_on:
  - refactor-tutor-stub-explanatory-debug
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubResponseDetails.js
    - scripts/tutor-stub.js
    - tests/tutorStubResponseDetails.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-explanatory-debug
tags:
  - refactoring
  - tutor-stub
  - presentation
  - response-details
milestone: evaluation-infrastructure
---

Bounded R3 slice: move the tutor-stub's compact response metadata, response
repair explanation, and shared human-readable diagnostic/setting labels out of
the interactive CLI.

Out of scope:

- Changing response-detail defaults, terminal printing, timing, commands,
  trace writes, model calls, or response generation.
- Changing register, character, action, performance, release-pacing, guard, or
  token/cost metadata shapes.
- Moving broader `/analysis`, technical debug, interim-status, field
  visualization, closeout, `callTutor`, or `runOneTurn` behavior.
- Running model-backed or paid evaluations.

Acceptance:

- One pure service owns diagnostic label normalization, plain-list grammar,
  setting and response-check labels, repair summaries, and compact response
  metadata text.
- The CLI imports those helpers behind the same call sites while retaining
  printing, turn timing, orchestration, state changes, and trace persistence.
- Frozen fixtures pin authored label mappings, fallback labels, deduplication,
  repair/fallback wording, token and cost formatting, field ordering, nested
  response-configuration fallbacks, guard/stream precedence, and immutability.
- Focused and full hermetic tests, manifest, lint, formatting, cycles,
  source-only workplan, syntax, and diff gates pass without model calls.

Log:

- 2026-07-26 — Activated from current `origin/main` at `8a58ce23` after PR
  #238 merged with every CI lane green. The refreshed hotspot remains
  `scripts/tutor-stub.js` at 27,478 lines; selected this pure presentation seam
  because it is reused across settings, analysis, response checks, and compact
  response details without owning any terminal or application behavior.
- 2026-07-26 — Rebased onto current `origin/main` at `afcbed37` after PR #239
  landed. Moved seven pure response-detail/presentation helpers into a 113-line
  leaf service; the CLI falls from 27,478 to 27,372 lines with all printing,
  timing, state, command, model, and trace call sites retained.
- 2026-07-26 — Review parity is green: direct contracts 6/6, response-detail,
  guard, pacing, and metadata behavior 28/28, focused interactive details 2/2,
  root shards 2,464/2,464 and 4,340/4,340 with zero skips, and tutor-core
  137/137. Repository-wide lint and formatting, manifest, zero-cycle (363
  files), 192-item source-only workplan, syntax, and diff checks pass with no
  model calls.
- 2026-07-26 — PR #240 merged as `c4b3e7e5` after every CI lane passed; the
  serialized main-only renderer then refreshed the generated board views in
  `e7c86cb3`. Closed this child before activating the next presentation slice.
