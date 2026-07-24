---
id: automate-browser-and-packaged-electron-tutor-stub-acceptance
title: Automate browser and packaged Electron tutor-stub acceptance
status: triaged
type: infra
priority: P1
owner: unassigned
source: review
created: 2026-07-23
updated: 2026-07-24
verification: CI launches the real shared tutor surface with a fake provider in
  both web and packaged Electron hosts and exercises create, turn, reset,
  interrupt, finalize, export provenance, keyboard, text fallback, and
  accessibility contracts.
depends_on:
  - tutor-stub-unified-session-surface
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  items:
    - codebase-refactoring-program
    - tutor-stub-headless-session-transport
    - tutor-stub-process-session-factory
    - tutor-stub-unified-session-surface
---

Implement this as the executable parity gate required before tutor-stub command
or turn-orchestration extraction.

Scope:

- Exercise the unchanged shared `/tutor` web surface and a packaged Electron
  build, not a second UI implementation.
- Use an injected deterministic fake provider through the real process-backed
  session factory; do not require credentials or paid calls.
- Cover create/resume, learner turn, tutor completion, interrupt, reset,
  finalize, and trace/provenance export in both hosts.
- Cover keyboard-only operation, screen-reader names/status, reduced motion,
  no-colour/text fallback, CSP/auth boundaries, and graceful child shutdown.
- Record browser traces/screenshots and packaged-host logs as CI artifacts on
  failure.

Execution design:

1. Inventory the web server, process-session factory, Electron launch, fake
   provider, writable path, and shutdown entrypoints used by the test.
2. Build one host-neutral acceptance scenario and thin web/Electron adapters;
   do not duplicate assertions between hosts.
3. Add a deterministic fixture for the provider event stream and expected
   learner-safe/public plus research/private projections.
4. Add named CI commands for the web lane and packaged Electron lane, with
   explicit timeouts and teardown assertions.
5. Document local reproduction and the locations of failure artifacts.

Acceptance:

- Both hosts execute the same scenario and match the same stable state/trace
  contract, allowing only explicitly host-specific metadata.
- Terminal-only capabilities remain rejected over HTTP; credentials and
  private prompts never enter browser state or exported learner-safe traces.
- Interruption/reset cannot leak a late tutor result into the next turn.
- Every spawned server, browser, Electron process, and tutor child exits without
  `--test-force-exit`.
- The card records exact test files, commands, host versions, artifacts, and
  runtime before it is marked active or used as an R3 dependency gate.
