---
id: decommission-electron-desktop-target
title: Retire the Electron desktop distribution target
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-19
updated: 2026-08-19
verification: Electron, electron-builder, the desktop runtime, and packaged-desktop CI are absent; Scriptorium remains available through the browser; the real-browser tutor and UX acceptance paths run against system Chrome; focused runtime, CI-policy, package, and workplan checks pass.
branch: codex/decommission-electron
links:
  items:
    - expedite-ci-expensive-boundaries
    - optimize-hermetic-test-suite
    - automate-browser-and-packaged-electron-tutor-stub-acceptance
    - tutor-stub-unified-session-surface
tags:
  - ci
  - electron
  - scriptorium
  - maintenance
  - browser
---

Retire Electron as a supported delivery target because the desktop application
is a shell around the existing Express/browser surface, while its separate
runtime, native ABI, packaging toolchain, and macOS acceptance lane impose an
ongoing cost on unrelated development.

## Acceptance boundary

- Keep the browser-served Scriptorium, `/tutor`, workplan board, and terminal
  adapters as the supported product surfaces.
- Preserve real-browser acceptance by driving installed Chrome without
  downloading a second browser binary during `npm ci`.
- Remove the desktop runtime, isolated desktop dependency lock, packaging
  configuration, desktop-only commands/tests, and packaged-Electron CI path.
- Remove Electron-specific runtime branches and update current developer and CI
  documentation. Historical release notes and completed workplan records remain
  unchanged as records of what previously shipped.
- Do not add a replacement native shell or distribution mechanism in this card.

## Progress

- 2026-08-19: User approved retiring Electron after confirming that it provides
  no core capability beyond packaging the shared browser surface.
- 2026-08-19: Removed the desktop runtime, isolated dependency tree, native
  rebuild helper, packaging configuration, desktop-only tests, commands, and
  macOS packaged-acceptance job. Migrated tutor and Scriptorium real-browser
  checks to `playwright-core` using installed Chrome.
- 2026-08-19: Focused unit/integration tests, manifest synchronization, lint,
  formatting, workplan source validation, the fake-provider Chrome tutor flow,
  and the desktop/mobile Scriptorium home/board smoke all pass. Moved to review
  for hosted CI and PR merge.
