---
id: admin-chat-drama-launcher-simplification
title: Admin chat drama launcher simplification
status: done
type: infra
priority: P1
owner: codex
source: manual
created: 2026-07-02
updated: 2026-07-03
verification: npm test (4684 pass) plus localhost browser smoke at /admin/chat/
claim_status: planned
tags:
  - admin-chat
  - drama-machine
  - ux
milestone: admin-chat
---

Restructure `/admin/chat/` around the primary admin task: stage and launch a
pedagogical drama with either a human or AI learner, while keeping all existing
architecture, model, curriculum, director, and research controls reachable.

Merged to `main` via PR #76 (squash `9b620fb0`), web-stack only
(`public/chat/index.html`, `routes/chatRoutes.js`) so the Electron app inherits
it by construction; route-parity and chat tests stay green.

Shipped, beyond the original `ADMIN-CHAT-SIMPLIFICATION-PLAN.md` scope:

- **Stage panel**: numbered steps (subject → tutor style → learner persona →
  who-writes), one dominant launch button with a sentence saying exactly what a
  press does, a playbill of every active knob, curated vs research-probe
  personas, and a collapsible left panel.
- **Subject vs curriculum** untangled: freeform topic with a "surprise me"
  shuffle and an explicit "teaching from <source>" pill.
- **Drama concierge** (`POST /assist`): plain-language → validated proposal →
  one-click apply; dry-run and CLI-substrate capable.
- **Curtain-raiser + tutor instigation**: every scene opens with a playbill
  page; `POST /turn` accepts `instigate: true` so the tutor can raise the
  curtain (guarded against a missing model).
- **Three script views**: plates · playscript · swimlanes (mirrors the poetics
  browser idiom).
- **Composer** redesigned as an unmistakable, speaker-keyed action zone.
- **Substrates**: cell models · local Claude CLI · local Codex CLI, each with
  model + reasoning-effort overrides; plus tutor temperature / max-tokens.
- **LLM metrics** (toggle): session rollup, per-turn metadata, per-turn
  latency/tokens/cost sparklines, and a live cumulative token/cost/time meter in
  the toolbar.
- **Vocabulary glossary**: 30 plain-language definitions surfaced as a
  non-clipping hover strip.

Workplan item: admin-chat-drama-launcher-simplification
