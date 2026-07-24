---
id: upgrade-electron-and-rebuild-toolchain-past-audited-advisori
title: Upgrade Electron and rebuild toolchain past audited advisories
status: triaged
type: maintenance
priority: P1
owner: unassigned
source: review
created: 2026-07-24
updated: 2026-07-24
verification: "A clean install reports no high/critical Electron or rebuild-chain advisories, and npm run desktop:test plus npm test pass"
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
