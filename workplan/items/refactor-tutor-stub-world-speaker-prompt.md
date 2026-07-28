---
id: refactor-tutor-stub-world-speaker-prompt
title: Refactor tutor-stub world speaker prompt
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: Speaking-tutor evidence-contract lines remain exact across
  direct, live, focused, hermetic, manifest, static, and source-only gates.
branch: codex/refactor-tutor-stub-world-speaker-prompt
claim_status: planned
depends_on:
  - refactor-tutor-stub-world-public-prompt
links:
  prs:
    - 347
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubWorldPromptContext.js
    - scripts/tutor-stub.js
    - tests/tutorStubWorldPromptContext.test.js
    - tests/tutorStubPromptBehavior.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-world-public-prompt
tags:
  - refactoring
  - tutor-stub
  - world
  - prompt
  - dag
milestone: evaluation-infrastructure
---

Dependent R3 slice: move deterministic speaking-tutor evidence-contract
projection beside the public world projector, with the authorial ledger label
injected. Retain world loading, DAG admission, vocabulary resolution, prompt
assembly, model calls, state, and effects in their existing owners.

Acceptance:

- Evidence-contract headings, rule glosses, speaking conduct, and authored
  ledger vocabulary remain exact.
- Rule numbering/trimming and null-world behavior remain unchanged.
- World and injected ledger inputs remain unchanged.
- The CLI strictly shrinks while loading, DAG admission, vocabulary, prompts,
  state, model calls, and effects stay in their current owners.
- Focused/full hermetic, manifest, lint, formatting, cycle, source-only
  workplan, syntax, ref-status, and diff gates pass.

Out of scope:

- Changing evidence rules, speaker conduct, prompt wording, world vocabulary,
  release scheduling, runtime state, model behavior, or terminal behavior.

Log:

- 2026-07-28 — Activated from PR #346's reviewed head at `7e9ee091`; the
  24,902-line CLI still owned deterministic speaking-tutor evidence-contract
  projection.
- 2026-07-28 — Added 26 production and 40 direct-test lines to the world prompt
  owner while reducing the CLI to 24,883 lines. All 55 focused public-prompt,
  evidence-contract, live behavior, world-presentation, and human-discourse
  assertions pass.
- 2026-07-28 — Review parity is green: 7,425/7,425 root assertions across 543
  manifest files and 137/137 tutor-core assertions pass with zero skips.
  Manifest, 267-item source workplan, refs, lint, formatting, syntax, diff, and
  the zero-cycle ratchet across 422 files also pass.
- 2026-07-28 — Opened dependent PR #347 on PR #346's branch; managed refs are
  unchanged.
