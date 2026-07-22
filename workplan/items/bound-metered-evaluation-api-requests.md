---
id: bound-metered-evaluation-api-requests
title: Add admission controls to metered evaluation API requests
status: triaged
type: infra
priority: P1
owner: unassigned
source: review
created: 2026-07-22
updated: 2026-07-22
verification: Eval run and comparison routes reject malformed, unknown, or
  oversized plans before allocation or model calls; accepted plans expose an
  exact bounded test count and route regressions prove the paid-work ceiling.
claim_status: planned
depends_on: []
links:
  code:
    - routes/evalRoutes.js
    - services/evaluationRunner.js
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
