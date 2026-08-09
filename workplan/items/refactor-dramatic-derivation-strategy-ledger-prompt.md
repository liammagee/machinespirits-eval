---
id: refactor-dramatic-derivation-strategy-ledger-prompt
title: Extract dramatic-derivation strategy-ledger tutor prompt
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-10
updated: 2026-08-10
branch: codex/refactor-dramatic-derivation-strategy-ledger-prompt
verification: >-
  8/8 direct prompt assertions, 617/617 focused dramatic/lemma/register
  assertions, 8,357/8,357 hermetic root tests, 137/137 tutor-core tests, and all
  eleven risk groups pass. The prompt owner reaches 100% line/95.24% branch/
  100% function coverage; every new function is complexity 16 or lower; lint,
  format, manifest, source-workplan, diff, and zero-cycle gates pass.
claim_status: planned
depends_on:
  - refactor-dramatic-derivation-release-arbitration
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
    - docs/next-steps/2026-08-09-codebase-refactoring-post-run-coordinator-reconciliation.md
  code:
    - services/dramaticDerivation/llmRoles.js
    - services/dramaticDerivation/tutorStrategyLedgerPrompt.js
    - tests/dramaticDerivationTutorStrategyLedgerPrompt.test.js
    - config/coverage-risk-floors.json
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
    - refactor-dramatic-derivation-release-arbitration
tags:
  - refactoring
  - dramatic-derivation
  - strategy-ledger
  - prompt
  - llm-roles
milestone: evaluation-infrastructure
---

Continue R5 after PR #626. Release arbitration now has a bounded owner, but
`makeLlmTutor()` still contains a 150-line, complexity-68 nested projector for
the strategy-ledger prompt: sealed-scene audit, trial history, plan-mode
stock-take, opening commitment, standing commitment, lemma frontier, didactic
hold, and opportunity-budget warning.

Acceptance:

- Introduce one pure strategy-ledger tutor-prompt owner with bounded helpers
  for audit, mechanism history, plan mode, opening/standing commitment, lemma,
  didactic hold, and opportunity-budget lines.
- Preserve every prompt line and its ordering byte-for-byte at the integration
  boundary, including off-state absence and the acts/non-acts placement.
- Keep strategy-ledger state mutation, audits, stock-take model calls, response
  parsing, scene commitments, release arbitration, and learner prompts in their
  existing owners.
- Reduce `llmRoles.js` materially, remove the complexity-68 nested function,
  keep every new function at complexity 30 or lower, and add no import cycle.
- Add direct branch characterization, ratchet it in the hermetic manifest, and
  add a dedicated risk-coverage group alongside the existing strategy-ledger
  integration tests.

Log:

- 2026-08-10 — Activated from refreshed main `9342e250` after PR #626. Baseline:
  `llmRoles.js` is 5,221 lines; `tutorFn` complexity is 502; its nested
  strategy-ledger prompt projector is 150 lines and complexity 68.
- 2026-08-10 — Rebased onto current main `e4242ca6` after PR #625; its only
  overlap was the append-only hermetic manifest, which merged cleanly.
- 2026-08-10 — Completed the extraction. The 189-line pure prompt owner splits
  audit, mechanism history, plan mode, opening and standing commitments, lemma,
  didactic hold, and budget projection into functions of complexity 16 or
  lower. `llmRoles.js` fell from 5,221 to 5,085 lines and no longer reports the
  complexity-68 nested projector. Direct prompt arrays pin line text and order;
  617 focused assertions, 8,357 root tests, 137 tutor-core tests, all eleven
  risk groups, and structural gates pass. The first all-risk run hit only the
  expected sandbox loopback `EPERM`; the permissioned rerun was fully green.
- 2026-08-10 — PR #627 merged as `7d2e379d`; the post-merge hotspot
  reconciliation closes this child on refreshed main `d5759f63`.
