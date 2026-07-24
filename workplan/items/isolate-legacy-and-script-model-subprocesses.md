---
id: isolate-legacy-and-script-model-subprocesses
title: Classify and isolate legacy and research-script model subprocesses
status: done
type: infra
priority: P1
owner: codex
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
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/204
  code:
    - services/cliProviderBridge.js
    - services/modelCliProcessPolicy.js
    - services/legacyChatTutorEngine.js
    - services/evaluationRunner.js
    - config/model-cli-launch-manifest.json
    - scripts/check-model-cli-launches.js
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
branch: codex/isolate-legacy-and-script-model-subprocesses
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

Log:

- 2026-07-24 — Inventoried every direct model CLI launch in active services,
  research scripts, interactive sessions, and the retained archival one-off;
  added a checked Acorn-based manifest that rejects an unclassified launch.
- 2026-07-24 — Routed active one-shot Claude, Codex, and Gemini text calls
  through the shared fail-closed bridge, and centralized persistent Claude,
  interactive Codex, agentic Codex, Agy, and Ollama launch policy with explicit
  tool authority, provider-only environments, isolated cwd handling, cleanup,
  timeouts, and bounded output.
- 2026-07-24 — Added policy, secret-canary, Gemini deny-all, failure-redaction,
  persistent-output-bound, and launch-inventory regressions. After rebasing on
  merged PRs #200 and #201, lint and workplan validation pass; the complete
  hermetic suite passes 6,593/6,593 root tests and 137/137 tutor-core tests.
- 2026-07-25 — PR #204 merged as `e64bf971`; the feature branch was confirmed
  ancestral to `origin/main`, its clean worktree was removed, and the local and
  remote feature branches were deleted.
