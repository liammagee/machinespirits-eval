---
id: adaptive-register-switching
title: Does switching into an edged register at the right moment help?
status: blocked
type: experiment
priority: P3
owner: codex
source: manual
created: 2026-08-09
updated: 2026-08-09
verification: Frozen plan, router seam, cells, runner, and fail-closed report
  validate; Stage 1 completes only when the approved 10-row adaptive pilot has
  a complete measures 1-4 report and its pass/kill decision is recorded.
blocked_by: Explicit operator approval of frozen Stage-1 plan SHA
claim_status: exploratory
depends_on:
  - register-mock-praise-probe
links:
  notes:
    - notes/2026-08-09-adaptive-register-switching-prereg-draft.md
  exports:
    - exports/adaptive-register-switching/plan.json
tags:
  - register
  - manner
  - router
  - adaptivity
---

The mock-praise probe closed the generation question for negative registers on
the strong stack; what no run has measured is switching. The pinned sarcastic
arm converting least is evidence about the costume worn all day, not about the
right manner at the right moment — the operator's counter (manner is often
what makes content take, with human and synthetic learners alike) is the
motivating hypothesis.

Frozen design, in the note: three tutors in one batch — router free to choose
edged registers on resistance, router-warm control, pinned sarcastic (cell 197). The
third arm separates timing from edge. Primary is conversion at the
post-resistance fold; manipulation checks come first (does the router switch,
and at the right moments); each register scored under its own gate; the manner
question stays unbumped so readings pool. Staged: a 10-row router-behaviour
pilot with a kill condition before any powered outcome batch. The exact table
pins the proposed Stage 2 at 35 rows per arm (105 total; exact power .8522 for
.50 versus .85).

2026-08-09 Codex: froze the design at plan SHA
`da2723e47de143305e88a9a7b26688f6f58e4958e0b310ed4d7e147cd9734845`.
Built the cell-scoped router-menu seam and cells 204/205; edged registers stay
`router_selectable: false` globally. Added a Stage-1-only SHA-gated runner and
zero-call fail-closed report carrying registered measures 1-8, with measures
1-4 collected in Stage 1 and 5-8 explicitly withheld for Stage 2. No model
calls made. Blocked at the explicit operator-approval gate.
