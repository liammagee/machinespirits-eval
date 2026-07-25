---
id: upgrade-electron-and-rebuild-toolchain-past-audited-advisori
title: Upgrade Electron and rebuild toolchain past audited advisories
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-24
updated: 2026-07-25
verification: A clean install reports no high/critical Electron or rebuild-chain
  advisories, and npm run desktop:test plus npm test pass
branch: codex/upgrade-electron-rebuild-toolchain
---

The 0.6.0 production dependency audit is clean, but the full 2026-07-24 audit
still reports Electron 33 advisories and a critical `tar` chain beneath
`@electron/rebuild`. npm's fix requires breaking upgrades to Electron 43 and
`@electron/rebuild` 4, so this needs its own compatibility and packaging pass.

## Acceptance criteria

- Upgrade Electron and the native rebuild chain to supported, mutually
  compatible versions.
- Rebuild native modules and verify desktop development and packaged launches.
- Run the desktop security, route-parity, and full hermetic test suites.
- Re-run the full dependency audit and record any unrelated residual debt
  separately.

## Log

- 2026-07-24: captured during the 0.6.0 release audit; production dependencies
  were remediated independently without forcing these breaking dev upgrades.
- 2026-07-25: upgraded Electron 33.4.11 to 43.2.0 and `@electron/rebuild`
  3.7.2 to 4.2.0. Electron 43's Node 24 ABI also required
  `better-sqlite3` 12.11.1; the established `node-pty` 1.0.0 behavior is
  retained with its compatible `nan` 2.28.0 dependency.
- 2026-07-25: clean install, full hermetic tests, 29/29 desktop security and
  route-parity tests, native rebuild, 11/11 development smoke, signed package,
  and 11/11 packaged-app smoke all passed on the synchronized branch.
- 2026-07-25: the full audit improved from 25 high plus 1 critical finding to
  19 high and 0 critical. No finding remains against Electron,
  `@electron/rebuild`, `node-gyp`, or `tar`; the independent
  `electron-builder` packaging and ESLint/minimatch chains are tracked by
  `upgrade-electron-builder-packaging-chain-past-audited-adviso` and
  `upgrade-eslint-toolchain-past-minimatch-advisories`.
