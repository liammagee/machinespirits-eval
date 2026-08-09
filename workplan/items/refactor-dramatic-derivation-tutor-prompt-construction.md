---
id: refactor-dramatic-derivation-tutor-prompt-construction
title: Extract dramatic-derivation tutor prompt construction
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-10
updated: 2026-08-10
branch: codex/refactor-dramatic-derivation-tutor-prompt-construction
verification: >-
  6/6 direct prompt assertions, 612/612 focused dramatic assertions, 8,363/8,363
  hermetic root tests, 137/137 tutor-core tests, and all twelve risk groups pass.
  The prompt owner reaches 100% line/98.58% branch/100% function coverage; its
  maximum complexity is 11; lint, format, manifest, source-workplan, diff, and
  zero-cycle gates pass.
claim_status: planned
depends_on:
  - refactor-dramatic-derivation-strategy-ledger-prompt
links:
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/629
  notes:
    - docs/next-steps/2026-08-09-codebase-refactoring-post-run-coordinator-reconciliation.md
    - docs/next-steps/2026-08-10-codebase-refactoring-post-strategy-ledger-reconciliation.md
  code:
    - services/dramaticDerivation/llmRoles.js
    - services/dramaticDerivation/tutorPrompt.js
    - tests/dramaticDerivationTutorPrompt.test.js
    - config/coverage-risk-floors.json
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
    - refactor-dramatic-derivation-strategy-ledger-prompt
tags:
  - refactoring
  - dramatic-derivation
  - prompt
  - tutor
  - llm-roles
milestone: evaluation-infrastructure
---

Continue R5 after PR #627. The strategy-ledger prompt section now has a pure
owner, but `llmRoles.js` remains 5,085 lines and its tutor role still combines
prompt projection with audits, model calls, response parsing, conduct policy,
and state mutation. The next bounded macro extracts the prompt-only boundary:
the 462-line, complexity-64 static tutor system prompt plus the 99-line
acts/non-acts per-turn user-prompt projection.

Acceptance:

- Introduce one tutor-prompt owner for the static system prompt and the final
  acts/non-acts user-prompt assembly from already-derived turn sections.
- Preserve prompt text, blank lines, section order, feature gating, redaction,
  transcript tails, public-register blocks, and model-call inputs byte-for-byte.
- Keep plot, throughline, strategy-ledger, field, cast, ownership, release,
  proof-debt, and rhetorical-policy state derivation in their current owners;
  the prompt owner receives their already-computed projections.
- Keep audits, stock-take and tutor/superego calls, retry/refusal behavior,
  response parsing, release arbitration, conduct enforcement, state mutation,
  and learner prompts in `llmRoles.js`.
- Reduce `llmRoles.js` by at least 450 lines, keep the extracted owner below
  700 lines, reduce its maximum function complexity below 30, and add no import
  cycle.
- Add direct parity characterization for both tutor modes and active feature
  branches, ratchet risk coverage and the hermetic manifest, and preserve all
  existing public exports.

Log:

- 2026-08-10 — Triaged from refreshed main `d5759f63`. Baseline:
  `llmRoles.js` is 5,085 lines; `tutorFn` is complexity 502; `tutorSystem` is
  462 lines and complexity 64; final acts/non-acts user-prompt assembly is 99
  lines. The final engine view seam remains deferred: `engine.js` is 1,217
  lines, `runDrama()` is complexity 14, and its remaining view projector is
  complexity 46.
- 2026-08-10 — Activated on
  `codex/refactor-dramatic-derivation-tutor-prompt-construction`; implementation
  starts from the exact reconciliation base and preserves the source-only
  workplan contract.
- 2026-08-10 — Completed the extraction. The 617-line pure owner holds both
  the static system prompt and the acts/non-acts turn projection; its maximum
  complexity is 11. `llmRoles.js` fell from 5,085 to 4,566 lines and `tutorFn`
  complexity fell from 502 to 493 without moving runtime decisions or model
  calls. Six direct prompt assertions, 612 focused dramatic assertions, 8,363
  hermetic root tests, 137 tutor-core tests, all twelve risk groups, and all
  structural gates pass. The first monolithic root run exposed concurrent test
  interference; clean shards passed 4,659/4,659 and 3,704/3,704 after the known
  `tutorStubPassthrough` recurrence passed 7/7 alone.
- 2026-08-10 — PR #629 merged as `f6c148d5`; the serialized workplan refresh
  advanced `main` to `db5b5958`. The post-merge reconciliation confirms the
  prompt owner and closes this child.
