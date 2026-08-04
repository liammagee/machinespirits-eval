---
id: audit-tutor-prompts-for-user-agency-and-control-parity
title: Audit tutor prompts for user agency and control parity
status: done
type: research
priority: P2
owner: codex
source: daily-routine
created: 2026-08-03
updated: 2026-08-05
verification: Every active tutor ego and superego prompt variant is scored on a frozen user-agency and control checklist; recognition and placebo prompts are compared on the same dimensions; discrepancies, exclusions, and any proposed prompt changes are reported without modifying an experimental prompt before a prospective decision.
claim_status: scope-bound
links:
  code:
    - config/tutor-prompt-agency-audit-v1.yaml
    - scripts/audit-tutor-prompt-agency.js
    - tests/tutorPromptAgencyAudit.test.js
  notes:
    - notes/daily-notes/2026-08-03-research-roundup.html
    - notes/2026-08-05-tutor-prompt-agency-control-audit.md
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/485
  items:
    - perspectivegap-a-benchmark-for-multi-agent-orchestration-pro
tags:
  - prompts
  - user-agency
  - placebo-control
  - audit
milestone: evaluation-infrastructure
---

arXiv:2607.28617 (AISPA) supplies an eight-axis, user-centred system-prompt
audit that is not covered by the repository's existing length and complexity
matching of placebo and recognition prompts.

The bounded task is an audit, not prompt tuning: freeze the checklist, score
the active prompt families consistently, compare recognition against placebo,
and report whether language around autonomy, authority, and recognition creates
agency or manipulation asymmetries. Any prompt change remains a separate,
prospective decision because historical evaluation prompts must not drift.

## Log

- 2026-08-05 — PR #485 merged as `947da2d0`; the human merge accepted the
  bounded prompt-level result and its explicit non-behavioural claim boundary.
  Verified the feature head is contained in `origin/main`, then removed the
  clean feature worktree and local branch.
- 2026-08-05 — Ready for review. The frozen audit derives 27 active prompt
  files from both tutor registries plus the direct reflection path and scores
  all 216 prompt-by-dimension cells. Results: 64 protective, 2 gray, 0
  explicitly problematic, and 150 no-evidence. Recognition and placebo are
  category-matched on D5 learner agency for both Ego and Superego; recognition
  Superego alone carries the clearer explicit D7 harm-prevention gate. The
  report also records two inactive root prompts and two local/core mirror
  drifts. Hash and evidence-span checks fail closed on prompt drift. Focused
  tests passed 4/4, lint passed, and the source-only workplan check passed
  397/397. No prompt file was changed and no model call was made.
- 2026-08-05 — Activated from `origin/main` after PR #483 closeout. Scope is a
  frozen, deterministic, no-model prompt audit and report. Experimental prompt
  files remain byte-for-byte unchanged; any proposed tuning is prospective.
