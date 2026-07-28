---
id: refactor-tutor-stub-stream-label
title: Refactor tutor-stub stream label
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: 5 focused speaker-transport assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve tutor, learner-analysis, learner-DAG, classifier, fallback, and color copy
branch: codex/refactor-tutor-stub-stream-label
claim_status: planned
depends_on:
  - refactor-tutor-stub-streaming-capability
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubDevelopmentSpeakerTransport.js
    - scripts/tutor-stub.js
    - tests/tutorStubDevelopmentSpeakerTransport.test.js
  prs: []
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-streaming-capability
tags:
  - refactoring
  - tutor-stub
  - streaming
  - presentation
milestone: evaluation-infrastructure
---

Fifty-loop run 30: move stream-label rendering beside streaming transport
capabilities while injecting the CLI color palette.

Acceptance:

- Tutor, learner-analysis, learner-DAG, classifier, fallback, and color copy
  remain exact.
- Token sinks, terminal writes, runtime state, and effects remain in the CLI.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing provider transports, token delivery, or terminal behavior.

Log:

- 2026-07-28 — Moved stream-label rendering beside streaming transport
  capabilities, reducing `scripts/tutor-stub.js` by three lines. Five focused
  assertions, complete zero-skip hermetic parity, and all static/source-only
  gates pass.
