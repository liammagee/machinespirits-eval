---
id: upgrade-eslint-toolchain-past-minimatch-advisories
title: Upgrade ESLint toolchain past minimatch advisories
status: triaged
type: maintenance
priority: P2
owner: unassigned
source: review
created: 2026-07-25
updated: 2026-07-25
verification: A clean full dependency audit reports no high or critical
  advisories through ESLint, minimatch, brace-expansion, glob, or rimraf, and
  repository lint passes
---

The 2026-07-25 full dependency audit retained an independent high-severity
chain from ESLint 9.39.2 through its config packages and minimatch,
brace-expansion, glob, and rimraf. It is unrelated to the Electron runtime and
native rebuild upgrade and needs its own lint-compatibility pass.

Origin: `upgrade-electron-and-rebuild-toolchain-past-audited-advisori`.
