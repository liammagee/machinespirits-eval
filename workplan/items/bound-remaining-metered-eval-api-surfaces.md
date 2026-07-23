---
id: bound-remaining-metered-eval-api-surfaces
title: Extend exact-cost admission to every metered evaluation endpoint
status: done
type: infra
priority: P1
owner: codex
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
    - services/httpModelWorkAdmission.js
    - services/legacyChatCompatibilityRouter.js
    - services/legacyChatTutorEngine.js
    - tests/httpModelWorkAdmission.test.js
  notes: docs/http-model-work-admission.md
  items:
    - bound-metered-evaluation-api-requests
tags:
  - api
  - cost-control
  - evaluation-infrastructure
  - security
milestone: evaluation-infrastructure
branch: codex/bound-remaining-metered-eval-api-surfaces
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

Implementation:

- Exact test-plan admission now precedes quick, matrix, batch-stream, and
  recognition A/B handlers, and every `quickTest` launch reserves from the
  admitted Cartesian test budget.
- Prompt recommendation uses a composite contract: an exact fresh-evaluation
  plan (when needed) plus one separately confirmed recommender call.
- Interaction and deprecated chat routes use server-derived hard call limits;
  each provider or CLI launch reserves immediately before invocation.
- The policy registry also records already-bounded tutor-stub, pilot, and
  administrator Codex-process surfaces so the HTTP model-work inventory is
  explicit rather than inferred from route names.
- Dry runs stay zero-call and confirmation-exempt. Aborted and duplicate
  admissions fail before handler allocation, and admitted budgets fail closed
  if a handler tries to launch more work than declared.

Verification completed 2026-07-23:

- focused admission, API, administrator-auth, chat, and legacy engine tests pass;
- rejection tests cover malformed, unknown, oversized, unconfirmed, aborted,
  duplicate-admission, and exhausted-budget paths with zero downstream calls;
- the endpoint-inventory regression discovers direct evaluation/chat launch
  symbols and requires both a declared policy and pre-handler middleware;
- lint and diff checks pass;
- the full hermetic suite passes: 6,410 passed, 0 failed, 1 skipped.
