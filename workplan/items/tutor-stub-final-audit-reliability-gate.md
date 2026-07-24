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
    - PROGRAM-2-FINAL-AUDIT-RELIABILITY-GATE-AMENDMENT-1.md
    - notes/program-2/2026-07-24-final-audit-reliability-diagnosis.md
  exports:
    - exports/program2-weights-interface-factorial-paid-smoke/launch-state.json
    - exports/program2-weights-interface-factorial-paid-smoke/provenance-audit.json
    - exports/program2-final-audit-reliability-gate/replay-classification.json
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
- 2026-07-24 — Amendment 1 frozen before runtime changes. It fixes the four
  archived trace hashes and classification grammar, limits repair authority to
  common downstream public-state construction, preserves every treatment and
  audit seam, and licenses only a fresh excluded four-cell smoke after the
  zero-model and test gates pass.
- 2026-07-24 — fixed-hash zero-model replay passed 4/4 with zero calls. All
  four cases are fallback-construction defects with an archived public-safe
  clause accepted by the unchanged leak and due-clue multiplicity audits; no
  case was classified as a true unsafe-draft limit or audit/input mismatch.
- 2026-07-24 — the narrow shared constructor repair now passes all four frozen
  cases through the unchanged final-audit bundle with zero model calls.
  Focused tests, derivation quality, prompt/world audits, lint, and workplan
  checks pass. The full hermetic run disclosed two unrelated pre-existing test
  assertions (`tutorStubLastSettings` omits the live `spanInterface` field;
  `tutorStubRoleHistory` no longer crosses its assumed synthetic budget) plus
  restricted-run loopback failures; none is concealed or changed in this
  preregistered slice. The clean-SHA treatment-command comparison and fresh
  excluded four-cell paid smoke remain pending.
