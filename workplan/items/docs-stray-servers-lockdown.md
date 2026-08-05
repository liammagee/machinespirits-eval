---
id: docs-stray-servers-lockdown
title: Lock down the two stray web servers (transcript browser, subject explorer)
status: active
type: infra
priority: P1
owner: claude
source: review
created: 2026-08-05
updated: 2026-08-05
verification: "browse-transcripts.js is deleted with no dangling references; serve-subject-explorer.js binds 127.0.0.1 by default behind the shared guard (or is retired); no reader hardcodes data/evaluations.db."
branch: worktree-docs-coherence
links:
  notes: notes/poetics/2026-08-05-documentation-map.html
  items: docs-coherence-structure
tags:
  - docs
  - security
  - servers
---

Two servers sit outside the shared stack and its auth perimeter:

- `scripts/browse-transcripts.js` (port 3456) — a 3,300-line second transcript
  browser. No npm script, `app.listen(PORT)` with no host (all interfaces), no
  `httpBasicAuth` guard, and its own `better-sqlite3` handle hardcoded to
  `data/evaluations.db`, ignoring `EVAL_DB_PATH`. It re-implements run/dialogue
  routes the shared stack already serves under `/api/eval`.
- `scripts/serve-subject-explorer.js` (port 4505) — isolation harness for a
  surface already mounted at `/subject` on all three real hosts; also binds all
  interfaces with no guard.

Fix options, in preference order:

1. Retire `browse-transcripts.js` (its surfaces exist in the scriptorium) or
   fold anything unique into the poetics browse routes.
2. If either stays: default host `127.0.0.1`, wire
   `resolveBasicAuthGuard`, open the DB via `openEvaluationDbReadonly()`.

Acceptance criteria:

- [x] `browse-transcripts.js` retired (user call, 2026-08-05): script deleted;
      the seven live references (README, AGENTS, GEMINI, script registry,
      ms-analyze-data + ms-deep-dive skills and their `.agents/` mirrors)
      repointed at the scriptorium. Dated exploration notes keep their
      historical mentions. The paper never cited it.
- [ ] `serve-subject-explorer.js`: loopback default + shared guard, or retire
      (the same surface is mounted at `/subject` on all three real hosts).
- [ ] No repo server binds beyond loopback without the shared guard engaged.
- [ ] No reader hardcodes `data/evaluations.db`.
