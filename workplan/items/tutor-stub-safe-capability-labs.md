---
id: tutor-stub-safe-capability-labs
title: Curate safe tutor-stub capability labs and compatibility gates
status: review
type: infra
priority: P1
owner: codex
source: review
created: 2026-07-22
updated: 2026-07-23
verification: "Every declarative lab zero-call dry-runs, a representative set completes with the fake provider, invalid combinations fail with actionable guidance, learner-facing labs exclude negative/simulated controls unless explicitly selected as research, generated help stays in sync, and traces record the lab id, maturity tier, resolved capabilities, and cost class."
depends_on:
  - tutor-stub-capability-session-runtime
branch: codex/tutor-stub-super-app-slices
links:
  items:
    - tutor-stub-capability-session-runtime
    - tutor-stub-process-session-factory
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

Transport safety is part of the same registry contract. Classify commands that
open terminal pickers, browsers, voice devices, or relaunch the CLI, and provide
noninteractive result adapters before the process-backed HTTP host exposes
them. Until then that host accepts learner turns but rejects slash commands.

## Progress

- 2026-07-23: Added ten versioned labs with explicit audience, maturity,
  prerequisite, conflict, call-pattern, artifact, cost, and transport-safety
  metadata. Learner-safe projections reject automated learners and negative or
  random controls, while the CLI exposes model-free `--list-labs`, `--lab`, and
  `/lab` discovery.
- 2026-07-23: Representative pure-chat and human-scaffold labs complete through
  the fake-provider runtime; focused catalog, CLI, trace, command-registry, and
  process-host tests pass.
