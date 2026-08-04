---
id: automate-browser-and-packaged-electron-tutor-stub-acceptance
title: Automate browser and packaged Electron tutor-stub acceptance
status: review
type: infra
priority: P1
owner: codex
source: review
created: 2026-07-23
updated: 2026-08-05
branch: codex/browser-electron-tutor-acceptance
verification: CI launches the real shared tutor surface with a fake provider in
  both web and packaged Electron hosts and exercises create, turn, reset,
  interrupt, finalize, export provenance, keyboard, text fallback, and
  accessibility contracts.
depends_on:
  - tutor-stub-unified-session-surface
links:
  prs:
    - 481
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

## Log

- 2026-08-05 — Activated in an isolated worktree from current `origin/main`.
  The completed unified-session dependency already records manual/focused web
  and packaged-host smokes; this card turns that contract into one repeatable,
  deterministic parity gate with failure artifacts and named CI commands.
- 2026-08-05 — Implemented one host-neutral scenario in
  `desktop/tutorStubAcceptanceScenario.mjs`, thin web and packaged adapters,
  the deterministic `fixtures/tutor-stub-surface-acceptance/` provider/public
  contract, and `.github/workflows/tutor-stub-surface-acceptance.yml`. Named
  commands are `npm run tutor:stub:acceptance:web` and
  `npm run tutor:stub:acceptance:packaged`; local reproduction and ABI order are
  recorded in `desktop/README.md` and `desktop/ARCHITECTURE.md`.
- 2026-08-05 — The gate also hardened interruption itself: POSIX process-backed
  tutor sessions now own an isolated process group and signal the tutor plus
  its active model-CLI descendants; the expected abandoned HTTP step is
  projected as a bounded `session_interrupted` conflict instead of an internal
  server failure.
- 2026-08-05 — Verification passed with Electron 43.2.0 / Chromium
  150.0.7871.129: 18/18 focused process/contract tests in 2.84s, lint clean,
  web acceptance in 4.632s, and packaged-Electron acceptance in 6.206s. Each
  host created and reconnected an active session, resumed the exact saved trace,
  and observed two fake-provider requests but only one completion: the delayed
  request was in flight before interruption and never completed or entered the
  fresh session. Both exports excluded credential/private-prompt canaries; the
  packaged host additionally proved CSP injection, unauthenticated 401,
  authenticated UI operation, and graceful embedded-server exit. Paid model
  calls: 0.
- 2026-08-05 — Run artifacts live under the ignored
  `.test-tmp/tutor-stub-surface-acceptance/<host>-<timestamp>-<pid>/` directory:
  `result.json`, `public-session.json`, `provider-events.jsonl`,
  `browser-trace.json`, screenshot, and host log. CI uploads that tree only on
  failure. Local verified runs were
  `web-2026-08-04T14-41-48-434Z-75963` and
  `packaged-electron-2026-08-04T14-43-09-807Z-77218`; the apparent date offset
  is UTC artifact naming for the 2026-08-05 Melbourne workday.
