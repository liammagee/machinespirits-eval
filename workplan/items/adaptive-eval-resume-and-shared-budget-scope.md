---
id: adaptive-eval-resume-and-shared-budget-scope
title: Adaptive resume and multi-profile budget scope
status: review
type: infra
priority: P1
owner: claude
source: review
created: 2026-08-27
updated: 2026-08-28
verification: Offline runner tests resume an interrupted adaptive run under its
  existing run id and unchanged ceiling, execute only missing planned units,
  rehydrate pending/settled budget exposure, and prove one multi-profile CLI
  invocation cannot multiply a single --max-cost value across profiles.
claim_status: methods
links:
  items:
    - budget-tracker-balance-probe-and-rates
tags:
  - adaptive-tutor
  - spend-ceiling
  - resume
depends_on:
  - budget-tracker-balance-probe-and-rates
---

The generic `eval-cli resume` path currently reconstructs standard suggestion
evaluations only. Add an adaptive dispatch using exact planned scenario/attempt
metadata, the original run id, the unchanged ceiling, and missing-only
execution. Separately make command-level budget scope explicit: either share
one invocation ledger across adaptive profiles or reject an ambiguous
multi-profile `--max-cost` request. Do not describe ledger reopen alone as a
working adaptive resume.

- 2026-08-28 — Landed. `runAdaptiveEvaluation` now records the planned units
  (scenario id, repetition index, unit id), `runsPerConfig`, and `dryRun` on the
  run, and `resumeAdaptiveEvaluation` replays only the planned units that never
  produced a row, under the original run id. Plan resolution and the execution
  loop are shared by both entry points, so a resume cannot drift onto different
  policy. Budget scope is per run because the ledger is keyed by run id, so the
  `run` command now refuses one `--max-cost` across several adaptive profiles
  before any run is created, naming the exposure the old behaviour allowed.
  Tests: `tests/adaptiveResumeAndBudgetScope.test.js` (offline; mock backend for
  the resume plan, injected throwing transport for the two budget cases).
