---
id: isolate-remaining-direct-model-subprocesses
title: Route reviewed production model adapters through one isolation boundary
status: done
type: infra
priority: P1
owner: codex
source: review
created: 2026-07-23
updated: 2026-07-24
verification: The three production adapters named by the refactoring review use
  the shared provider environment allowlist and fail-closed event policy; a
  service-spawn regression and secret-canary tests cover each migrated adapter.
depends_on:
  - harden-cli-provider-process-isolation
links:
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/199
  code:
    - services/rubricEvaluator.js
    - services/adaptiveTutor/realLLM.js
    - services/dramaticDerivation/llmClient.js
  items:
    - harden-cli-provider-process-isolation
    - isolate-legacy-and-script-model-subprocesses
tags:
  - security
  - providers
  - process-isolation
  - secrets
milestone: evaluation-infrastructure
branch: codex/isolate-remaining-direct-model-subprocesses
---

The central CLI provider bridge now launches Claude and Codex with a minimal,
provider-specific environment and rejects tool events before returning output.
The refactoring review identified three production adapters that still bypassed
that boundary: the rubric evaluator, adaptive tutor real-LLM client, and
dramatic-derivation client. Legacy, interactive, long-lived, and research-script
launchers have different process contracts and are tracked separately by
`isolate-legacy-and-script-model-subprocesses`.

Acceptance:

- Inventory the three production adapters named by the refactoring review.
- Move those adapters behind the shared child-environment and
  fail-closed event helpers without changing their public response contracts.
- Keep test fixtures explicit; never add a production `FAKE_*` or arbitrary
  environment passthrough.
- Add a static regression test that fails when a new direct model CLI spawn is
  introduced outside an allowlisted boundary.
- Prove unrelated API secrets, Node preload flags, raw command payloads, and
  prohibited tool output cannot cross each retained adapter.

Log:

- 2026-07-24 — Routed the rubric evaluator, adaptive tutor real-LLM adapter,
  and dramatic-derivation CLI client through `cliProviderBridge`, removing
  their duplicated Claude/Codex subprocess launches while preserving the
  rubric judge's default-system-prompt behavior and each adapter's response and
  accounting contracts.
- 2026-07-24 — Expanded the subprocess inventory regression to cover all
  literal Claude/Codex launches in service JavaScript, added provider secret
  canaries and isolated-cwd assertions for the migrated adapters, and proved
  that prohibited Codex tool events fail closed without returning model output.
- 2026-07-24 — Focused bridge, adaptive-tutor, dramatic-derivation, and rubric
  suites pass; the final full hermetic suite passes 6,649/6,649 root tests and
  133/133 tutor-core tests, with lint, format, workplan, and diff checks green.
- 2026-07-24 — A repository-wide closeout inventory found heterogeneous legacy,
  interactive, persistent-session, and research-script launches beyond the
  three production adapters named by the review plan. Those are preserved as a
  separate P1 follow-up rather than being silently bundled into this refactor
  dependency.
- 2026-07-24 — PR #199 merged to `main` after all required checks passed; the
  production-adapter boundary is integrated and its follow-up dependency is
  unblocked.
