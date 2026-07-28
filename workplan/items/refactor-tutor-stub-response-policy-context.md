---
id: refactor-tutor-stub-response-policy-context
title: Refactor tutor-stub response-policy context projection
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-27
updated: 2026-07-27
verification: Tutor-only response configuration and policy prompt bytes remain
  exact while focused, hermetic, manifest, static, and source-only gates pass.
branch: codex/refactor-tutor-stub-response-policy-context
claim_status: planned
depends_on:
  - refactor-tutor-stub-response-configuration-presentation
links:
  prs:
    - 309
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubResponsePolicyContext.js
    - scripts/tutor-stub.js
    - tests/tutorStubResponsePolicyContext.test.js
    - tests/tutorStubResponseConfigurationPresentation.test.js
    - tests/tutorStubPromptBehavior.test.js
    - tests/tutorStubTypedActionAdapter.test.js
    - tests/tutorStubResponseComposition.test.js
    - tests/tutorStubInteractivePerformance.test.js
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-response-configuration-presentation
tags:
  - refactoring
  - tutor-stub
  - prompt
  - response-configuration
  - policy-context
milestone: evaluation-infrastructure
---

Bounded R3 slice: move deterministic tutor-only response-configuration and
response-policy prompt serialization out of the CLI while retaining policy
selection, world diction, normalization inputs, model calls, prompt assembly,
state, traces, and terminal effects in their existing owners.

Out of scope:

- Changing response-policy selection, engagement stances, action families,
  audience or lexical controls, actorial parts, temperatures, typed actions,
  guardrails, generous inference, dialogue closure, or clue pacing.
- Moving `callTutor`, final prompt assembly, state access, world loading,
  provider calls, model retries, guards, traces, or terminal writes.
- Changing prompt labels, line ordering, whitespace, fallback values, or the
  separation between learner-safe/public and tutor-only/private context.

Acceptance:

- One pure prompt projector owns configuration normalization, typed-action
  serialization, policy evidence, guardrails, continuous-vector rendering,
  and closure/scaffold overrides from explicit inputs.
- The CLI retains a thin wrapper that resolves the author's world-specific
  ledger term and keeps the existing runtime call site unchanged.
- Null, full, explicit-configuration, policy-label, continuous-blend,
  simulated-only, typed-action, generous-inference, closure, and immutability
  fixtures pin exact prompt bytes.
- Focused/full hermetic and manifest, lint, formatting, cycle, source-only
  workplan, syntax, commit-link, ref-status, and diff gates pass without model
  or API calls.

Log:

- 2026-07-27 — Activated from `origin/main` at `e0e1f58d` after PR #303 merged
  as `254111ba` with all ten CI lanes green. Rebased before workplan edits onto
  `66d0cb7e` after PR #299 added the commit-trailer contract; its workplan-only
  runtime boundary is disjoint. Selected only the deterministic prompt
  projector immediately adjacent to the merged terminal presenter.
- 2026-07-27 — Added a 151-line pure projector and reduced
  `scripts/tutor-stub.js` by 111 net lines. A 6,561-byte full fixture with
  SHA-256 `46df548034fca17c8df538c61bb5ec41169b70819130678cc5891df65838cac1`
  pins typed action, continuous vector, simulated-only guardrails, authored
  ledger diction, generous inference, and mandatory closure. The widened
  response/prompt/typed-action neighborhood initially passed 184/184 tests.
- 2026-07-27 — Initial hermetic parity passed 7,251/7,251 root tests across 523
  files plus 137/137 tutor-core tests, both with zero skips. The first
  restricted run exposed only the documented localhost `EPERM` boundary; the
  permitted loopback rerun is fully green. The synchronized manifest,
  232-item source-only workplan, current ref registry, ESLint, Prettier,
  zero-cycle ratchet across 405 files, syntax, and diff gates pass.
- 2026-07-27 — Before handoff, rebased cleanly onto current `origin/main` at
  `90084e70`; the incoming response-composition coverage remains compatible.
  The widened neighborhood now passes 190/190, and the complete hermetic suite
  passes all 523 selected root files plus 137/137 tutor-core tests. The updated
  236-item source-only workplan, manifest, refs, and cycle gates remain green.
- 2026-07-27 — PR #309 merged the response-policy context child as `0aba11c4`
  after all ten CI lanes passed; the serialized workplan render followed as
  `7f313831`. Closed this child and activated the adjacent tutor-only context
  projection slice on `codex/refactor-tutor-stub-tutor-prompt-context`.
