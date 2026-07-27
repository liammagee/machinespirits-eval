---
id: rubric-v3-calibration-and-held-out-acceptance
title: Calibrate rubric v3.0 and run held-out acceptance
status: review
type: research
priority: P1
owner: human
source: manual
created: 2026-07-27
updated: 2026-07-27
verification: "N/A aggregation and contextual rejudge identity tests pass; 15-item Claude/Codex development packet analyzed against predeclared gates; thresholds committed before held-out scoring; two independent human coder sheets prepared; held-out and separate instrument reports completed without promoting v3.0 before human acceptance."
branch: codex/rubric-v3-measurement-suite
depends_on:
  - rubric-v3-prospective-measurement-suite
links:
  notes:
    - docs/rubric-v3-measurement-suite.md
  exports:
    - exports/rubric-v3-calibration/development-analysis.json
    - exports/rubric-v3-calibration/2026-07-27-human-labelling/
    - exports/rubric-v3-calibration/held-out-analysis.json
    - exports/rubric-v3-calibration/full-instruments-audit.json
  runs:
    - eval-2026-06-19-78558bf2_rubric-v3.0
    - eval-2026-07-01-5dad2e60_rubric-v3.0
    - eval-2026-03-08-09bd97c5_rubric-v3.0
tags:
  - rubric
  - calibration
  - qa
  - human-labelling
milestone: adaptive-tutor-evidence-v1
---

Calibrate the prospective v3.0 suite without contaminating historical v2.2
scores. Fix explicit N/A handling and exact-generation rejudge identity, use
authored accuracy contrasts to tune the development measurement, freeze gates
before revealing held-out machine scores, and keep promotion dependent on two
independent human coders.

Running log:

- 2026-07-27: Development packet passed all machine gates: applicability 15/15;
  applicable same-item r=.952, MAE=.17, exact agreement 91.7%, within-one 91.7%.
  Thresholds frozen with SHA-256 provenance before held-out scoring. Human
  development and held-out sheets prepared but intentionally remain blank.
- 2026-07-27: Both judges matched all five held-out authored anchors exactly;
  held-out machine gates passed and human gates remain pending. Separate
  trajectory, learner-change, encounter, and deliberation pilots completed on
  three frozen derived runs. Judge reliability was promising, but every
  instrument retained a dominant first factor; dimensional independence is not
  established. Card moved to review with human labelling as the remaining gate.
