---
id: refactor-message-chain-fixtures
title: Extract and fixture the message-chain integrity boundary
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-25
updated: 2026-07-25
verification: >-
  A pure integrity core and synthetic SQLite/dialogue-log fixtures exercise the
  production message-chain CLI; valid tutor and learner chains pass, while
  malformed JSON or trace data, content-hash drift, and turn/message ordering
  failures return exact structured findings and non-zero strict-mode exits.
branch: codex/refactor-message-chain-fixtures
depends_on:
  - refactor-provenance-fixtures
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - scripts/audit-message-chain.js
    - services/messageChainAudit.js
    - tests/messageChainAuditCli.test.js
    - tests/messageChainAuditCore.test.js
  items:
    - codebase-refactoring-program
    - refactor-provenance-fixtures
tags:
  - refactoring
  - testing
  - provenance
  - message-chain
  - hermetic
milestone: evaluation-infrastructure
---

Bounded row 16 slice: separate message-chain integrity decisions from the
1,074-line audit renderer and test the production CLI against self-contained
synthetic data rather than the private evaluation archive.

Out of scope:

- Changing message-chain construction, tutor/learner trace persistence, or
  evaluation-store schemas.
- Rewriting report formatting or moving all reconstruction/rendering helpers.
- Editing historical evaluation rows or dialogue logs.
- Running model-backed, paid, or private-data-dependent evaluation work.

Acceptance:

- A pure core validates the stored dialogue hash, dialogue/trace shape,
  monotonic turn indices, and alternating `{role, content}` messages equally
  for tutor and learner input chains.
- The production CLI distinguishes missing and malformed logs and exposes the
  structured integrity result in JSON and text output.
- Explicit `--strict` mode exits non-zero on integrity failure; legacy audit
  mode keeps its historical zero exit while reporting the same findings.
- Synthetic CLI fixtures prove complete-chain success, malformed JSON,
  content-hash drift, turn and role ordering failures, and selector usage
  errors with exact exit codes and reasons.
- Focused tests, the root manifest, full hermetic parity, lint, formatting,
  cycle, source-only workplan, and diff gates pass without model calls.

## Log

- 2026-07-25 — Activated from `origin/main` at `8bd18198` after PR #230 merged
  the provenance fixture boundary. The existing audit CLI renders gaps but
  exits zero for missing or malformed logs and does not compare the row's
  stored dialogue hash; existing tests cover message construction rather than
  fixture-to-exit integrity behavior.
- 2026-07-25 — Chose an additive strict boundary: default inspection behavior
  retains its zero exit, while `--strict` makes structured integrity findings
  fail closed. This avoids turning historical exploratory audit invocations
  into a breaking change.
- 2026-07-25 — Extracted the 195-line pure integrity core and added six core
  plus six production-CLI fixture cases. The existing message-chain suite and
  new coverage pass together at 47/47; lint, formatting, the synchronized
  manifest, zero cycles across 356 files, and 187/187 workplan source items are
  green.
- 2026-07-25 — Final hermetic parity passes 6,771/6,771 root tests and 137/137
  in-housed tutor-core tests with zero skips. The only intermediate failure was
  an outdated shared dependency symlink missing the already-declared
  `rdf-validate-shacl`; the dependency-corrected worktree passes its affected
  proxy-DAG file at 9/9 and the complete gate.
