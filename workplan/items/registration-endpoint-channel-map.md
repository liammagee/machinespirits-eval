---
id: registration-endpoint-channel-map
title: "Seal registrations with an endpoint-to-channel map; refuse unfielded endpoints"
status: triaged
type: infra
priority: P1
owner: codex
source: manual
created: 2026-08-27
updated: 2026-08-27
verification: A registration carries a machine-readable map from each registered
  endpoint to the run channel that measures it; the run closer refuses to close
  a run whose registered endpoint names a channel the run shape did not field;
  a test plants a registration with an unfielded channel and the closer must
  refuse; existing closed runs are untouched.
claim_status: methods
links:
  notes:
    - docs/adaptation-refinement/relay/DEFECT-LEDGER.md
tags:
  - tutor-stub
  - registration
  - fail-closed
  - codex-sol
  - effort-ultra
---

Defect 27 in the relay defect ledger: a registered primary endpoint (P3) named
a reader channel the run shape did not field, so the run finished with its
primary endpoint unmeasurable. The ledger calls this the fourth instance of
the same class — a registration binds the run only where the code reads it.

The fix direction is stated in the ledger: registrations declare, in a
machine-readable block, which run channel measures each registered endpoint,
and the closer fails closed when an endpoint names a channel that is not
fielded. This is the same rail as the standing rule that fail-closed reports
must gate on registered measures, not just row counts.

This adds no approval ceremony: it checks that the run can measure what the
registration says it measures, at close time, deterministically.

Suggested worker: Codex Sol at Ultra reasoning effort — the map schema is a
small design decision; the enforcement is bounded code plus tests.
