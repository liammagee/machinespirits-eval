---
id: tutor-stub-terminal-fallback-delivery-boundary
title: "Keep tutor-stub terminal fallbacks deliverable without weakening evidence safety"
status: review
type: maintenance
priority: P1
owner: codex
source: manual
created: 2026-07-23
updated: 2026-07-23
verification: "A regression reproduces the missing_selected_performance_tactic terminal-fallback failure and proves that optional actorial/configuration findings cannot exhaust public delivery, leak/release/unknown findings remain hard, the thrown fatal message contains only hard findings, and the focused tutor-stub plus workplan checks pass."
branch: codex/tutor-final-fallback-fix
depends_on:
  - committee-runtime-main-reconciliation
tags:
  - tutor-stub
  - fallback
  - response-guards
  - runtime
---

Repair the terminal boundary exposed by the 2026-07-23 human tutor-stub run:
the deterministic safety fallback passed evidence and conversational checks but
the dialogue still terminated because the heuristic actorial-performance audit
did not recognize `unadorned_report`. Two report-only response-configuration
findings were then incorrectly included in the fatal error text.

Acceptance criteria:

- Terminal deterministic fallback delivery cannot be vetoed solely by optional
  actorial-part or performance-tactic realization.
- Evidence leakage, missing due evidence, malformed/unknown audit findings, and
  other public-safety failures remain fail-closed.
- The trace retains all audit findings and their dispositions, while any fatal
  runtime message names only the hard findings that actually blocked delivery.
- Regression coverage includes the exact mixed hard/report-only envelope from
  the live failure and a hard evidence-boundary control.

2026-07-23 Codex: Activated from the live human-session failure and isolated on
`codex/tutor-final-fallback-fix` from current `origin/main`; the dirty
adversarial-character checkout is intentionally untouched.

2026-07-23 Codex: Implemented guard-disposition catalog v2. On the terminal
fallback attempt only, the two known actorial-realization misses are advisory;
conversational advisories and report-only axis findings retain their trace
provenance, while leak/release/unknown findings remain hard. Fatal-message
formatting now reads only the effective `hardIssues`. Verification passed: 27
guard/accounting tests, two deterministic-fallback CLI tests, 29/29 derivation
worlds, targeted ESLint and Prettier, and the 158-item workplan check. Card moved
to review pending commit/merge.
