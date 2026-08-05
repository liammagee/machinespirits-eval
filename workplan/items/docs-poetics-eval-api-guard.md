---
id: docs-poetics-eval-api-guard
title: Close the poetics-server auth gap over /api/eval and Codex PTY endpoints
status: triaged
type: infra
priority: P1
owner: claude
source: review
created: 2026-08-05
updated: 2026-08-05
verification: "With POETICS/EVAL credentials set, unauthenticated POST /api/eval/quick and /api/eval/codex/* return 401 on the poetics host; desktop route-parity and existing surface tests still pass."
links:
  notes: notes/poetics/2026-08-05-documentation-map.html
  items: docs-coherence-structure
tags:
  - docs
  - security
  - servers
---

Perimeter asymmetry between the two hosts of the shared surfaces:

- `server.js` applies the basic-auth guard and role gate app-wide before every
  route.
- `scripts/browse-poetics-scripts.js` guards only the `/admin` router,
  `/tutor`, and `/api/tutor-stub`. Everything else — including the metered run
  endpoints (`POST /api/eval/quick|run|compare|matrix`), the SSE streams, and
  the Codex PTY session endpoints — is reachable unauthenticated even when
  credentials are set.

Decide the intended perimeter and apply it. Default proposal: on the poetics
host, apply the same guard + role gate in front of `mountEvalSurfaces` (health
endpoint stays pre-guard), keeping localhost-open behaviour when no creds are
configured. Check the desktop app still boots and its route-parity tests pass,
and that the pilot participant flow keeps its allowlist behaviour.
