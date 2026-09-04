---
id: remediate-current-production-dependency-advisories
title: Remediate current production dependency advisories
status: done
type: infra
priority: P1
owner: codex
source: review
created: 2026-09-03
updated: 2026-09-03
branch: codex/end-to-end-audit-20260903
verification: "A clean install succeeds, npm audit --omit=dev reports zero production vulnerabilities, focused server and surface tests pass, and the full CI-selected validation remains green."
claim_status: planned
links:
  prs:
    - 983
  items:
    - migrate-adaptive-dag-runtime-to-langgraph-1-4-without-longit
    - upgrade-eslint-toolchain-past-minimatch-advisories
  notes:
    - package.json
    - package-lock.json
tags:
  - dependencies
  - security
  - ci
---

The current lockfile reports six production advisories: high-severity issues in
`fast-uri` and `ip-address`, moderate issues in `hono`, and a moderate `qs`
issue through Express 4. The first three have compatible patched releases. The
`qs` fix sits beyond Express 4's declared patch range and therefore needs an
explicit compatibility decision instead of an automatic major Express update.

Apply patched versions without widening the application's public API. Prefer a
documented transitive override for `qs` if the current Express test surface
passes; do not take the Express 5 major upgrade in this card.

2026-09-03 Codex: Updated `fast-uri`, `ip-address`, and `hono` to compatible
patched releases and pinned `qs` 6.16.0 through an override while retaining
Express 4. A clean install, the focused server/surface tests, the full hermetic
suite, and all maintained risk-coverage groups pass. `npm audit --omit=dev`
reports zero production vulnerabilities. Implementation is under review in
PR #983.

2026-09-03 Codex: Closed after PR #983 merged as `f99cde85`; its workplan,
browser-surface, validation, lint, risk-coverage, PTY/loopback, and eight Node
22/24 shard checks all passed.
