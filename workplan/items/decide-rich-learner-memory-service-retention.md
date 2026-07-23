---
id: decide-rich-learner-memory-service-retention
title: Decide and verify the retained rich learner-memory service
status: triaged
type: maintenance
priority: P2
owner: unassigned
source: review
created: 2026-07-22
updated: 2026-07-22
verification: The rich learner-memory service has an explicit supported or
  quarantined status; if supported, hermetic schema and CRUD tests cover its
  public contract and import-time storage is safely relocated.
claim_status: planned
depends_on: []
links:
  notes:
    - MEMORY-ARCHITECTURE.md
  code:
    - services/memory/learnerMemoryService.js
tags:
  - learner-memory
  - architecture
  - sqlite
  - testing
milestone: evaluation-infrastructure
---

The deliberately retained rich learner-memory implementation is about 1,400
lines, opens SQLite at import time, and has no direct test references or live
consumer. Its source comment reserves it for a possible future canonical
memory shape, so deletion is not appropriate without an architecture decision;
leaving the reserve unverified also carries schema and storage drift risk.

Acceptance:

- Reconfirm the retention decision against the current memory architecture and
  name the supported public boundary or quarantine it from production imports.
- If retained as executable code, add isolated schema, CRUD, decay/retrieval,
  and migration tests using the existing storage override.
- Avoid creating persistent files merely by importing helpers; make lifecycle
  and close behavior explicit.
- Document the deletion/migration gate if another memory shape becomes
  canonical.
