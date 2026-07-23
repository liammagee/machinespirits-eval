---
id: bound-metered-evaluation-api-requests
title: Add admission controls to metered evaluation API requests
status: done
type: infra
priority: P1
owner: codex
source: review
created: 2026-07-22
updated: 2026-07-23
verification: Eval run and comparison routes reject malformed, unknown, or
  oversized plans before allocation or model calls; accepted plans expose an
  exact bounded test count and route regressions prove the paid-work ceiling.
claim_status: planned
branch: codex/tutor-stub-super-app-slices
depends_on: []
links:
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/159
  code:
    - routes/evalRoutes.js
    - services/evaluationRunner.js
  items:
    - bound-remaining-metered-eval-api-surfaces
tags:
  - api
  - cost-control
  - evaluation-infrastructure
  - security
milestone: evaluation-infrastructure
---

The evaluation run and comparison endpoints currently accept untyped arrays
and an unbounded `runsPerConfig`, then materialize the Cartesian product in
memory and may launch paid model calls. Negative, fractional, unknown, or very
large inputs have no route-level admission boundary.

Acceptance:

- Define request schemas for profiles, scenarios, and integer run counts.
- Validate profile and scenario membership against the effective registries.
- Compute the exact planned test count before materialization and reject plans
  above a conservative server-configured ceiling.
- Require an explicit privileged override or confirmation for any supported
  high-cost path, and record the admitted plan in run provenance.
- Add route tests proving invalid and oversized requests cause zero model calls.

## Progress

- 2026-07-23: `/api/eval/run` and `/api/eval/compare` now validate typed unique
  profile/scenario registries, positive safe-integer repetition counts, exact
  Cartesian cost, a conservative server ceiling, server-authenticated override,
  and exact paid-work confirmation before allocating a run.
- 2026-07-23: The frozen admission plan is persisted in run metadata. Unit and
  injected-route tests prove malformed, unknown, oversized, and unconfirmed
  requests make zero runner calls; remaining metered endpoints are tracked in a
  follow-up card.
- 2026-07-23: PR #159 merged to `main`; exact-count and zero-allocation route
  regressions passed in the 6,477-test hermetic acceptance run.
