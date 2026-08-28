---
id: codex-default-drift-and-tutor-core-lint
title: "Fix the Codex default-model drift; lint the in-housed tutor-core"
status: triaged
type: maintenance
priority: P3
owner: codex
source: manual
created: 2026-08-27
updated: 2026-08-27
verification: The served catalog and the browser fallback read the Codex
  default from config/providers.yaml instead of hardcoding a model, with a
  test that fails when the two drift; tutor-core/ is linted and formatted
  either by adoption into the repo eslint config or by its own committed
  config, with the lint lane covering its 35 JS files; the one-way dependency
  seam (tutor-core never imports the eval repo) is untouched.
claim_status: methods
links:
  notes:
    - services/tutorStubCatalog.js
    - config/providers.yaml
    - eslint.config.js
tags:
  - config
  - lint
  - codex-sol
  - effort-xhigh
---

Two small drifts with the same shape — a rule stated in one place and
contradicted where it executes:

1. `config/providers.yaml` names `gpt-5.6-luna` as the standing Codex default
   and says so in a comment, but the catalog hardcodes `codex.gpt-5.6-terra`
   as its preferred default (tutorStubCatalog.js:150), and the browser
   fallback list in `public/tutor/app.js` hand-writes the same stale model.
   Both should read the config, with a drift test.
2. The eslint exclusion of `tutor-core/` says the module keeps "its own
   upstream lint rules" — but no lint or format config exists there, so 35
   files answer to nobody. The module was in-housed in May; the upstream
   premise no longer holds. Adopt it into the repo config or give it a real
   config of its own, keeping the re-extraction seam clean.

Suggested worker: Codex Sol at Extra High reasoning effort.
