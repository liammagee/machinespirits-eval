---
id: bump-codex-default-to-gpt-5-6-luna
title: Make GPT-5.6 Luna the default Codex ChatGPT-account model
status: review
type: maintenance
priority: P2
owner: codex
source: manual
created: 2026-08-09
updated: 2026-08-09
branch: codex/bump-codex-default-luna
verification: >-
  Reading the Codex provider configuration and dry-running the generic tutor-stub
  auto-eval, QA-matrix, and ABM-panel launchers selects codex.gpt-5.6-luna for
  every otherwise-unpinned Codex role; explicit model overrides still win;
  frozen experiment pins and historical artifacts remain unchanged; focused
  config, launcher, workplan, lint, and format checks pass.
links:
  code:
    - config/providers.yaml
    - scripts/run-tutor-stub-auto-eval.js
    - scripts/run-tutor-stub-qa-matrix.js
    - scripts/run-tutor-stub-abm-panel.js
    - .codex/skills/ms-tutor-stub-eval/SKILL.md
tags:
  - models
  - codex
  - tutor-stub
---

## Scope

Move new, unpinned Codex ChatGPT-account work from GPT-5.5 to GPT-5.6 Luna.
Keep explicit and frozen model selections intact so historical experiments stay
reproducible. The interactive named tutor retains its separately governed
Terra/Sol/Terra role routing; this card changes the provider fallback and the
generic automated launchers that still default to GPT-5.5.

## Log

- 2026-08-09 — Added at the user's direction before changing the default.
- 2026-08-09 — Changed the Codex provider fallback plus generic tutor-stub
  auto-eval, QA-matrix, and ABM-panel defaults to GPT-5.6 Luna. Updated the
  standing model guidance and tutor-stub skill while retaining interactive
  Terra/Sol/Terra routing and every explicit historical pin. Provider,
  launcher, and warning tests passed (94/94); a zero-model ABM dry run emitted
  Luna for tutor, classifier, learner record, and learner; workplan source,
  lint, and format checks passed.
