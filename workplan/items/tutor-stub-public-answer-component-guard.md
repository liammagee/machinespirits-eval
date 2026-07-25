---
id: tutor-stub-public-answer-component-guard
title: Distinguish public answer components in tutor-stub leak checks
status: review
type: infra
priority: P1
owner: codex
source: manual
created: 2026-07-26
updated: 2026-07-26
verification: >-
  Live and frozen tutor-stub guards allow an already-public component of a
  compound answer name, still reject any actually matched concealed component,
  and pass focused guard/replay tests plus world quality, lint, and formatting.
branch: codex/fix-concealed-answer-guard
links:
  code:
    - services/tutorStubResponseGuard.js
    - services/tutorStubFrozenReplay.js
    - scripts/tutor-stub.js
tags:
  - tutor-stub
  - reliability
  - public-evidence
milestone: evaluation-infrastructure
---

The tutor-stub response guard treated every token in a compound answer name as
concealed, even when one component had already appeared in due public evidence.
That made recovery fail closed after three otherwise public-safe candidates.

Acceptance:

- Share one answer-reference matcher between live and frozen replay paths.
- Permit public components while rejecting any component that is still
  concealed and actually appears in the candidate.
- Report the offending concealed text precisely without exposing other hidden
  answer components.
- Preserve all other response-audit and public-evidence boundaries.

Log:

- 2026-07-26 — Implemented the shared component-aware matcher and Rowan Flat
  regressions. Replayed the reported trace without the false leak finding; 90
  focused tests, all 32 world-quality checks, lint, formatting, and diff checks
  pass on current `origin/main`.
