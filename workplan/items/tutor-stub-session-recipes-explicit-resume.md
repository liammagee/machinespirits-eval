---
id: tutor-stub-session-recipes-explicit-resume
title: Add versioned tutor-stub session recipes and explicit resume
status: review
type: infra
priority: P2
owner: codex
source: review
created: 2026-07-22
updated: 2026-07-23
verification: "A saved recipe relaunch reproduces the resolved configuration hash and fake-provider decision trace; --resume <run-id|trace-path> wins regardless of mtime; world, prompt, tutor, model, and schema drift fail closed unless explicitly acknowledged; old supported traces migrate read-only; transcript HTML exposes a copyable exact relaunch command."
depends_on:
  - tutor-stub-capability-session-runtime
branch: codex/tutor-stub-super-app-slices
links:
  items:
    - tutor-stub-capability-session-runtime
    - adaptive-eval-immutable-provenance
tags:
  - tutor-stub
  - super-app
  - sessions
  - resume
  - provenance
---

`--resume-last` currently chooses by trace-directory recency, while Replay JS
intentionally excludes private harness state. Add a versioned recipe that
captures resolved capabilities, content/tutor/profile identities and hashes,
model routing, presentation-independent settings, trace lineage, and drift
policy. Support `--recipe`, `--write-recipe`, and explicit `--resume` without
weakening public/private replay boundaries.

## Progress

- 2026-07-23: Added a hash-verified v1 recipe, explicit run-id or trace-path
  resume, read-only legacy-trace migration, deterministic option precedence,
  and fail-closed world/prompt/tutor/model/schema drift with an auditable
  acknowledgement override.
- 2026-07-23: Dry-run and trace metadata carry the resolved recipe and lineage;
  transcript HTML exposes the exact credential-free relaunch command. Unit and
  CLI round-trip, explicit-selection, drift, and fake-provider tests pass.
