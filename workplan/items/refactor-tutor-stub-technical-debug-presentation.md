---
id: refactor-tutor-stub-technical-debug-presentation
title: Refactor tutor-stub technical debug presentation
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-27
updated: 2026-07-28
verification: Technical /debug output remains byte-identical while dense,
  sparse, seeded live-process, focused, hermetic, manifest, static, and
  source-only gates pass.
branch: codex/refactor-tutor-stub-technical-debug-presentation
claim_status: planned
depends_on:
  - refactor-tutor-stub-technical-analysis-projection
links:
  prs:
    - 319
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubTechnicalDebugPresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubTechnicalDebugPresentation.test.js
    - tests/tutorStubExplanatoryDebug.test.js
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-explanatory-debug
    - refactor-tutor-stub-technical-analysis-projection
tags:
  - refactoring
  - tutor-stub
  - presentation
  - debug
  - terminal
milestone: evaluation-infrastructure
---

Bounded R3 slice: move the deterministic operator-facing `/debug technical`
line projection out of the CLI while retaining debug gating, concurrent
terminal wrapping, normalization, policy and field preparation, trace
persistence, and terminal writes in their existing owner.

Out of scope:

- Changing explanatory-debug frames, prompts, prose cleaning, fallbacks, model
  selection, model calls, or concise prose output.
- Changing classifier, learner-DAG, register policy, field, release pacing,
  response configuration, or trace data.
- Moving command dispatch, state/default owners, debug enablement, terminal
  concurrency, trace persistence, or any other effect.
- Changing labels, ordering, omissions, numeric rounding, 220-character
  truncation, fallbacks, whitespace, or ANSI bytes.

Acceptance:

- One deterministic presentation service projects the complete technical
  debug block from explicit prepared inputs and returns frozen lines.
- The CLI retains debug gating, concurrent-terminal wrapping, normalized
  register state, policy calculation, field construction, trace metadata,
  runtime fallbacks, terminal writes, and the boolean result contract.
- Empty, dense, sparse, field/DAG calculation, dynamical policy, initial/held/
  changed register, overlay, random-performance, release-pacing, immutability,
  and exact terminal-byte branches have direct fixtures.
- A seeded fake-provider completed turn has the same normalized output bytes
  and hash on pre-extraction PR #317 and this branch without external model or
  API calls.
- Focused/full hermetic, manifest, lint, formatting, cycle, source-only
  workplan, syntax, ref-status, and diff gates pass.

Log:

- 2026-07-27 — Activated from rendered `origin/main` at `b6b56e49` after PR
  #317 merged as `3258a19a` with all ten CI lanes green. Selected only the
  deterministic line renderer inside `printExplanatoryDebugTechnical`; debug
  gating, concurrent-terminal behavior, preparation, traces, and effects
  remain CLI-owned.
- 2026-07-27 — The seeded no-classifier Marrick fixture is byte-identical to
  pre-extraction PR #317 after normalizing the generated turn identifier:
  1,316 bytes and SHA-256
  `5f5d63300c55e4402bfc1a8f9ac7aa911655151757612d7f2ba3de16985eac6d`.
- 2026-07-27 — The slice adds a 261-line dependency-free projector and a
  246-line direct test while reducing the CLI by 159 net lines. It reached
  review on its activation base with 30/30 focused assertions, 7,326/7,326
  root tests across all 531 manifest files, and 137/137 tutor-core tests, all
  with zero failures or skips. The 244-item source workplan, manifest, refs,
  lint, formatting, syntax, diff, and zero-cycle ratchet across 411 files are
  green.
- 2026-07-27 — Rebased without conflict onto rendered `origin/main` at
  `1fb7fe9f` after runtime-disjoint PR #318. Final-base parity/focused checks
  remain 30/30 and tutor-core remains 137/137; all static gates remain green.
  The exact base passed all ten GitHub CI lanes. On the concurrently loaded
  local host, monolithic and bounded root reruns report all 531 files but hit
  existing fixed-wall-clock subprocess deadlines; the implicated chat-assist
  and voice files pass independently at 4/4 and 2/2. PR CI therefore remains
  the final full-root certification for this base rather than misreporting the
  loaded-host run as green.
- 2026-07-28 — Opened PR #319 from the clean, parity-pinned review branch;
  PR CI is the final full-root certification on the rebased commit.
- 2026-07-28 — PR #319 merged as `a4925f7a` with all ten CI lanes green; the
  serialized workplan render followed as `e3d66045`. Closed this child and
  activated `refactor-tutor-stub-closeout-report-presentation` for the next
  deterministic terminal renderer.
