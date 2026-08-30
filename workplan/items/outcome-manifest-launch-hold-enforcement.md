---
id: outcome-manifest-launch-hold-enforcement
title: "Make the outcome pilot launcher read the sealed launch-hold field"
status: dropped
type: infra
priority: P1
owner: codex
source: manual
created: 2026-08-27
updated: 2026-08-27
verification: "Decision recorded: the sealed manifest remains immutable,
  launch_authorized is treated as retired historical metadata, and no new
  manifest gate or reseal path is added; the signed GO note remains the
  authoritative launch decision."
links:
  notes:
    - docs/adaptation-refinement/relay/DEFECT-LEDGER.md
    - docs/paid-study-authorization-policy.md
    - scripts/run-adaptive-warrant-outcome-pilot.js
tags:
  - tutor-stub
  - fail-closed
  - codex-sol
  - effort-xhigh
---

**Dropped 2026-08-27.** The repository's standing paid-study policy makes the
signed GO note authoritative and explicitly retires HOLD packets and
per-manifest approval machinery. Reading `launch_authorized` as another gate
would also require a mutation or reseal path to flip it, recreating the
approval ceremony the policy forbids. The sealed manifests stay unchanged;
their field is historical metadata, not live authority.

The launcher already requires a committed, byte-matching GO note scoped to the
run size, explicit `--accept-charges`, a clean checkout, and a create-once
destination. Those are the live launch rails. Any future study uses the shared
design-file, launch-commit, GO-note, and spend-ceiling policy rather than this
field.

## Historical report

At capture time, defect 20 in the relay defect ledger had fix column OPEN and
guard "none yet":
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
