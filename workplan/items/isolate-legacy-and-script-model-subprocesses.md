---
id: isolate-legacy-and-script-model-subprocesses
title: Classify and isolate legacy and research-script model subprocesses
status: triaged
type: infra
priority: P1
owner: unassigned
source: review
created: 2026-07-24
updated: 2026-07-24
verification: A checked repository-wide launch manifest accounts for every
  remaining model CLI subprocess; active non-interactive calls use the shared
  fail-closed bridge, while explicit interactive or persistent exceptions use
  reviewed least-privilege launch policies and pass secret-canary tests.
depends_on:
  - isolate-remaining-direct-model-subprocesses
links:
  code:
    - services/legacyChatTutorEngine.js
    - services/evaluationRunner.js
    - scripts/generate-pedagogical-dramas.js
    - scripts/replay-discursive-transcript.js
  items:
    - isolate-remaining-direct-model-subprocesses
tags:
  - security
  - providers
  - process-isolation
  - scripts
milestone: evaluation-infrastructure
---

The production adapter consolidation deliberately does not conflate one-shot
text generation with legacy chat substrates, interactive Codex sessions,
persistent Claude workers, historical one-offs, or Gemini CLI judging. These
remaining launches still need an explicit repository-wide inventory and policy;
several currently inherit the ambient environment.

Acceptance:

- Inventory every remaining direct model subprocess, including dynamically
  selected binaries and archived scripts, and classify it as active
  non-interactive, persistent, interactive/user-authorized, or archival.
- Route active one-shot Claude and Codex calls through `callAIWithCliBridge` and
  preserve their prompt, output, usage, and provenance contracts.
- Give retained Gemini, persistent-session, and interactive launchers explicit
  central launch policies with provider-only environments, deliberate cwd/tool
  authority, cleanup, output bounds, and documented user authorization.
- Add a checked manifest/static regression that rejects an unclassified direct
  model launch anywhere in the repository.
- Add secret-canary and policy tests for every retained launch class; prohibit
  arbitrary environment passthrough and raw command or model output in errors.
