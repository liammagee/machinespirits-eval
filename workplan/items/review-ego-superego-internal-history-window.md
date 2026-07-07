---
id: review-ego-superego-internal-history-window
title: Review configurable ego/superego internal history windows
status: done
type: experiment
priority: P2
owner: codex
source: manual
created: 2026-06-23
updated: 2026-06-24
verification: Closeout audit completed; no-spend tests cover default opt-out,
  explicit opt-in message history, and Phase-2 prompt-only behavior; result is
  retained as opt-in instrumentation only, not a default or Paper 2.0 finding.
claim_status: killed
branch: codex/internal-history-closeout
links:
  notes: notes/2026-06-23-ego-superego-history-window-review.md
  items: implement-messages-style-internal-history-probe
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

Closeout:

- 2026-06-24: Audited the merged opt-in implementation, focused tests, probe scripts, linked implementation card, and review note. The branch-local evidence supports a negative/limited conclusion: bounded internal-history messages are parse-stable and sometimes improve first-pass approval, but they do not produce robust cross-judge quality gains and add context when call counts are unchanged.
- 2026-06-24: Kept default behavior unchanged and retained the feature only as opt-in instrumentation/probe surface. Do not enable by default, do not register as a standard cell from this evidence, and do not fold into the main Paper 2.0 findings.
- 2026-06-24: Added no-spend test coverage for the explicit opt-in gate and the Phase-2 dialectical engine prompt-only boundary.
