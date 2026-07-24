---
id: tutor-stub-final-audit-reliability-gate
title: "Stabilize the shared tutor final-audit fallback path"
status: active
type: infra
priority: P1
owner: codex
source: review
created: 2026-07-24
updated: 2026-07-24
verification: "The four archived weights×interface smoke failure attempts reproduce without model calls and are classified; any repair changes common downstream construction without weakening final audits or treatment seams; focused/full tests pass; and the same excluded four-cell smoke rerun from a fresh root seals 4/4 with no attrition, at most one recovered retry, 11/11 provenance, zero mini resamples, and unchanged treatment commands."
branch: codex/program2-committee-floor-ablation
claim_status: planned
links:
  notes:
    - notes/program-2/2026-07-24-weights-interface-paid-smoke-hold.md
  exports:
    - exports/program2-weights-interface-factorial-paid-smoke/launch-state.json
    - exports/program2-weights-interface-factorial-paid-smoke/provenance-audit.json
  items:
    - program-2-weights-interface-factorial
tags:
  - tutor-stub
  - reliability
  - response-guard
milestone: adaptive-tutor-evidence-v1
---

The preregistered four-cell paid smoke sealed only 3/4 jobs. Three cells used a
retry and `trained_v2` exhausted both attempts. All four counted failures came
from common downstream deterministic final audits after the successor
committee seam; the post-smoke provenance/cue-blind audit passed 11/11 and all
64 committee moments carried a zero-resample enforcement ledger.

This item owns a separate, frozen reliability repair. It may reproduce and fix
shared fallback construction, but it may not weaken audits, inspect semantic
outcomes to select a response, alter the mini prompts or weights, change v1/v2
extraction, or tune against a desired factorial result.

Log:

- 2026-07-24 — activated after the excluded paid smoke ended 3/4 sealed with
  one finalized attrition and four counted downstream final-audit failures.
  The 48-dialogue cohort and paid semantic judging remain on hold.
