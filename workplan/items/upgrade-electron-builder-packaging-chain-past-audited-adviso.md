---
id: upgrade-electron-builder-packaging-chain-past-audited-adviso
title: Upgrade electron-builder packaging chain past audited advisories
status: triaged
type: maintenance
priority: P2
owner: unassigned
source: review
created: 2026-07-25
updated: 2026-07-25
verification: A clean full dependency audit reports no high or critical
  advisories through electron-builder, app-builder-lib, @electron/asar, or
  platform packagers, and signed packaged smoke checks pass
---

The Electron 43 / rebuild 4 upgrade removed the Electron runtime, rebuild,
node-gyp, and tar findings from the 2026-07-25 full dependency audit. Nineteen
high findings remain, including the independent `electron-builder` 26.15.3
packaging tree through `app-builder-lib`, `@electron/asar`, platform packagers,
and their glob/minimatch dependencies. Address this separately so packaging
compatibility and signing remain explicit gates.

Origin: `upgrade-electron-and-rebuild-toolchain-past-audited-advisori`.
