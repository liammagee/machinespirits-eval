---
id: refactor-tutor-stub-console-token-sink
title: Refactor tutor-stub console token sink
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: 7 focused speaker-transport assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve direct writes, one-time setup, newline handling, empty finish, concurrent buffering, and atomic terminal print behavior
branch: codex/refactor-tutor-stub-console-token-sink
claim_status: planned
depends_on:
  - refactor-tutor-stub-stream-label
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
    - refactor-tutor-stub-stream-label
tags:
  - refactoring
  - tutor-stub
  - streaming
  - terminal
milestone: evaluation-infrastructure
---

Fifty-loop run 31: move console token-sink state transitions behind injected
terminal effects in the speaker-transport service.

Acceptance:

- Direct writes, one-time setup, newline handling, empty finish, concurrent
  buffering, and atomic terminal print behavior remain exact.
- Terminal writes, animation control, runtime state, and effects remain owned
  by the CLI through injected adapters.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing provider transports, tokenization, animation, or terminal behavior.

Log:

- 2026-07-28 — Moved console token-sink state transitions behind injected
  terminal effects, reducing `scripts/tutor-stub.js` by 18 lines. Seven focused
  assertions, complete zero-skip hermetic parity, and all static/source-only
  gates pass.
