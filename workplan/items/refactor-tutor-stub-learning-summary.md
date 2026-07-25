---
id: refactor-tutor-stub-learning-summary
title: Refactor tutor-stub learning summary
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-25
updated: 2026-07-25
verification: A pure learning-summary projection preserves the CLI and HTML
  contracts on frozen public-state fixtures; focused, hermetic, static, and
  source-only gates pass without model calls.
branch: codex/refactor-tutor-stub-learning-summary
claim_status: planned
depends_on:
  - refactor-sse-lifecycle
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubLearningSummary.js
    - services/tutorStubLearningSummaryHtml.js
    - scripts/tutor-stub.js
    - tests/tutorStubLearningSummary.test.js
    - tests/tutorStubLearningSummaryHtml.test.js
  items:
    - codebase-refactoring-program
    - refactor-sse-lifecycle
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/237
tags:
  - refactoring
  - tutor-stub
  - learning-summary
  - projection
milestone: evaluation-infrastructure
---

Bounded R3 slice: move the tutor-stub's public learning-summary projection out
of the 27k-line interactive CLI and place it next to the existing HTML renderer.

Out of scope:

- Changing the learning-summary schema, prose, HTML, destination, launch, or
  trace-event behavior.
- Extracting closeout printing, command handlers, `callTutor`, or `runOneTurn`.
- Changing learner records, comprehension, clue pacing, training reuse, or
  authorship provenance.
- Running model-backed or paid evaluations.

Acceptance:

- One pure service owns the completion reason, dialogue case status, public
  evidence/reasoning projection, journey deltas, and next-step selection.
- The CLI calls the service at the same closeout and automatic HTML boundaries,
  preserving the existing relative trace path and renderer schema export.
- Frozen fixtures pin natural and interrupted stops, evidence de-duplication,
  movement, authorship, clarification priority, grounded-speech fallback, and
  HTML compatibility.
- Focused tests, full hermetic parity, manifest, lint, formatting, cycles,
  source-only workplan, and diff gates pass without model calls.

Log:

- 2026-07-25 — Activated after PR #235 merged the initial 18-row queue. A fresh
  hotspot scan still found `scripts/tutor-stub.js` at 27,555 lines; selected its
  data-only learning-summary projection as the first low-risk R3 seam, leaving
  terminal, browser, command, model, and turn-loop behavior untouched.
- 2026-07-25 — Moved the 212-line projection and status block into a pure
  service, retained the HTML module's schema re-export, and passed the existing
  relative trace path explicitly at both CLI call sites. The CLI hotspot is now
  27,345 lines without changing the renderer or session lifecycle.
- 2026-07-25 — Review parity is green: focused summary/HTML tests 5/5, root
  shards 2,385/2,385 and 4,422/4,422 with zero skips, and tutor-core 137/137.
  Repository-wide lint and formatting, manifest, zero-cycle (360 files),
  190-item source-only workplan, syntax, and diff checks all pass with no model
  calls.
- 2026-07-25 — Merged through PR #237 as `f56fb4b4`; every Node 20/22,
  PTY/loopback, coverage, lint, validation, manifest, and workplan CI lane
  completed successfully.
