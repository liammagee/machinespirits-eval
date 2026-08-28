---
id: codex-default-drift-and-tutor-core-lint
title: "Fix the Codex default-model drift"
status: done
type: maintenance
priority: P3
owner: codex
source: manual
created: 2026-08-27
updated: 2026-08-28
verification: The served catalog derives the Codex default from
  config/providers.yaml, the browser emergency projection has tested parity
  with it, and the focused web-surface and tutor-core seam tests pass offline.
branch: codex/codex-default-model-drift
claim_status: methods
links:
  prs:
    - 841
  notes:
    - services/tutorStubCatalog.js
    - public/tutor/fallbackCatalog.js
    - config/providers.yaml
tags:
  - config
  - codex-default
  - browser-fallback
---

`config/providers.yaml` names `gpt-5.6-luna` as the standing Codex default,
but the served catalog and browser emergency fallback selected
`codex.gpt-5.6-terra` independently.

Acceptance:

- The served catalog resolves the configured Codex `default_model` to its
  public provider alias without naming a preferred model in service code.
- The client-only emergency catalog is an explicit static projection whose
  parity with the server-derived default is covered by an offline test.
- No `tutor-core/` file or dependency direction changes in this slice.

The separate lint and formatting migration is tracked by
`tutor-core-lint-and-format`.

- 2026-08-27 — Split the tutor-core lint migration into its own source card;
  made the served default config-derived; extracted the browser emergency
  projection for parity testing; passed focused tests, lint, format,
  workplan validation, seam guards, and web acceptance offline.
- 2026-08-28 — PR #841 merged with all hosted checks complete and no failed or
  pending checks; the default-model drift slice is closed, while
  `tutor-core-lint-and-format` remains a separate card.
