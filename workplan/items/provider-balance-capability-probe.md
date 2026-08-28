---
id: provider-balance-capability-probe
title: Optional provider-balance capability probe for budgeted runs
status: triaged
type: infra
priority: P2
owner: unassigned
source: review
created: 2026-08-27
updated: 2026-08-27
verification: Mocked provider-capability tests prove supported, unsupported,
  unavailable, and known-balance states remain distinct; a known balance is
  compared with remaining local ceiling before the first metered dispatch,
  the result is cached only for that process/provider, and no test contacts a
  live provider.
claim_status: methods
links:
  items:
    - budget-tracker-balance-probe-and-rates
tags:
  - adaptive-tutor
  - spend-ceiling
  - provider-capability
depends_on:
  - budget-tracker-balance-probe-and-rates
---

Add balance lookup only where provider configuration explicitly declares a
supported capability. Start with a documented OpenRouter adapter if its current
response contract is verified; treat Anthropic, OpenAI, Gemini, CLI, and local
routes as unsupported until they expose and document an equivalent.

The probe is advisory when unavailable and binding only when it returns a known
remaining balance under a declared policy. A ceiling larger than current credit
is not itself proof that the planned run will consume that amount, so record a
warning/stop policy explicitly rather than smuggling one into the transport.
Never interpret unsupported, malformed, or failed lookup as a numeric zero.
