---
id: tutor-stub-resume-handoff
title: Give resumed tutor-stub sessions a dialogue handoff
status: review
type: infra
priority: P1
owner: codex
source: manual
created: 2026-07-26
updated: 2026-07-26
verification: >-
  Unit, interactive CLI, and process-session HTTP regressions prove a resumed
  dialogue publicly recaps its question and last learner contribution, reprises
  the last tutor question or point, informs the next turn, and does not advance
  completed turns, proof state, DAG state, or evidence release.
branch: codex/proper-tutor-resumption
depends_on:
  - tutor-stub-session-recipes-explicit-resume
links:
  items:
    - tutor-stub-session-recipes-explicit-resume
    - tutor-stub-resume-last-recipe
  code:
    - services/tutorStubResumeHandoff.js
    - scripts/tutor-stub.js
tags:
  - tutor-stub
  - resume
  - dialogue
  - session-runtime
milestone: evaluation-infrastructure
---

Resuming restored the saved recipe and transcript but returned directly to the
learner prompt. Add a public tutor handoff that makes the restored dialogue feel
continuous without rebuilding or mutating the proof machinery.

Acceptance:

- Recap the public world question and the learner's latest public contribution.
- Repeat the last tutor question, or the last tutor point when no question was
  left open.
- Put the handoff in public conversation history so the next response sees it.
- Keep completed turn count, proof/DAG state, evidence release, and safety
  boundaries unchanged.
- Expose the same handoff through interactive and process-session surfaces.
- Avoid an additional model call during resume.

Log:

- 2026-07-26 — Implemented a bounded public-only resume handoff and trace/schema
  record. Focused affected suites passed 109/109; the full hermetic suite,
  tutor-core 137/137, ESLint, Prettier, manifest synchronization, and diff
  checks passed.
