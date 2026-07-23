---
id: converge-tutor-stub-and-legacy-chat
title: Converge tutor-stub and the legacy eval-cell chat
status: review
type: infra
priority: P1
owner: codex
source: manual
created: 2026-07-23
updated: 2026-07-23
verification: "The canonical /tutor shell and one versioned session protocol run both learner-safe tutor-stub labs and an admin-only eval-cell lab; representative cell, curriculum, deliberation, pilot, auth, browser/Electron, provider-call, and compatibility tests pass; /chat and npm run chat are compatibility facades, /api/chat is administrator-only compatibility, and the old UI assets are removed."
branch: codex/chat-tutor-convergence
links:
  items:
    - tutor-stub-unified-session-surface
    - complete-tutor-stub-command-effect-metadata-before-http-comm
  notes:
    - docs/tutor-stub-cli.md
tags:
  - tutor-stub
  - chat
  - session-runtime
  - migration
  - pilot
  - electron
milestone: distribution
---

Converge on `/tutor` and the tutor-stub session lifecycle without erasing the
legacy chat's useful eval-cell instrument. Tutor-stub remains the authoritative
learner-safe runtime. The legacy ego/superego cell loop becomes a separately
named, administrator-only `cell_lab` engine behind the same session boundary;
the two engines are not treated as prompt-compatible implementations.

## Boundaries

- Keep learner-safe catalogue and public-session projections free of prompts,
  secrets, resolved provider details, evaluation scores, and deliberation.
- Preserve eval-cell semantics and configuration hashes while moving orchestration
  out of `routes/chatRoutes.js` into an adapter-friendly domain service.
- Preserve the participant-safe, metered pilot path until it has a dedicated
  adapter; do not silently redirect its `/api/chat/turn` auth exception.
- Reuse the existing provider/CLI bridge and keep full deliberation available
  only through an explicit research projection.

## Phases

1. Baseline representative single-agent, superego, messages-mode, and id-director
   cells plus catalogue/resolver, curriculum, pilot, and provider-call contracts.
2. Add an explicit engine discriminator to the shared session specification;
   default to `tutor_stub` and reject unimplemented engines.
3. Extract the legacy turn engine and catalogues from the route module, preserving
   compatibility re-exports for pilot autoplay and live composition.
4. Implement an administrator-only `cell_lab` session adapter and research trace
   projection while retaining the learner-safe public projection.
5. Bring the cell resolver, curriculum/persona selection, configuration assistant,
   and deliberation inspector into a research mode of the shared `/tutor` shell.
6. Move pilot and live-composition consumers onto explicit domain adapters, then
   make `/chat`, `/api/chat/*`, and `npm run chat` compatibility facades.
7. Remove the legacy UI and route implementation only after parity, auth, browser,
   Electron, accessibility, and hermetic regression gates pass.

## Progress

- 2026-07-23: Mapped both runtimes and their direct consumers. Began phase 2 in
  `../machinespirits-eval-chat-tutor-convergence` on
  `codex/chat-tutor-convergence`.
- 2026-07-23: Added the fail-closed `engine: tutor_stub` session discriminator
  across the public catalogue, browser launch request, process specification,
  and public snapshot. Unknown engines remain unavailable until their adapter
  exists; focused catalogue and process-backed HTTP tests pass.
- 2026-07-23: Froze a 119-test legacy baseline covering chat catalogues and
  assist, turn routes, curriculum binding, live composition, pilot persistence,
  participant/admin auth, and deliberation projection without paid model calls.
- 2026-07-23: Added `services/legacyChatEngine.js` as the named `cell_lab`
  domain entrypoint, moved pilot autoplay and live composition off direct
  Express-route imports, and locked single-agent, superego, messages-mode, and
  id-director representative profiles as the extraction compatibility matrix.
- 2026-07-23: Extracted prompt lookup into the route-free
  `services/legacyChatPromptLoader.js`; the HTTP route keeps a compatibility
  re-export. Checkpoint `23ee1ec9` is pushed to the convergence branch.
- 2026-07-23: Completed phase 3 extraction: curriculum/course discovery,
  compiled scene loading, and director framing now live in
  `services/legacyChatCurriculum.js`; tutor-turn orchestration plus OpenRouter,
  Claude CLI, and Codex CLI calls now live in
  `services/legacyChatTutorEngine.js`. The Express route imports and
  compatibility-re-exports those domain functions, while the named `cell_lab`
  boundary has no Express dependency. A focused 123-test route, curriculum,
  deliberation, live-compose, pilot, and auth suite passes without paid calls;
  the full hermetic suite passes 6,408 tests with one skip and no failures.
- 2026-07-23: Completed phase 4's server boundary. The shared session host now
  dispatches `engine: cell_lab` to an in-process legacy-cell adapter only for
  administrator or loopback-local requests; participant credentials remain
  denied. Ordinary create/get/list/step responses contain only lifecycle and
  public dialogue, while `GET /api/tutor-stub/sessions/:id/research` provides
  the separate no-store research projection with the preserved configuration
  hash, cell/source architecture, model accounting, and ego/superego trace.
  The learner-safe public catalogue remains tutor-stub-only. The focused
  compatibility slice passes 146 tests; the full hermetic suite passes 6,423
  tests with one skip and no failures.
- 2026-07-23: Completed phase 5 in the shared `/tutor` shell. Learner-safe mode
  remains the checked default and reconnects `cell_lab` sessions through their
  public projection only. Explicit administrator research mode now brings in
  the legacy compatibility catalogues for feature-to-cell resolution, direct
  cell selection, curriculum/drama sources, persona annotations, and the
  deterministic-or-live configuration assistant; all conversations still run
  through the shared session host. A separate inspector fetches and exports the
  private research projection without changing the ordinary public export.
  Adaptive-runner cells are filtered and rejected fail-closed by `cell_lab`.
  Standalone and mounted-poetics browser checks passed with no console warnings;
  focused compatibility coverage passes 149 tests, lint and scoped formatting
  pass, and the full hermetic suite passes 6,464 tests with one skip.
- 2026-07-23: Completed phase 6. The blinded human pilot now owns a dedicated,
  server-authoritative tutor-session adapter and `/api/pilot/session/:id/turn`
  endpoint; participant traffic no longer enters `/api/chat/turn`. Poetics live
  composition uses its own explicit tutor adapter, and `npm run chat` now creates,
  steps, inspects, resets, and finalizes `engine: cell_lab` sessions through the
  versioned tutor-stub API. `/api/chat/*` remains an administrator-only catalogue
  and older-client compatibility facade.
- 2026-07-23: Completed phase 7. Removed the legacy `public/chat/` workbench and
  its UI-only helper tests, reduced `routes/chatRoutes.js` to a thin compatibility
  facade, and made `/chat` plus `/admin/chat` redirect to
  `/tutor?mode=research`. Updated standalone, scriptorium, desktop, accessibility,
  and historical documentation surfaces. Focused integration coverage passes
  151 tests; Electron-ABI desktop parity passes 29 tests; lint and scoped format
  checks pass; live standalone browser checks confirm research-mode redirect,
  safe-mode default, and a clean console; the full hermetic suite passes 6,463
  tests with one skip and no failures. Ready for final diff review and PR prep.
