---
id: warrant-stub-dependency-boundary-rule
title: "Boundary rule: warrant modules must not import tutor-stub files"
status: active
type: infra
priority: P2
owner: claude
source: manual
created: 2026-08-16
updated: 2026-08-16
verification: A stated one-way rule (warrant-gate, action-contract, and
  obligation-ledger modules never import tutor-stub files; tutor-stub may
  import them) is written down, and a test freezes today's violations as
  an allowlist that may only shrink. Any new cross-import fails the test.
  No existing cross-import is removed while the live warrant validation
  line is open, because that line fingerprints these files.
claim_status: planned
links:
  notes:
    - notes/2026-08-16-harness-reconciliation-survey.md
  items:
    - tutor-stub-cell-reconciliation
    - adaptive-warrant-public-obligation-ledger-and-inquiry-termin
  code:
    - services/adaptiveWarrantGateCore.js
    - services/tutorStubWarrantGate.js
tags:
  - tutor-stub
  - warrant-gate
  - harness
  - architecture
branch: design/harness-reconciliation
---

The harness survey found that the warrant layer and the tutor-stub call
each other in both directions: stub files import the warrant gate and
action contracts, and four warrant modules reach back into stub files.
There is no written rule for this boundary, so each change can add more
cross-calls. The tutor-core seam shows the working pattern: a stated
one-way rule plus an enforcing test.

Scope now: write the rule and add a ratchet test that lists the current
back-imports as a frozen allowlist and fails on any new one. The test
adds a file but does not edit any file inside the warrant line's
fingerprinted source closure. Untangling the listed back-imports is the
later extraction step of the staged reconciliation path and waits for
the warrant line to close.

## Log

- 2026-08-16 — Rule written (`docs/warrant-stub-dependency-rule.md`) and
  ratchet test added (`tests/warrantStubDependencyBoundary.test.js`),
  registered in the hermetic test manifest. Only one real back-import
  edge exists: the delivery contract imports two tutor-stub files (guard
  recovery and the performance obligation contract); that pair is the
  whole frozen allowlist. The other three grep matches were comments and
  path strings, not imports. Removal waits for the warrant line to
  close.
