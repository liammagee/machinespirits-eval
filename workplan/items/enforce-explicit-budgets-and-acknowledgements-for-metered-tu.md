---
id: enforce-explicit-budgets-and-acknowledgements-for-metered-tu
title: Enforce explicit budgets and acknowledgements for metered tutor-stub labs
status: review
type: infra
priority: P1
owner: codex
source: review
created: 2026-07-23
updated: 2026-07-23
verification: Every automated_eval or research_controls launch requires a
  validated finite model-call budget and, for research controls, an explicit
  research-use acknowledgement before any provider or child-process call;
  rejection tests prove zero model calls.
branch: codex/tutor-stub-metered-budgets
links:
  code:
    - services/tutorStubLabs.js
    - services/tutorStubSessionRecipe.js
    - scripts/tutor-stub.js
    - tests/tutorStubLabs.test.js
    - tests/tutorStubLabsRecipeCli.test.js
  notes: docs/tutor-stub-cli.md
---

Implemented fail-closed admission for the metered `automated_eval` and
`research_controls` tutor-stub labs. Both require an explicit finite model-call
budget; research controls additionally require a fresh, non-persisted
research-use acknowledgement. Every direct tutor-stub provider attempt reserves
from the shared launch budget before making the call.

Verification completed 2026-07-23:

- rejection tests prove invalid admission exits before any fake provider child
  process or model request;
- a one-call CLI budget permits exactly one request and rejects the next;
- focused tutor-stub tests pass (65/65), including recipe replay boundaries;
- lint, scoped Prettier, workplan validation (157/157), and workplan tests
  (10/10) pass;
- the full hermetic suite passes with localhost integration tests enabled
  (6,433 passed, 0 failed, 1 skipped).
