---
id: tutor-stub-headless-session-transport
title: Add a headless transport for tutor-stub sessions
status: done
type: infra
priority: P1
owner: codex
source: review
created: 2026-07-23
updated: 2026-07-23
verification: "A versioned HTTP router drives injected tutor-stub runtimes through create, inspect, list, step, resume, reset, and finalize; two sessions remain isolated, same-session mutations serialize, invalid lifecycle requests return stable errors, and focused plus hermetic suites pass."
branch: codex/tutor-stub-headless-api
depends_on:
  - tutor-stub-capability-session-runtime
links:
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/157
  notes:
    - docs/tutor-stub-cli.md
  items:
    - tutor-stub-capability-session-runtime
    - tutor-stub-unified-session-surface
tags:
  - tutor-stub
  - super-app
  - runtime
  - api
  - electron
milestone: distribution
---

Put an in-process host and versioned Express transport around the importable
session runtime. The transport owns HTTP validation, bounded session residency,
per-session mutation ordering, and lifecycle status codes; the injected factory
continues to own all tutor behavior and presentation-safe state projection.

Do not mount a toy or echo tutor. The shared web stack mounts this router only
when it receives a real or test session host. Extracting and injecting the real
CLI tutor factory is the next integration boundary.

## Progress

- 2026-07-23: Started the transport slice after runtime PR #156 merged green.
- 2026-07-23: Added the bounded multi-session host, per-session mutation queue,
  versioned HTTP lifecycle router, optional shared-surface mount, and stable
  validation/conflict responses. Focused runtime, HTTP, server-route, command,
  capability, and interactive suites pass; the final rebased hermetic run passes 6,384
  tests with one skip after granting its localhost voice tests loopback access.
- 2026-07-23: Opened integration PR #157.
- 2026-07-23: PR #157 merged to `main` with all required checks green.
