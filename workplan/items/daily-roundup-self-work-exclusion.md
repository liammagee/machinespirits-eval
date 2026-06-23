---
id: daily-roundup-self-work-exclusion
title: Exclude own papers from daily research roundup captures
status: done
type: infra
priority: P2
owner: codex
source: review
created: 2026-06-23
updated: 2026-06-23
verification: scripts/workplan.js ingest --daily skips arXiv 2603.10450 via a regression fixture; npm run wp:test and npm run wp:check pass.
links:
  notes:
    - notes/research-plans/2026-06-20-research-plan.html
    - notes/daily-notes/2026-06-15-research-roundup.html
  items: geist-in-the-machine-simulating-recognition-and-inner-dialog
  arxiv: https://arxiv.org/abs/2603.10450
tags:
  - daily-routine
  - self-citation
  - workplan-ingest
branch: codex/geist-positioning
---

The Geist positioning card confirmed that arXiv 2603.10450 is Liam Magee's own paper, not an external validation target. The remaining issue is upstream hygiene: the daily roundup should not present own or companion papers as external unblockers.

Decide whether the exclusion belongs in the roundup prompt, a documented convention, or `scripts/workplan.js ingest --daily`; then add a cheap check using 2603.10450 as the regression fixture.

2026-06-23 Codex: Added a documented self-work rule to `notes/daily-notes/README.md`, added an ingest-time exclusion for known self-work IDs plus Liam Magee / Machine Spirits author-project patterns, and covered arXiv 2603.10450 with a hermetic `ingest --daily` fixture.
