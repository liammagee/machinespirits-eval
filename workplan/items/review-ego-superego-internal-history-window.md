---
id: review-ego-superego-internal-history-window
title: Review configurable ego/superego internal history windows
status: triaged
type: experiment
priority: P2
owner: unassigned
source: manual
created: 2026-06-23
updated: 2026-06-24
verification: Current same-turn history behavior is covered by tests; a
  configurable history-window design is either implemented and smoke-tested with
  a bounded comparison, or explicitly rejected with rationale.
claim_status: exploratory
links:
  notes: notes/2026-06-23-ego-superego-history-window-review.md
  code:
    - tutor-core/services/tutorDialogueEngine.js
    - tutor-core/services/dialecticalEngine.js
tags:
  - ego-superego
  - message-history
  - prompt-assembly
  - mechanism-test
milestone: paper-2-evidence-cleanup
---

Confirm and review the prompt-assembly boundary for same-turn ego/superego deliberation. Current behavior is mixed: `single-prompt` mode does not carry internal deliberation as chat history; `messages` mode carries limited per-role in-turn chains, but not a configurable unified ego/superego transcript; the Phase-2 dialectical engine records traces but does not feed them forward as chat-message history.

Evaluate whether to add a variable internal-history window so some amount of same-turn deliberation can be included as `user` / `assistant` style messages. This should be treated as an experimental mechanism question, not a blanket refactor.

Acceptance:

- Add tests that lock current behavior for `single-prompt`, `messages`, and Phase-2 dialectical negotiation.
- Design an opt-in config surface, e.g. `internal_history_window: 0 | 1 | 2 | all` plus whether the window is ego-only, superego-only, or unified.
- If implemented, keep default behavior unchanged and add mock/hermetic coverage proving only configured cells receive the additional messages.
- Run or queue a bounded comparison that holds model/scenarios/max rounds fixed and varies only the history window.
- Report parse failures, convergence, rejection/approval pattern, revision magnitude, tutor quality, and whether the effect looks like better deliberation or merely more compliance.
