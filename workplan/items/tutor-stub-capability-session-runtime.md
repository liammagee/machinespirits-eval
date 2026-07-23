---
id: tutor-stub-capability-session-runtime
title: Extract a capability-driven tutor-stub session runtime
status: active
type: infra
priority: P1
owner: codex
source: review
created: 2026-07-22
updated: 2026-07-23
verification: An importable session runtime and versioned command/capability
  registry drive lifecycle, help, completion, availability, compatibility
  checks, and trace schemas; two isolated sessions run in one process; golden
  fake-provider traces for passthrough, direct, scaffold, mixed, auto, and
  curriculum modes remain semantically equivalent; focused and hermetic suites
  pass.
depends_on:
  - tutor-stub-register-policy-extraction
links:
  notes:
    - PLAN_4_0/2026-07-11-adaptive-tutor-implementation-plan.md
  items:
    - tutor-stub-register-policy-extraction
    - tutor-stub-human-discourse-layer
tags:
  - tutor-stub
  - super-app
  - runtime
  - command-registry
  - replay
branch: codex/tutor-stub-capability-resolver
---

`scripts/tutor-stub.js` has become a capable application shell, but session
lifecycle, command metadata, capability compatibility, terminal rendering, and
main-process state remain interleaved. Extract a side-effect-free runtime with
explicit create/load/reset/resume/step/finalize contracts, then make the CLI an
adapter over it.

The registry must own each command's aliases, arguments, availability, help,
completion, trace event, and handler exactly once. Capability dependencies and
conflicts must be machine-readable so new surfaces inherit the same behavior
instead of reproducing flag logic. Preserve provider, world, proof, curriculum,
and evaluation adapters rather than forking them.

## Progress

- 2026-07-22: Added the versioned, frozen command-registry foundation and moved
  the CLI's normal, passthrough, scene-return, and static-completion views onto
  it. The slice preserves the existing 38 canonical commands and fixes
  passthrough completion drift; capability snapshots, generated help, command
  dispatch, and the importable session runtime remain to be extracted.
- 2026-07-23: Added a frozen 23-capability registry and resolver with explicit
  available/active states, six resolved session modes, and machine-readable
  compatibility issues. Dry-run and traces now persist the snapshot; command
  dispatch, completion, `/help`, and `/features` consume it so inactive
  mixed-drafting and adaptive-performance controls do not masquerade as usable.
  The importable create/load/reset/resume/step/finalize runtime and handler
  extraction remain the next slice.
