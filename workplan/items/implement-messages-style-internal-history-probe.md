---
id: implement-messages-style-internal-history-probe
title: Implement messages-style ego/superego history probe
status: active
type: experiment
priority: P2
owner: codex
source: manual
created: 2026-06-23
updated: 2026-06-23
verification: Opt-in messages-style internal-history config is implemented with
  defaults unchanged; mock/hermetic tests pass; a small token-limited comparison
  reports latency/tokens/convergence/revision behavior before any wider run.
claim_status: exploratory
branch: codex/internal-history-messages
links:
  notes: notes/2026-06-23-ego-superego-history-window-review.md
  items: review-ego-superego-internal-history-window
  code:
    - tutor-core/services/tutorDialogueEngine.js
    - config/tutor-agents.yaml
tags:
  - ego-superego
  - messages-api
  - performance
  - token-budget
---

Implement the smallest useful messages-style internal-history probe. The default path must remain behaviorally unchanged. The experimental path should let a cell include a bounded same-turn ego/superego exchange as chat-style `user` / `assistant` messages, with a small `max_chars_per_message` cap so the first evaluation can inspect whether performance improves or merely spends more context.

Acceptance:

- Add an opt-in config surface for internal history, initially targeting `surface: messages`, `window: 1`, and a capped message length.
- Preserve current defaults and historical comparability.
- Add focused tests that prove message arrays differ only when the option is enabled.
- Run a small comparison with a limited output/token budget and report token/latency/convergence/revision differences.
