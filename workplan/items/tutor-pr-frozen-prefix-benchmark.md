---
id: tutor-pr-frozen-prefix-benchmark
title: Add a bounded dual-CLI frozen-prefix benchmark for tutor PRs
status: done
type: infra
priority: P1
owner: codex
source: manual
created: 2026-07-26
updated: 2026-07-26
verification: "The strong zero-call plan pins three currently accepted Nocturne transcript turns across Codex gpt-5.6-terra and Claude Code claude-sonnet-5 at medium effort (six calls maximum); hermetic tests prove frozen-prefix preservation, canonical advisory severity, pass/fail/blocked/budget terminal states, no retries, scoped hook triggering, exact-SHA terminal-report caching, and stdin-preserving composition with the existing pre-push hook; npm run tutor:stub:pr-benchmark -- --print-plan validates the attended PR command."
branch: codex/tutor-pr-benchmark
depends_on:
  - tutor-stub-first-draft-series
links:
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/248
    - https://github.com/liammagee/machinespirits-eval/pull/250
  notes:
    - docs/tutor-pr-benchmark.md
tags:
  - tutor-stub
  - regression
  - cli
  - pr-gate
milestone: adaptive-tutor-evidence-v1
---

Create a cheap PR-time regression lane from the existing frozen first-draft
fixtures rather than rerunning full conversations. Recompile only the current
speaking contract, generate one original tutor candidate per case/model cell,
and apply the current deterministic audits without recovery or continuation.

The default strong matrix is three configuration-diverse turns from one
historical transcript by two authenticated medium-effort CLI models. It is
capped at six calls, has no retry, and ends in one of four explicit states:
pass, fail, blocked, or budget-exhausted. This is engineering evidence only: it
does not reopen the closed first-draft paid campaign, amend rubric v2.2, or
support a human-learning claim.

## Progress

- 2026-07-26: Selected Nocturne answer-seeking, Ravensmark affective resistance,
  and Larkspur premature closure as the strong frozen-turn set; added a
  Larkspur-only two-call smoke preset.
- 2026-07-26: Implemented the bounded runner, deterministic gate, local JSON
  and Markdown reports, hermetic dependency-injected tests, documentation, and
  PR verification prompt.
- 2026-07-26: Closed after the six new tests, the two initially missing-package
  suites, ESLint, static import cycles, manifest synchronization, workplan
  source validation, formatting, diff hygiene, and the zero-call strong plan
  all passed. Live dual-CLI calls remain an attended final-commit PR check.
- 2026-07-26: Added an opt-in local pre-push installer that preserves and runs
  the existing Git LFS hook, scopes the strong gate to tutor-affecting pushed
  paths, caches passes by exact commit, fails closed, and exposes only an
  explicit reasoned bypass for exceptional pushes.
- 2026-07-26: The first real hook run completed all six calls but rejected all
  six, exposing a calibration error: two chosen original drafts were historical
  rejections and the gate had promoted actorial advisory issues to hard. Rebased
  the set on three currently accepted Nocturne turns and restored the canonical
  guard-disposition catalog as the owner of severity.
- 2026-07-26: A second six-call run on the accepted turns again returned 0/6,
  concentrated in writable-entry uptake and terminal-handoff recognition even
  where the generated answer was substantively on-task. Set local enforcement
  to report-only calibration: complete quality failures warn and cache, while
  missing CLI verdicts and unsafe repository state still block.
