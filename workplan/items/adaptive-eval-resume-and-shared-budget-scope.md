---
id: adaptive-eval-resume-and-shared-budget-scope
title: Adaptive resume and multi-profile budget scope
status: triaged
type: infra
priority: P1
owner: unassigned
source: review
created: 2026-08-27
updated: 2026-08-27
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
