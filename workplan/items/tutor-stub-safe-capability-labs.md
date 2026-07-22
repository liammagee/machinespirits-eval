---
id: tutor-stub-safe-capability-labs
title: Curate safe tutor-stub capability labs and compatibility gates
status: triaged
type: infra
priority: P1
owner: unassigned
source: review
created: 2026-07-22
updated: 2026-07-22
verification: "Every declarative lab zero-call dry-runs, a representative set completes with the fake provider, invalid combinations fail with actionable guidance, learner-facing labs exclude negative/simulated controls unless explicitly selected as research, generated help stays in sync, and traces record the lab id, maturity tier, resolved capabilities, and cost class."
depends_on:
  - tutor-stub-capability-session-runtime
links:
  items:
    - tutor-stub-capability-session-runtime
    - consolidated-labelling-game-harness
    - tutor-stub-typed-pedagogical-actions
tags:
  - tutor-stub
  - super-app
  - presets
  - safety
  - discoverability
---

Replace free-form flag archaeology with versioned, declarative labs for common
jobs: pure chat, human scaffold, mixed drafting, coaching, feedback and tuning,
voice, curriculum, labelling, automated evaluation, and research controls.

Each lab declares its audience (`learner_safe`, `research`, or `internal`),
prerequisites, conflicts, model calls, expected artifacts, and cost class.
`--lab`, `--list-labs`, and `/lab` resolve through the capability registry.
Frozen evaluation controls remain reproducible, but hostile or simulated
performance modes never enter a learner-facing preset implicitly.
