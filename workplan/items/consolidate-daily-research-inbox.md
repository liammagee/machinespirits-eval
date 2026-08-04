---
id: consolidate-daily-research-inbox
title: Consolidate the daily-research capture inbox
status: active
type: ops
priority: P2
owner: codex
source: manual
created: 2026-08-04
updated: 2026-08-04
verification: Every research capture is either promoted with a distinct executable verification contract, folded into an existing item with a recorded decision, or dropped as non-actionable context; the inbox returns to README-only and the workplan source check passes without duplicate items.
branch: codex/consolidate-workplan-inbox
claim_status: methods
tags:
  - workplan
  - literature
  - triage
milestone: literature-triage
---

The apparent 67-item inbox contained the inbox README plus 66 automated
daily-roundup research captures. At the start of this pass, 20 captures were
marked `[UNBLOCK]` and 46 `[WATCH]`; they span 2026-06-23 through 2026-08-03.
These are suggestions awaiting a commitment decision, not 66 accepted tasks.

Consolidation rules:

- Promote only when the capture defines work not already represented by a live
  item and can state a concrete verification contract.
- Fold relevant literature into an existing item by linking that item and
  recording why no independent task was created.
- Drop background-only captures after confirming the dated roundup preserves
  the source and rationale.
- Process recent captures first, then the older `[UNBLOCK]` queue, then the
  `[WATCH]` queue.

Log:

- 2026-08-04 — Baseline: 66 captures (20 `[UNBLOCK]`, 46 `[WATCH]`) plus the
  README. Began with the four captures from the 2026-08-03 roundup.
- 2026-08-04 — Resolved the newest four: three folded into existing work as
  reviewed literature records; AISPA promoted to a distinct prompt-parity
  audit. Remaining queue: 62 captures (17 `[UNBLOCK]`, 45 `[WATCH]`).
- 2026-08-04 — Resolved all 17 remaining `[UNBLOCK]` captures. Each mapped to
  existing implementation, research, or measurement work, so no duplicate
  executable card was promoted. The source and decision are preserved in 17
  completed literature-triage records. Remaining queue: 45 `[WATCH]` captures.
