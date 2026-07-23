---
id: isolate-remaining-direct-model-subprocesses
title: Route remaining direct model subprocesses through one isolation boundary
status: triaged
type: infra
priority: P1
owner: unassigned
source: review
created: 2026-07-23
updated: 2026-07-23
verification: Every repository-owned model CLI launch uses the shared provider
  environment allowlist and fail-closed event policy; a spawn inventory test
  rejects new direct model subprocesses and secret-canary tests cover each
  retained adapter.
depends_on:
  - harden-cli-provider-process-isolation
links:
  code:
    - services/rubricEvaluator.js
    - services/adaptiveTutor/realLLM.js
    - services/dramaticDerivation/llmClient.js
  items:
    - harden-cli-provider-process-isolation
tags:
  - security
  - providers
  - process-isolation
  - secrets
milestone: evaluation-infrastructure
---

The central CLI provider bridge now launches Claude and Codex with a minimal,
provider-specific environment and rejects tool events before returning output.
Several service-local model adapters and one-off scripts still spawn model CLIs
directly with the ambient environment, so the security invariant is not yet
repository-wide.

Acceptance:

- Inventory every repository-owned Claude, Codex, and other model CLI spawn.
- Move retained service adapters behind the shared child-environment and
  fail-closed event helpers without changing their public response contracts.
- Keep test fixtures explicit; never add a production `FAKE_*` or arbitrary
  environment passthrough.
- Add a static regression test that fails when a new direct model CLI spawn is
  introduced outside an allowlisted boundary.
- Prove unrelated API secrets, Node preload flags, raw command payloads, and
  prohibited tool output cannot cross each retained adapter.
