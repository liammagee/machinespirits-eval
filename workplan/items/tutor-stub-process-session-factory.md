---
id: tutor-stub-process-session-factory
title: Mount the real tutor-stub session factory in the shared server
status: review
type: infra
priority: P1
owner: codex
source: review
created: 2026-07-23
updated: 2026-07-23
verification: "The shared web and Electron stack mounts a lazy process-backed host by default; a fake-model HTTP integration creates a real CLI runtime, completes a learner turn, projects safe state, rejects terminal-only commands, finalizes cleanly, keeps credentials server-side, relocates desktop traces, and passes focused plus hermetic suites."
branch: codex/tutor-stub-session-factory
depends_on:
  - tutor-stub-headless-session-transport
links:
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/158
  notes:
    - docs/tutor-stub-cli.md
  items:
    - tutor-stub-headless-session-transport
    - tutor-stub-safe-capability-labs
    - tutor-stub-unified-session-surface
tags:
  - tutor-stub
  - super-app
  - runtime
  - server
  - electron
milestone: distribution
---

Bridge the existing CLI tutor engine into the versioned headless host without
forking tutoring logic. A private RPC channel controls one real runtime per
session, while provider credentials, traces, and terminal diagnostics stay on
the server side.

Keep this slice deliberately below the visual session surface. Learner turns
and lifecycle operations must be real and testable first; terminal-dependent
slash commands remain blocked until the safe-capability-labs work classifies
and adapts them for noninteractive transports.

## Progress

- 2026-07-23: Started after headless transport PR #157 merged green.
- 2026-07-23: Added the private child-process RPC bridge, real process-session
  factory, default shared-server mount, shutdown cleanup, desktop trace-store
  relocation, allowlisted launch specification, and a fake-model HTTP test that
  proves a learner turn traverses the actual CLI runtime.
- 2026-07-23: Verified normal direct-mode HTTP generation through the real
  analysis, staged-release, and response-guard pipeline; reset and finalize also
  traverse the child runtime. Focused route/runtime/interactive/desktop suites
  pass, lint and format are clean, and the hermetic suite passes 6,390 tests
  with one intentional skip when its localhost voice tests receive loopback
  permission. Plain-Node desktop route/path tests and the packaged Electron
  launch contract pass; the Electron-ABI battery remains isolated to the
  desktop-dev worktree as documented by the repository.
- 2026-07-23: Opened integration PR #158.
