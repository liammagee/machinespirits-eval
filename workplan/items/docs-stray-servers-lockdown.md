---
id: docs-stray-servers-lockdown
title: Lock down the two stray web servers (transcript browser, subject explorer)
status: triaged
type: infra
priority: P1
owner: claude
source: review
created: 2026-08-05
updated: 2026-08-05
verification: "Both scripts bind 127.0.0.1 by default, refuse a non-local bind without credentials via the shared guard, and open the DB through the readonly EVAL_DB_PATH-aware helper; a probe from another interface fails."
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

- [ ] No repo server binds beyond loopback without the shared guard engaged.
- [ ] No reader hardcodes `data/evaluations.db`.
- [ ] Whatever survives gets an npm script and a line in the entry-point index.
