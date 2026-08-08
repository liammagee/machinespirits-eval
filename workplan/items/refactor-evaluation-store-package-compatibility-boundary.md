---
id: refactor-evaluation-store-package-compatibility-boundary
title: Decide and enforce the evaluation-store package compatibility boundary
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-09
updated: 2026-08-09
branch: codex/refactor-evaluation-store-package-compatibility-boundary
verification: >-
  Published-package and host-consumer evidence supports an explicit retain or
  retire decision; package-root, service-subpath, lazy-start, explicit-factory,
  zero-migration-target, boundary-inventory, hermetic, source, lint,
  formatting, manifest, and cycle gates enforce the chosen policy.
claim_status: planned
depends_on:
  - refactor-prompt-lab-store-ownership
links:
  notes:
    - docs/next-steps/2026-08-06-evaluation-store-boundary-inventory.md
  code:
    - index.js
    - README.md
    - scripts/audit-evaluation-store-boundary.js
    - config/evaluation-store-boundary-inventory.json
    - tests/evaluationStoreBoundaryInventory.test.js
  items:
    - codebase-refactoring-program
    - refactor-prompt-lab-store-ownership
tags:
  - refactoring
  - evaluation
  - package-api
  - compatibility
  - dependency-injection
  - lifecycle
  - maintainability
milestone: evaluation-infrastructure
---

Resolve whether the final direct evaluation-store facade consumer—the public
package root—remains legitimate compatibility or should be removed. Base the
decision on the published package, host repositories, current exports, import
effects, and semver consequences rather than consumer count alone.

Acceptance:

- Audit npm publication history, the published root entrypoint, current package
  metadata, repository consumers, and the private host's installed dependency.
- Record a clear retain-or-retire decision and its evidence boundary in the
  canonical evaluation-store boundary note.
- If retained, distinguish the package boundary from migration targets, keep
  the facade lazy and import-safe, document the preferred explicit factory for
  new hosts, and require a major version for removal.
- If retired, provide a deprecation/migration path and preserve package semver;
  do not silently remove the namespace.
- Ratchet application-runtime and operational facade consumers at zero while
  preserving exact named/default exports and package-root/subpath equivalence.
- Do not make model calls, write production evaluation data, publish a package,
  or commit generated workplan views.

Log:

- 2026-08-09 — Activated from reviewed PR #591 head `738977db` because GitHub
  still reported that PR open despite the merge handoff. The audit found six
  public npm releases, the same root `evaluationStore` namespace in published
  `0.3.0`, and `@machinespirits/eval@^0.2.1` installed by the private host. No
  direct external store call was found, but that negative search cannot revoke
  a published API. Decision: retain the lazy namespace, forbid new internal
  consumers, prefer the explicit factory, and reserve removal for a major
  version.
- 2026-08-09 — Enforced the decision in the boundary inventory: 19 tracked
  consumers now resolve to zero migration targets, one retained package
  boundary, four archived one-offs, and 14 compatibility tests. The README and
  package entrypoint direct new hosts to the explicit factory; the package
  contract proves root/subpath identity, lazy import, explicit startup, and the
  preferred factory path. Three focused tests, 8,152 root tests, 137 tutor-core
  tests, all five risk-coverage groups, lint, cycles, manifest, workplan source,
  syntax, formatting, and diff checks pass. No model call, production data
  write, or package publication occurred.
- 2026-08-09 — PR #591 subsequently merged as `dead5be9` and its generated
  view refresh landed as `614fd1c4`; the dependency is now closed. This branch
  is ready to rebase from its reviewed stacked head onto that refreshed main.
