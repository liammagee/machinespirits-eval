---
id: harden-cli-provider-process-isolation
title: Isolate CLI model providers from secrets and fail closed on tool use
status: triaged
type: infra
priority: P1
owner: unassigned
source: review
created: 2026-07-22
updated: 2026-07-22
verification: Spawned model CLIs receive only an explicit environment allowlist
  and any prohibited tool event fails the request; tests prove unrelated API
  secrets are absent and no successful response survives a policy violation.
claim_status: planned
depends_on: []
links:
  code:
    - services/cliProviderBridge.js
tags:
  - security
  - providers
  - process-isolation
  - secrets
milestone: evaluation-infrastructure
---

CLI-backed providers currently inherit the complete parent environment,
including unrelated API credentials. The no-tools boundary is expressed in a
prompt and audited after execution, while the existing behavior can still
accept structured output after a prohibited command event.

Acceptance:

- Replace environment inheritance with a documented minimum allowlist plus the
  selected provider's explicitly required variables.
- Treat any prohibited tool or command event as a failed request and discard
  accompanying model output.
- Redact sensitive environment values and command payloads from errors/traces.
- Add stub-child tests for environment isolation and fail-closed tool events on
  every supported CLI event shape.
