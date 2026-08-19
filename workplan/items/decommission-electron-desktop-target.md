---
id: decommission-electron-desktop-target
title: Retire the Electron desktop distribution target
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-19
updated: 2026-08-19
verification: Electron, electron-builder, the desktop runtime, and packaged-desktop CI are absent; Scriptorium remains available through the browser; the real-browser tutor and UX acceptance paths run against system Chrome; focused runtime, CI-policy, package, and workplan checks pass.
branch: codex/electron-removal-ci-benchmark
links:
  prs:
    - 690
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
- 2026-08-19: PR #690 merged as
  `4fb8c626222cefc2a592ea975a56287ca9bdaeee`; all PR and post-merge checks
  passed. The representative post-merge runs were CI `32280846120`, browser
  surface `32280846064`, workplan `32280845982`, and validation `32280846095`.
  Their common SHA was the merge commit above. The overall critical path was
  CI at 4m31s; runner queues were 2–3s. Standard-shard execution was Node 22
  shard 1 2m59s, Node 22 shard 2 2m47s, Node 24 shard 1 3m23s, and Node 24
  shard 2 3m24s. Risk coverage took 1m07s, lint 1m40s, workplan 55s, validation
  56s wall-clock, and browser-surface acceptance 1m26s wall-clock (39s
  classifier plus 40s browser job).
- 2026-08-19: The PR #690 comparison runs at head
  `02a13811360a0b0bf530275e4a594bf2c424b970` were CI `32280103788`, browser
  surface `32280104002`, workplan `32280103833`, and validation `32280103917`.
  Their critical path was 3m33s; standard-shard execution was 2m59s, 2m53s,
  3m02s, and 2m53s respectively for Node 22/1, 22/2, 24/1, and 24/2.
- 2026-08-19: Against PR #665's pre-change baseline at
  `95aa5fb85115209d0dd7786b17101a34205cd1cf`—CI `32198762975`, packaged
  surface `32198762883`, workplan `32198762933`, validation `32198762990`—the
  representative end-to-end critical path fell from 7m57s to 4m31s, a 3m26s
  (43%) reduction. The surface lane itself fell from 7m57s to 1m26s, a 6m31s
  (82%) reduction: its observed macOS workflow wait fell from 5m57s to zero and
  execution fell from 1m55s to 40s. The removed Electron-only steps account
  directly for 65s per cached run (install 3s, native rebuild 36s, packaging
  16s, packaged acceptance 10s). The standard CI matrix changed independently
  from 4m35s baseline to 3m33s on the PR and 4m31s post-merge; none of that
  shard variation is attributed to Electron removal.
