---
id: repair-codex-session-capacity-and-cursors
title: Repair Codex session capacity and stale-cursor semantics
status: triaged
type: maintenance
priority: P2
owner: unassigned
source: review
created: 2026-07-22
updated: 2026-07-22
verification: Exited sessions no longer consume live capacity, stale output
  cursors receive an explicit reset/truncation signal, and lifecycle tests cover
  capacity reuse, retention cleanup, and polling after buffer trimming.
claim_status: planned
depends_on: []
links:
  code:
    - services/codexSessionService.js
tags:
  - codex-session
  - lifecycle
  - capacity
  - streaming
milestone: evaluation-infrastructure
---

The session service retains exited sessions for inspection, but currently
counts them against the eight-session live limit for the full retention window.
Its polling API also cannot tell a client that the requested cursor predates
trimmed output, so consumers can silently miss text.

Acceptance:

- Count only launchable/running sessions toward live capacity while preserving
  bounded history retention separately.
- Return an explicit stale-cursor/reset marker with the retained buffer start.
- Add lifecycle tests for immediate capacity reuse after exit, retention expiry,
  termination races, and polling across buffer trimming.
