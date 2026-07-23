---
id: complete-tutor-stub-command-effect-metadata-before-http-comm
title: Complete tutor-stub command effect metadata before HTTP command exposure
status: review
type: infra
priority: P2
owner: codex
source: review
created: 2026-07-23
updated: 2026-07-23
verification: Every command declares model-call, file-write,
  persistent-mutation, session-clear, and process-exit effects; registry
  invariants and negative transport tests fail closed for any undeclared or
  disallowed effect.
branch: codex/tutor-stub-command-effects
links:
  code:
    - services/tutorStubCommandRegistry.js
    - tests/tutorStubCommandRegistry.test.js
---

The v2 registry now declares a complete conservative effect profile for all 42
commands and exposes a fail-closed process-HTTP admission check. Missing or
invalid effect metadata, invalid allowlists, missing adapters, unsupported
transports, and unapproved active effects are all rejected before execution.

Progress:

- 2026-07-23: Focused command-registry tests pass (9/9); command registry,
  session runtime, and HTTP tests pass (24/24); lint, formatting, workplan check,
  and the full hermetic suite pass. The first sandboxed hermetic run could not
  bind localhost; the permitted rerun passed.
