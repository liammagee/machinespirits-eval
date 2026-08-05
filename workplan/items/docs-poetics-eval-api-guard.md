---
id: docs-poetics-eval-api-guard
title: Close the poetics-server auth gap over /api/eval and Codex PTY endpoints
status: review
type: infra
priority: P1
owner: codex
source: review
created: 2026-08-05
updated: 2026-08-05
branch: codex/docs-poetics-eval-api-guard
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

2026-08-05 Codex: Activated from current `origin/main` after closing the merged
latency screen. Implementation is confined to the poetics host perimeter and
its route-parity/auth tests; public read-only pages and credential-free
localhost behavior remain invariants.

2026-08-05 Codex: Wrapped the complete shared eval-surface mount with the
poetics Basic Auth guard and default-deny role gate while leaving `/healthz`
and poetics-native read-only pages outside the perimeter. Mounted-prefix tests
now prove unauthenticated eval, SSE, and Codex PTY requests return 401,
participant credentials return 403, administrator access succeeds, and the
pilot participant allowlist remains live. Focused auth, desktop route-parity,
desktop menu, and poetics browser tests pass; ESLint, Prettier, workplan source
validation, and `git diff --check` also pass. Ready for review.
