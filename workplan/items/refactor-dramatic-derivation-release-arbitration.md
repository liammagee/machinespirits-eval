---
id: refactor-dramatic-derivation-release-arbitration
title: Extract dramatic-derivation tutor release arbitration
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-10
updated: 2026-08-10
branch: codex/refactor-dramatic-derivation-release-arbitration
verification: >-
  8/8 direct release assertions, 609/609 focused dramatic/lemma/register
  assertions, 8,304/8,304 hermetic root tests, 137/137 tutor-core tests, and all
  ten risk groups pass. The release owner reaches 94.99% line/88.08% branch/
  94.29% function coverage; every new function is complexity 27 or lower; lint,
  format, manifest, source-workplan, diff, and zero-cycle gates pass.
claim_status: planned
depends_on:
  - refactor-dramatic-derivation-post-turn-lifecycle
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
    - docs/next-steps/2026-08-09-codebase-refactoring-post-run-coordinator-reconciliation.md
  code:
    - services/dramaticDerivation/llmRoles.js
    - services/dramaticDerivation/tutorReleaseArbitration.js
    - tests/dramaticDerivationTutorReleaseArbitration.test.js
    - config/coverage-risk-floors.json
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
    - refactor-dramatic-derivation-post-turn-lifecycle
tags:
  - refactoring
  - dramatic-derivation
  - release
  - llm-roles
milestone: evaluation-infrastructure
---

Continue R5 after PR #622. The engine is no longer a leading hotspot, but the
5,532-line `llmRoles.js` still contains a complexity-502 tutor-turn closure and
its complexity-213 release-arbitration block. Release arbitration is the first
bounded owner because it is a pure decision over the draft plus already-built
turn context and already has strong integration characterization.

Acceptance:

- Introduce one named release-arbitration owner for schedule authority, hidden
  and visible pacing, proof-closing fallback, lemma binding, discursive holds,
  and the immutable release-decision report.
- Keep prompt construction, model calls, retries, superego revision, conduct
  enforcement, public-content tokenization, and engine role-view construction
  in their existing owners.
- Preserve fixed-schedule behavior and every release, release-reason,
  release-decision, lemma, guard, solvency, runtime-monitor, and conduct-policy
  shape byte-for-shape at the integration boundary.
- Decide the formal release once on the draft; later superego revisions must
  continue to restage manner without changing the evidence calendar.
- Reduce `llmRoles.js` materially, keep the extracted owner below 650 lines,
  every new function at complexity 30 or lower, and introduce no import cycle.
- Add direct characterization, ratchet it in the hermetic manifest, and add a
  dedicated risk-coverage group covering the direct and existing guard suites.

Log:

- 2026-08-10 — Activated from current main `7d6433be` after PR #622 and its
  generated-board refresh. Baseline: `llmRoles.js` 5,532 lines; `tutorFn`
  complexity 502; nested release arbitration complexity 213; the complete
  dramatic suite passes 590/590 with 89.57% line and 80.98% branch coverage on
  `llmRoles.js`.
- 2026-08-10 — Completed the release-arbitration extraction. Fixed schedule,
  hidden/visible/hybrid/consolidation guards, proof-closing fallback, lemma
  binding, discursive holds, and release-decision reporting now have one
  579-line owner whose maximum function complexity is 27. `llmRoles.js` fell
  from 5,532 to 5,221 lines; prompt construction, model calls, retries,
  superego revision, conduct enforcement, and public-content tokenization are
  unchanged. All 609 focused assertions, 8,304 root tests, 137 tutor-core
  tests, ten risk groups, and structural gates pass. The initial unpermissioned
  root run exposed loopback `EPERM` plus a pre-existing 10-second passthrough
  timing flake under heavy contention; permissioned bounded shards and the
  isolated passthrough file are fully green.
