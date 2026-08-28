---
id: outcome-manifest-launch-hold-enforcement
title: "Make the outcome pilot launcher read the sealed launch-hold field"
status: triaged
type: infra
priority: P1
owner: codex
source: manual
created: 2026-08-27
updated: 2026-08-27
verification: The warrant-outcome pilot launcher refuses a sealed manifest whose
  launch_authorized field is not exactly true; a test plants false and the
  launcher must refuse with a clear message; a test plants true and the
  launcher proceeds; no new approval artifact, schema version, or re-signing
  step is added; the change lands only while no run is live.
claim_status: methods
links:
  notes:
    - docs/adaptation-refinement/relay/DEFECT-LEDGER.md
    - scripts/run-adaptive-warrant-outcome-pilot.js
tags:
  - tutor-stub
  - fail-closed
  - codex-sol
  - effort-xhigh
---

Defect 20 in the relay defect ledger, fix column OPEN, guard "none yet":
every sealed outcome manifest carries a launch-hold — `launch_authorized:
false` plus a hold sentence — and the pilot launcher reads neither field. A
manifest sealed with the hold in place launches as readily as one without it.
The incidental cover that used to mask this is gone.

The ledger prescribes the fix: refuse any manifest whose hold field is not
exactly true, with a planted-false test that must refuse. This respects a
hold a person already recorded — the stop-on-indeterminate rail — and adds no
new ceremony: no digest binding, no re-approval, no schema version. Keep it
to that one read.

Constraint from the ledger: do not land this while a run is live.

Suggested worker: Codex Sol at Extra High reasoning effort.
