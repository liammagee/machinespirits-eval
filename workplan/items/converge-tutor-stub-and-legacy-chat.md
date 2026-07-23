---
id: converge-tutor-stub-and-legacy-chat
title: Converge tutor-stub and the legacy eval-cell chat
status: active
type: infra
priority: P1
owner: codex
source: manual
created: 2026-07-23
updated: 2026-07-23
verification: "The canonical /tutor shell and one versioned session protocol run both learner-safe tutor-stub labs and an admin-only eval-cell lab; representative cell, curriculum, deliberation, pilot, auth, browser/Electron, provider-call, and compatibility tests pass; /chat, /api/chat, and npm run chat are compatibility facades before old assets are removed."
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
  re-export while turn execution and curriculum loading remain the next domain
  functions to move.
