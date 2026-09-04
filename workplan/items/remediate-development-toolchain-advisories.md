---
id: remediate-development-toolchain-advisories
title: Remediate the remaining development-toolchain advisories
status: review
type: maintenance
priority: P2
owner: codex
source: review
created: 2026-09-03
updated: 2026-09-04
branch: codex/remediate-dev-toolchain-advisories
verification: "A clean full npm audit reports zero high or critical vulnerabilities, or each remaining development-only advisory has a documented upstream constraint and bounded disposition; lint, formatting, tests, and maintained artifact builds remain green."
claim_status: planned
links:
  items:
    - remediate-current-production-dependency-advisories
    - upgrade-eslint-toolchain-past-minimatch-advisories
  notes:
    - package.json
    - package-lock.json
tags:
  - dependencies
  - security
  - tooling
---

After the production advisory remediation, the last successful full audit
still reported four development-only findings in the current tool graph,
including paths through `@humanfs/node`, `brace-expansion`, `nanoid`, and
`postcss`. They do not ship in the production dependency set, whose audit is
clean, but they should not disappear into the aggregate count.

Refresh the full advisory report, map each finding to its direct tool owner,
and prefer compatible targeted upgrades. Do not widen this into a major build
tool migration without first proving which maintained workflows and artifact
surfaces would change. The registry audit endpoint was intermittently
unavailable during the 2026-09-03 review, so re-confirm the exact advisory IDs
and severities before implementation.

## Log

- 2026-09-04: Started on `codex/remediate-dev-toolchain-advisories`; manifest
  changes trigger the full CI, workplan, validation, and real browser tutor
  acceptance lanes, so remediation will remain limited to compatible targeted
  dependency changes.
- 2026-09-04: Mapped the reviewed findings to their direct tool owners:
  `eslint` -> `@humanfs/node` (`GHSA-p498-v437-472g`, medium), `eslint` ->
  `minimatch` -> `brace-expansion` (`GHSA-rgw5-rvv9-x895`, high), and `vitest`
  -> `vite` -> `postcss` (`GHSA-fxqj-rqcc-2cmp`, medium) -> `nanoid`
  (`GHSA-2v37-7h3g-55p8`, high).
- 2026-09-04: Updated only the compatible transitive lock entries to
  `@humanfs/node` 0.16.8, `brace-expansion` 5.0.9, `postcss` 8.5.28, and
  `nanoid` 3.3.18. A clean install passed, and GitHub's reviewed advisory API
  returned no advisory affecting any of those exact versions. The npm audit
  endpoint returned a network timeout on a 20-second bounded request; an
  escalated request configured with a 120-second fetch timeout remained silent
  after 140 seconds and was terminated. This disposition therefore does not
  claim that a fresh full audit found no unknown new advisories.
- 2026-09-04: `lint:all`, workplan source validation, the hermetic-test
  manifest, all 52 structural ratchet tests, tutor-core (150/150), real-browser
  tutor acceptance, and the full paper/atlas/arc build passed. Root shard 1
  passed 5,614 tests with no failures. Shard 2's nine dirty-checkout
  precondition failures disappeared after commit and rebase: the clean branch
  passed 4,662 tests with no failures and nine expected private-artifact skips.
