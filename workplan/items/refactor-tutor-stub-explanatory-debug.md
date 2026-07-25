---
id: refactor-tutor-stub-explanatory-debug
title: Refactor tutor-stub explanatory debug
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-25
updated: 2026-07-26
verification: One pure explanatory-debug service preserves frame, prompt,
  cleaning, and fallback contracts; focused, hermetic, static, and source-only
  gates pass without model calls.
branch: codex/refactor-tutor-stub-explanatory-debug
claim_status: planned
depends_on:
  - refactor-tutor-stub-learning-summary
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubExplanatoryDebug.js
    - scripts/tutor-stub.js
    - tests/tutorStubExplanatoryDebug.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-learning-summary
tags:
  - refactoring
  - tutor-stub
  - debug
  - projection
milestone: evaluation-infrastructure
---

Bounded R3 slice: move the explanatory-debug frame, prompt, output cleaner,
deterministic fallback, and policy-input projection out of the interactive CLI.

Out of scope:

- Changing `/debug` command handling, defaults, model selection, model calls,
  terminal output, concurrent-terminal behavior, or trace writes.
- Changing field calculations, register selection, learner analysis, or the
  distinction between policy inputs and post-response measurements.
- Extracting technical debug printing, broader `/analysis` rendering,
  `callTutor`, or `runOneTurn`.
- Running model-backed or paid evaluations.

Acceptance:

- One pure service owns the structured explanatory frame, policy-family
  precedence, causal prompt, prose cleaning, and deterministic fallback.
- The CLI imports those helpers behind the same call sites while retaining
  model orchestration, terminal rendering, and trace persistence locally.
- Frozen fixtures pin public exchange data, learner reading, policy inputs,
  post-response field deltas, response choice, prompt causality, sentence
  limits, fallback wording, immutability, and removal of local copies.
- Focused and full hermetic tests, manifest, lint, formatting, cycles,
  source-only workplan, and diff gates pass without model calls.

Log:

- 2026-07-25 — Activated from current `origin/main` at `f56fb4b4` after PR
  #237 merged with every CI lane green. Selected the data-only explanatory
  debug boundary because it composes existing register and field projections
  without touching command, model, terminal, or trace behavior.
- 2026-07-25 — Moved policy-family projection, structured frame construction,
  causal prompt text, prose cleaning, and deterministic fallback into one pure
  service. The merged curriculum work had raised the CLI baseline to 27,613
  lines; this slice reduces it to 27,478 while retaining every orchestration
  and rendering call site.
- 2026-07-25 — Review parity is green: direct contracts 6/6, focused
  interactive debug behavior 2/2, root shards 2,403/2,403 and 4,397/4,397 with
  zero skips, and tutor-core 137/137. Repository-wide lint and formatting,
  manifest, zero-cycle (362 files), 191-item source-only workplan, syntax, and
  diff checks pass with no model calls.
- 2026-07-26 — Closed after PR #238 merged to `main` at `0d962967`; activated
  the next pure R3 presentation seam on
  `codex/refactor-tutor-stub-response-details`.
