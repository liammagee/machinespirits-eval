---
id: tutor-stub-study-status-skill
title: Add a session-worktree tutor-study status skill
status: done
type: infra
priority: P2
owner: codex
source: manual
created: 2026-08-19
updated: 2026-08-19
verification: Skill validation, discovery and sync checks, source-only workplan validation, and a zero-call fixture invocation from the selected worktree all pass.
branch: codex/tutor-stub-study-status-skill
links:
  code:
    - .codex/skills/ms-tutor-stub-study-status/SKILL.md
    - scripts/report-tutor-stub-study-status.js
  items:
    - tutor-stub-long-running-study-transparency
tags:
  - tutor-stub
  - observability
  - status
  - skill
  - zero-call
milestone: evaluation-infrastructure
---

Add a small Codex skill that resolves the exact tutor-study session worktree
and runs the existing read-only status reporter with that worktree as its
working directory.

Acceptance:

- The skill requires exact worktree and artifact-root resolution and refuses
  ambiguous session matches.
- The reporter runs with the session worktree as `cwd`, including when that
  frozen worktree predates the reporter.
- The skill preserves the zero-call, no-write, no-process, no-recovery boundary
  and relays the structured status in plain language.
- Focused skill, workplan, sync, and fixture checks pass without touching any
  live study.

Out of scope:

- Reporter semantics, study execution, recovery, process inspection, model
  calls, provider routing, package aliases, workflows, or skill mirrors.

Log:

- 2026-08-19 — Started from HTTPS `origin/main` at `83f48b5f` in the dedicated
  `codex/tutor-stub-study-status-skill` worktree. The implementation is a
  Codex-only instruction skill over the existing reporter; no live study is in
  scope.
- 2026-08-19 — Added exact session-worktree and artifact-root resolution,
  ambiguity refusal, cross-worktree reporter execution, provenance reporting,
  and the no-call/no-write/no-process boundary. Skill validation, discovery,
  mirror checks, formatting, 522/522 workplan source validation, diff checks,
  and a cross-worktree six-unit fixture invocation passed; both worktrees
  remained clean outside the two intended source additions.
