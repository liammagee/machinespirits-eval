---
id: provider-balance-capability-probe
title: Optional provider-balance capability probe for budgeted runs
status: review
type: infra
priority: P2
owner: claude
source: review
created: 2026-08-27
updated: 2026-08-28
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

- 2026-08-28 — Landed as `services/adaptiveTutor/providerBalanceProbe.js`, with
  the pre-dispatch check wired into both trap launchers through the shared
  metered session.
  - The capability is declared in provider config, not hardcoded, so no adapter
    is written from a guess and no route can start being called by accident.
    `unsupported`, `unavailable`, and `known` stay three answers;
    `remainingUsd` is null unless the status is `known`, so a failed, refused,
    malformed, or undeclared lookup can never read as zero. A provider-reported
    zero stays a real zero.
  - A known balance is compared with the ceiling the run can *still* reach
    (ceiling minus exposure already booked), before the first metered dispatch.
    A shortfall warns by default and stops only under an explicitly declared
    stop policy, because a ceiling above the remaining credit says what the run
    could reach, not what it will spend. An unknown balance never stops a run.
  - A known balance is cached per provider for the life of the process; an
    unavailable answer is not cached, so a transient failure does not stick.
  - **OpenRouter is not enabled.** The card allows a documented OpenRouter
    adapter "if its current response contract is verified", and this work could
    not verify it — no test may contact a live provider, and writing the field
    names from memory is exactly how a probe starts reporting a confident wrong
    number. `config/providers.yaml` therefore carries a commented
    `balance_probe` block for OpenRouter with the confirmation step spelled out.
    Enabling it is one uncomment after someone checks the endpoint and fields
    against a real response.
  Tests: `tests/providerBalanceProbe.test.js` (15 cases, every lookup a
  supplied function; no test contacts a provider).
