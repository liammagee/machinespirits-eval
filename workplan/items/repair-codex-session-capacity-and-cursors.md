---
id: repair-codex-session-capacity-and-cursors
title: Repair Codex session capacity and stale-cursor semantics
status: done
type: maintenance
priority: P2
owner: codex
source: review
created: 2026-07-22
updated: 2026-07-23
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
branch: codex/repair-codex-session-capacity-and-cursors
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

### Log

- 2026-07-23 — Counted only live processes against capacity, made termination
  idempotent while exit is pending, exposed retained-buffer cursor reset
  metadata, and covered capacity reuse, trimming, races, and expiry. Verified by
  focused route/service tests, repository-wide lint, and the full hermetic suite
  (6,473 pass, 0 fail, 1 skip).
