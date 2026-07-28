---
id: refactor-tutor-stub-console-stream-replay
title: Refactor tutor-stub console stream replay
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: 8 focused speaker-transport assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve token boundaries, whitespace, nested interim selection, finish result, and empty-text behavior
branch: codex/refactor-tutor-stub-console-stream-replay
claim_status: planned
depends_on:
  - refactor-tutor-stub-console-token-sink
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
    - refactor-tutor-stub-console-token-sink
tags:
  - refactoring
  - tutor-stub
  - streaming
  - replay
milestone: evaluation-infrastructure
---

Fifty-loop run 32: move deterministic text-to-console-stream replay beside the
injected token sink.

Acceptance:

- Token boundaries, whitespace retention, nested interim selection, finish
  result, and empty-text behavior remain exact.
- Sink creation, terminal writes, animation control, runtime state, and effects
  remain injected from the CLI.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing provider transports, tokenization policy, animation, or terminal
  behavior.

Log:

- 2026-07-28 — Moved deterministic text-to-console-stream replay beside the
  injected token sink, reducing `scripts/tutor-stub.js` by two lines. Eight
  focused assertions, complete zero-skip hermetic parity, and all
  static/source-only gates pass.
