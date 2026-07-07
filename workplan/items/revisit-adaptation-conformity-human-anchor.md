---
id: revisit-adaptation-conformity-human-anchor
title: Revisit adaptation-conformity human anchor and artifact availability
status: done
type: research
priority: P3
owner: codex
source: review
created: 2026-06-23
updated: 2026-06-24
verification: "Decision logged: no paper claim changes without recovered
  artifacts and a deliberate human-annotation protocol; current pass only
  records the future gate."
claim_status: future
links:
  notes:
    - notes/2026-06-09-adaptation-conformity-classifier-stage0-preregistration.md
    - notes/daily-notes/2026-06-09-research-roundup.html
  paper: docs/research/paper-full-2.0.md
  scripts:
    - scripts/adaptation-conformity-harvest.py
    - scripts/adaptation-conformity-classifier.py
    - scripts/adaptation-conformity-score-human.py
  items: not-all-flips-are-conformity-decomposing-stance-convergence
tags:
  - human-anchor
  - artifact-recovery
  - conformity
milestone: paper-2-evidence-cleanup
branch: codex/workplan-board-triage
---

The Stage 0 conformity gate is closed in Paper 2.0 as a killed measurement instrument, but the user notes the human comparison was rushed and should not be treated as robust human reliability. The expected `exports/adaptation-conformity-*` artifacts are not present in this checkout. Revisit only as a future artifact/protocol-quality task: recover or link the gate outputs, then decide whether a more deliberate human annotation pass is worth doing before any paper claim changes.

2026-06-24 Codex: Closed as a current-board decision item. The missing adaptation-conformity artifacts and rushed human anchor are documented, but this pass does not change Paper 2.0 claims. Any reopening needs artifact recovery plus a deliberate annotation protocol first.
