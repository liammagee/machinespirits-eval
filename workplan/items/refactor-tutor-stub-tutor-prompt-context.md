---
id: refactor-tutor-stub-tutor-prompt-context
title: Refactor tutor-stub tutor prompt context projections
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-27
updated: 2026-07-27
verification: Redacted learner-DAG, human-discourse, and dialogue-closure prompt
  bytes remain exact while focused, hermetic, manifest, static, and source-only
  gates pass.
branch: codex/refactor-tutor-stub-tutor-prompt-context
claim_status: planned
depends_on:
  - refactor-tutor-stub-response-policy-context
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubTutorPromptContext.js
    - scripts/tutor-stub.js
    - tests/tutorStubTutorPromptContext.test.js
    - tests/tutorStubResponsePolicyContext.test.js
    - tests/tutorStubPromptBehavior.test.js
    - tests/tutorStubHumanDiscourseLayer.test.js
    - services/__tests__/tutorStubDialogueClosure.test.js
    - tests/tutorStubAbHarness.test.js
    - tests/tutorStubPromptSizeReport.test.js
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-response-policy-context
tags:
  - refactoring
  - tutor-stub
  - prompt
  - learner-dag
  - human-discourse
  - dialogue-closure
milestone: evaluation-infrastructure
---

Bounded R3 slice: move the adjacent deterministic redacted learner-DAG,
human-discourse scaffold, and dialogue-closure prompt serializers out of the
CLI while retaining their frame construction, state, prompt assembly, model
calls, traces, and terminal effects in their existing owners.

Out of scope:

- Changing learner-DAG grounding, memory reliability, proof debt, generous
  inference, question support, side-arc, clue-release, or closure semantics.
- Moving `buildHumanDiscourseFrame`, `buildTutorLearnerDagForTurn`,
  `buildTutorStubDialogueClosureFrame`, `dagTurnContext`, `callTutor`, final
  prompt assembly, state access, provider calls, model retries, guards, traces,
  or terminal writes.
- Changing prompt labels, line order, whitespace, truncation limits, fallback
  values, or learner-safe/public versus tutor-only/private separation.

Acceptance:

- One dependency-free service owns the three pure tutor-only projections from
  explicit inputs without reading live state or performing effects.
- The CLI retains thin compatibility wrappers and every existing call site.
- Null, redacted-DAG, memory-dropout, full human-scaffold,
  instructional-repair, optional-support, mandatory/available/final-check-in,
  truncation, immutability, and ownership fixtures pin exact behavior.
- Focused/full hermetic and manifest, lint, formatting, cycle, source-only
  workplan, syntax, commit-link, ref-status, and diff gates pass without model
  or API calls.

Log:

- 2026-07-27 — Activated from rendered `origin/main` at `7f313831` after PR
  #309 merged as `0aba11c4` with all ten CI lanes green. Selected only the three
  pure context serializers immediately following the merged response-policy
  projector; runtime and public/private ownership boundaries remain fixed.
- 2026-07-27 — Added a 232-line dependency-free projector and reduced
  `scripts/tutor-stub.js` by 199 net lines. Byte fixtures pin the 874-byte
  redacted learner-DAG context at
  `3e441ff0cc5c3dd05d17c2d287f8d2093337ba56c130da9bbfa79f80822e2838`
  and the 3,659-byte full human-discourse context at
  `a04c05dcf36fd46f6fb6cabb4e1bdcec384f227f46f7af8acf4fca84c78260ce`.
  The widened prompt/closure neighborhood passes 113/113 tests.
- 2026-07-27 — Final parity passes 7,259/7,259 root tests across all 524
  manifest files plus 137/137 tutor-core tests, both with zero skips. The
  synchronized manifest, 237-item source-only workplan, current ref registry,
  ESLint, Prettier, zero-cycle ratchet across 406 files, syntax, and diff gates
  pass. A final fetch confirms the branch base still equals `origin/main` at
  `7f313831`.
- 2026-07-27 — Before handoff, rebased cleanly onto `origin/main` at
  `d6ca5423` after rubric-v3 PR #310. Its manifest/evaluation changes are
  tutor-runtime-disjoint: the prompt/closure neighborhood remains 113/113, and
  the complete hermetic suite passes all 527 selected root files plus 137/137
  tutor-core tests with zero skips. The updated 239-item source-only workplan,
  manifest, refs, formatting, ESLint, and zero-cycle ratchet across 408 files
  are green.
