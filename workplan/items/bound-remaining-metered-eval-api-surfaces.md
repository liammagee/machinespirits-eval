---
id: bound-remaining-metered-eval-api-surfaces
title: Extend exact-cost admission to every metered evaluation endpoint
status: triaged
type: infra
priority: P1
owner: unassigned
source: review
created: 2026-07-23
updated: 2026-07-23
verification: Every HTTP endpoint capable of starting model work resolves an
  exact bounded plan or a single-call cost class before allocation; malformed,
  unknown, oversized, or unconfirmed requests produce zero model calls, and an
  endpoint inventory test prevents unadmitted paid routes from being added.
depends_on:
  - bound-metered-evaluation-api-requests
links:
  code:
    - routes/evalRoutes.js
    - routes/chatRoutes.js
  items:
    - bound-metered-evaluation-api-requests
tags:
  - api
  - cost-control
  - evaluation-infrastructure
  - security
milestone: evaluation-infrastructure
---

Exact-count admission now protects `/api/eval/run` and `/api/eval/compare`.
Other legacy HTTP paths can still start paid or quota-backed work through quick,
matrix, streaming, interaction, and prompt-recommendation handlers. They need
the same server-verified boundary, adapted for single-call and streaming plans.

Acceptance:

- Classify `/quick`, `/matrix`, `/stream/run`, `/stream/matrix`,
  `/stream/interact`, `/prompts/recommend`, and any chat/provider launch route
  as zero-cost, fixed-call, or exact Cartesian-plan work.
- Reuse one request schema, registry resolver, ceiling, privileged override,
  confirmation, and provenance contract across all metered endpoints.
- Perform admission before SSE headers, run creation, array materialization, or
  provider invocation.
- Add injected-handler tests proving every rejection path invokes no runner or
  model code, including client disconnect and duplicate-stream cases.
- Add an endpoint inventory regression so a new metered handler cannot ship
  without an admission policy.
