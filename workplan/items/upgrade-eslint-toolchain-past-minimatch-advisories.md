---
id: upgrade-eslint-toolchain-past-minimatch-advisories
title: Upgrade ESLint toolchain past minimatch advisories
status: review
type: maintenance
priority: P2
owner: codex
source: review
created: 2026-07-25
updated: 2026-07-25
branch: codex/upgrade-eslint-toolchain-past-minimatch-advisories
verification: >-
  A clean full dependency audit reports no high or critical advisory rooted in
  the ESLint toolchain; any remaining minimatch, brace-expansion, glob, or
  rimraf findings are confined to the separately tracked Electron-builder
  packaging chain; repository lint and regression tests pass.
links:
  items:
    - upgrade-electron-builder-packaging-chain-past-audited-adviso
---

The 2026-07-25 full dependency audit retained an independent high-severity
chain from ESLint 9.39.2 through its config packages and minimatch,
brace-expansion, glob, and rimraf. It is unrelated to the Electron runtime and
native rebuild upgrade and needs its own lint-compatibility pass.

Origin: `upgrade-electron-and-rebuild-toolchain-past-audited-advisori`.

2026-07-25 Codex: Upgraded ESLint 9.39.2 to 10.8.0 and `@eslint/js` 9.39.2
to 10.0.1. The clean full audit fell from 19 to 16 high findings and no longer
contains `eslint`, `@eslint/config-array`, or `@eslint/eslintrc`; every remaining
path is rooted in the separately tracked Electron-builder packaging tree.
ESLint 10's new recommended `no-useless-assignment` and
`preserve-caught-error` rules exposed 150 pre-existing findings across unrelated
runtime and research code, so this bounded security upgrade explicitly defers
those rules rather than mixing in semantic refactoring.

Verification: `npm run lint`, `npm run lint:cycles`, `npm run format:check`,
`npm run wp:source-check`, and `npm run test:hermetic` pass. The hermetic run
completed 6,667 root tests and 137 tutor-core tests with no failures or skips.
