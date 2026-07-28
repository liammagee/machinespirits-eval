---
id: refactor-tutor-stub-streaming-capability
title: Refactor tutor-stub streaming capability
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: 4 focused speaker-transport assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve direct token streaming, CLI exclusion, Codex event streaming, and missing-provider behavior
branch: codex/refactor-tutor-stub-streaming-capability
claim_status: planned
depends_on:
  - refactor-tutor-stub-learner-public-evidence-state
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubDevelopmentSpeakerTransport.js
    - scripts/tutor-stub.js
    - tests/tutorStubDevelopmentSpeakerTransport.test.js
  prs:
    - 403
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-learner-public-evidence-state
tags:
  - refactoring
  - tutor-stub
  - streaming
  - providers
milestone: evaluation-infrastructure
---

Fifty-loop run 29: move provider streaming capability decisions into the
speaker-transport service.

Acceptance:

- Direct token streaming, CLI bridge exclusion, Codex event streaming, and
  missing-provider behavior remain exact.
- Provider resolution, network calls, token sinks, runtime state, and effects
  remain unchanged.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing provider resolution, transport protocols, or streamed output.

Log:

- 2026-07-28 — Moved provider streaming capability decisions into the
  speaker-transport service, reducing `scripts/tutor-stub.js` by four lines.
  Four focused assertions, complete zero-skip hermetic parity, and all
  static/source-only gates pass.
- 2026-07-28 — Opened PR #403 against `main`. The benchmark hook reported the
  standing calibration warning: baseline already failed and all six saved
  responses remain identical (zero improved, zero regressed, zero model calls).
