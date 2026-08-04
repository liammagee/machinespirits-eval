---
id: decide-rich-learner-memory-service-retention
title: Decide and verify the retained rich learner-memory service
status: done
type: maintenance
priority: P2
owner: codex
source: review
created: 2026-07-22
updated: 2026-08-05
verification: The rich learner-memory service has an explicit supported or
  quarantined status; if supported, hermetic schema and CRUD tests cover its
  public contract and import-time storage is safely relocated.
claim_status: planned
depends_on: []
links:
  notes:
    - MEMORY-ARCHITECTURE.md
    - MEMORY-MECHANISMS.md
  code:
    - services/memory/learnerMemoryService.js
    - scripts/run-rich-memory-arc-experiment.js
    - scripts/smoke-rich-memory-arc.js
    - tests/learnerMemoryService.test.js
    - tests/memoryArchitectureSeam.test.js
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/489
tags:
  - learner-memory
  - architecture
  - sqlite
  - testing
milestone: evaluation-infrastructure
---

The deliberately retained rich learner-memory implementation is a substantial,
learner-specific candidate for a possible future canonical memory shape. It had
opened SQLite at import time without direct contract coverage or a supported
production consumer, so deletion was inappropriate without an architecture
decision while leaving it unverified carried schema and storage-drift risk.

Acceptance:

- Reconfirm the retention decision against the current memory architecture and
  name the supported public boundary or quarantine it from production imports.
- If retained as executable code, add isolated schema, CRUD, decay/retrieval,
  and migration tests using the existing storage override.
- Avoid creating persistent files merely by importing helpers; make lifecycle
  and close behavior explicit.
- Document the deletion/migration gate if another memory shape becomes
  canonical.

## Log

- 2026-08-05 — PR #489 merged as `65e1a6a5`; focused verification and CI
  accepted the quarantine boundary, explicit lifecycle, contract tests, and
  documented tutor–learner symmetry rule. Removed the merged worktree and local
  branch; the remote branch had already been deleted.
- 2026-08-05 — Recorded the tutor–learner symmetry boundary for any future
  promotion: reuse one memory substrate and lifecycle (snapshot, retrieve,
  inject, update, decay, consolidate, provenance), but give learner and tutor
  role-specific schemas and permissions. Learner memory represents knowledge,
  misconceptions, preferences, and learning episodes; tutor memory represents
  learner hypotheses, attempted interventions, observed outcomes, commitments,
  and uncertainty. Do not create a tutor clone of this rich learner store while
  it remains quarantined; revisit a shared engine only if promotion evidence
  makes the richer representation canonical.
- 2026-08-05 — Ready for review with an explicit **quarantined experimental
  reserve** decision. The two documented rich-memory experiment scripts remain
  the only permitted runtime consumers; a static test rejects production
  imports and consumer drift. Importing the module is now filesystem-pure,
  while explicit open/close/status/path APIs own its lazy SQLite lifecycle and
  schema version. Hermetic coverage pins schema, CRUD, persistence,
  due-for-review retrieval, importance decay, incompatible-schema recovery,
  path switching, and both zero-model consumer paths. The work also repaired a
  dormant `datetime("now")` thread-update failure and moved the optional
  Anthropic SDK behind the paid `--real` gate so clean-install dry-runs work.
  Focused tests passed 9/9; the smoke and experiment dry-run passed; lint,
  Prettier, manifest, and the 398/398 source-workplan check passed. No model
  calls were made.
- 2026-08-05 — Activated from `origin/main` after PR #485 housekeeping. The
  bounded decision will preserve the documented experiment consumers while
  removing import-time storage side effects, making lifecycle ownership
  explicit, and adding hermetic contract coverage before assigning final
  supported-versus-quarantined status.
