---
id: harden-cli-provider-process-isolation
title: Isolate CLI model providers from secrets and fail closed on tool use
status: done
type: infra
priority: P1
owner: codex
source: review
created: 2026-07-22
updated: 2026-07-23
verification: Spawned model CLIs receive only an explicit environment allowlist
  and any prohibited tool event fails the request; tests prove unrelated API
  secrets are absent and no successful response survives a policy violation.
claim_status: planned
branch: codex/tutor-stub-super-app-slices
depends_on: []
links:
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/159
  code:
    - services/cliProviderBridge.js
  items:
    - isolate-remaining-direct-model-subprocesses
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

## Progress

- 2026-07-23: The shared Codex and Claude bridge now constructs a documented
  provider-specific environment allowlist, strips Node loader flags and
  unrelated credentials, suppresses raw child output from failures, and rejects
  prohibited or invalid Codex event streams before any result is returned.
- 2026-07-23: Secret-canary, event-shape, streaming-boundary, spawn, exit, and
  existing service-spawn inventory tests pass. Repository-local adapters that
  still launch model CLIs directly are tracked separately.
- 2026-07-23: PR #159 merged to `main`; the final integrated hermetic suite
  passed 6,477 tests with one intentional skip, with lint, formatting, and
  focused provider-boundary tests green.
