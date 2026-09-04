---
id: remediate-development-toolchain-advisories
title: Remediate the remaining development-toolchain advisories
status: triaged
type: maintenance
priority: P2
owner: unassigned
source: review
created: 2026-09-03
updated: 2026-09-03
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
