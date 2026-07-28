---
id: refactor-tutor-stub-curriculum-progress-presentation
title: Refactor tutor-stub curriculum progress presentation
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: Curriculum progress output remains byte-identical while direct,
  keyless live-process, process-session HTTP, focused, hermetic, manifest,
  static, and source-only gates pass.
branch: codex/refactor-tutor-stub-curriculum-progress-presentation
claim_status: planned
depends_on:
  - refactor-tutor-stub-field-report-presentation
links:
  prs:
    - 329
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/curriculum/tutorStubCurriculumProgressPresentation.js
    - services/curriculum/tutorStubCurriculumRuntime.js
    - scripts/tutor-stub.js
    - tests/tutorStubCurriculumProgressPresentation.test.js
    - tests/tutorStubCurriculumRuntime.test.js
    - tests/tutorStubProcessSessionHttp.test.js
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-field-report-presentation
tags:
  - refactoring
  - tutor-stub
  - curriculum
  - presentation
  - terminal
milestone: evaluation-infrastructure
---

Bounded R3 slice: move only deterministic `/progress` terminal-line projection
into a dependency-free curriculum presentation leaf while retaining public
curriculum projection, runtime state and progression, command dispatch,
terminal writes, traces, model behavior, and process-session transport in their
current owners.

Out of scope:

- Changing curriculum progress values, public/private separation, wording,
  colors, markers, ordering, evidence counts, prerequisite display, or newline
  behavior.
- Moving curriculum loading, projection, phase advancement, module selection,
  traces, command handling, model calls, runtime state, or terminal ownership.
- Extracting `/module` or `/next` command handlers before the browser/Electron
  acceptance gate is executable.
- Generalizing unrelated tutor-tuning, scenario, or closeout presentation.

Acceptance:

- A dependency-free projector returns frozen completed and unavailable
  curriculum progress line arrays without mutating its input.
- Direct fixtures pin colors, current/mastered/not-started markers, singular
  and plural evidence counts, prerequisite waits, phase wording, external
  workplan authority guidance, ordering, and blank-line behavior.
- The CLI retains public projection, state, handlers, effects, terminal writes,
  and the established null/progress return contract.
- A keyless AI Foundations session preserves the pre-extraction normalized
  16-line `/progress` report at exactly 1,740 bytes and SHA-256
  `5256a00d8ff9926ab9f94234ba8db7ed09579ef4627d330bab205e005396d894`.
- Process-session HTTP continues to expose only the public projection and the
  same command output without leaking verifier or misconception material.
- Focused/full hermetic, manifest, lint, formatting, cycle, source-only
  workplan, syntax, ref-status, and diff gates pass.

Log:

- 2026-07-28 — Activated from rendered `origin/main` at `e6ba1f86` after PR
  #323 merged with all current CI lanes green. The browser/Electron acceptance
  gate remains triaged, so this slice stays within the remaining pure terminal
  presentation boundary.
- 2026-07-28 — Before production edits, a keyless `AF1` curriculum session
  pinned `/progress` at 16 normalized lines, 1,740 bytes, and SHA-256
  `5256a00d8ff9926ab9f94234ba8db7ed09579ef4627d330bab205e005396d894`.
- 2026-07-28 — A 34-line dependency-free projector and 130-line direct/live
  test reduce `scripts/tutor-stub.js` from 25,156 to 25,135 lines (21 net).
  The same 1,740-byte live hash passes after extraction; 75/75 focused
  curriculum, registry, public-output, and process-session assertions pass.
  Public projection, runtime state, command dispatch, terminal writes, and
  process transport remain in their existing owners.
- 2026-07-28 — Review parity is green: all 7,377 root tests across 536 manifest
  files and 137/137 tutor-core tests pass with zero skips. Manifest, 249-item
  source workplan, refs, lint, formatting, syntax, diff, and the zero-cycle
  ratchet across 415 files also pass. The first full run used an older shared
  dependency tree and failed only three RDF/MCP-dependent assertions; after
  lockfile-exact `npm ci`, those files pass 19/19 and the complete rerun is the
  recorded result.
- 2026-07-28 — Opened PR #329 after a clean rebase onto current `origin/main`.
  Post-rebase parity remains green: 75/75 focused assertions, the 254-item
  source-only workplan check, manifest, lint, formatting, refs, syntax, diff,
  and zero-cycle checks pass; the commit-to-workplan trailer is linked.
- 2026-07-28 — PR #329 merged as `8049a4cf` with all ten CI lanes green; the
  remote feature branch was removed and `origin/main` contains the final head.
