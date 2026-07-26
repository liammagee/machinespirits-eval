---
id: big-picture-state-of-the-nation-skill-and-board-traceability
title: Big-picture state-of-the-nation skill and board traceability
status: review
type: ops
priority: P2
owner: claude
source: manual
created: 2026-07-26
updated: 2026-07-27
verification: >-
  `/ms-big-picture` runs read-only and free (no eval runs, no paid API calls, no
  test suite), reports the fixed six-part shape against live board, git, gh and
  paper-changelog sources, and its R1 check distinguishes a commit with no card
  behind it (governance gap) from a commit whose card exists but never records
  it (traceability gap); the five stale review-lane cards it surfaced are closed
  against their merged PRs; the direct-to-main audit it produced is recorded here.
claim_status: planned
branch: claude/big-picture-skill-and-board-hygiene
links:
  code:
    - .claude/skills/ms-big-picture/SKILL.md
tags:
  - workplan
  - governance
  - skill
---

The programme runs long arcs with many concurrent agents, and during
consolidation phases (QA, refactoring, rubric surgery) the arc is easy to lose
sight of. `/ms-big-picture` is a read-only reassurance instrument: it reports
where the research and the engineering stand, and audits seven rails —
board governance, paper-change deliberateness, closed arcs staying closed,
blocked-means-external, CI freshness, bounded WIP, and the standing
disciplines (rubric versioning, the nemotron/kimi default warning,
renderer-only generated views).

It adds no new machinery that could itself rot: every fact comes from an
instrument the repo already maintains — the board renderer's generated header,
Appendix F of `docs/research/paper-full-2.0.md`, and CI's own PR-to-workplan
link check.

**First live run, 2026-07-27.** Verdict: on rails. 195 of 224 items done, open
working set 22, all five blocked cards blocked on external inputs (IRB, human
coders, user annotation, a killed prerequisite, corpus re-audit). The paper is
stable at v3.0.229 with its last claim-changing entries (§6.19–§6.22) carrying
pre-registration provenance, and two independent claim audits corrected figures
in place — the checking machinery firing is itself the reassurance.

**Direct-to-main audit.** The run flagged twelve non-workplan feature/fix
commits on main's first-parent line between 2026-07-22 and 2026-07-25.
Follow-up established these are a *traceability* gap, not a governance one:
each traces to a real card created the same day
(`tutor-stub-learner-budget-overflow`, `consolidated-labelling-game-harness`,
`tutor-stub-curriculum-mastery-runtime`, `workplan-reflective-tutor-curriculum`,
`refactor-required-run-manifest`, `tutor-stub-fallback-register-and-uptake-guard`),
and `test.yml` triggers on push to main, so all of it ran the full suite. What
they skipped is `wp:pr-link` and `wp:generated-pr-check`, which
`.github/workflows/workplan-validate.yml` gates on `pull_request` events only.

Durable options for closing the gap, in preference order:

1. A `Workplan-item:` commit trailer for direct pushes, plus a push-to-main CI
   step that reads the trailer the way `wp:pr-link` reads the PR body. Keeps the
   fast lane and makes it checkable.
2. Branch protection on `main` requiring PRs. **Trap:** the serialized renderer
   in `.github/workflows/workplan-render-main.yml` pushes `HEAD:main` as
   `github-actions[bot]`; protection without a bypass actor for it stops the
   board publishing.

Neither is implemented here — the choice is the maintainer's.
