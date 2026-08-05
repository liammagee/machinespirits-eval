---
id: docs-poetics-eval-api-guard
title: Close the poetics-server auth gap over /api/eval and Codex PTY endpoints
status: done
type: infra
priority: P1
owner: claude
source: review
created: 2026-08-05
updated: 2026-08-05
branch: worktree-docs-coherence
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

Landed 2026-08-05 (this branch): `services/evalSurfaces.js` now exports the
shared mount-prefix list (derived from the mount tables, so it cannot drift);
the poetics host applies guard + default-deny role gate over exactly those
prefixes, registered after its own routes so the scriptorium's reading pages,
the paper pre-mount and the legacy public redirects stay open. Unpathed
middleware on purpose — a pathed `app.use()` strips the prefix from
`req.path`, which blinds the participant allowlist (caught by test).
Tests extended in `tests/poeticsAdminAuth.test.js`: anonymous 401 on
`/api/eval/*` and `/subject`, participant 403 by default-deny, admin passes,
pilot participant flow still reachable. Route-parity and skin suites pass.
