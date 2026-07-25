---
id: upgrade-electron-builder-packaging-chain-past-audited-adviso
title: Upgrade electron-builder packaging chain past audited advisories
status: done
type: maintenance
priority: P2
owner: codex
source: review
created: 2026-07-25
updated: 2026-07-25
verification: A clean full dependency audit reports no high or critical
  advisories through electron-builder, app-builder-lib, @electron/asar, or
  platform packagers, and signed packaged smoke checks pass
branch: codex/upgrade-electron-builder-packaging-chain-past-audited-adviso
---

The Electron 43 / rebuild 4 upgrade removed the Electron runtime, rebuild,
node-gyp, and tar findings from the 2026-07-25 full dependency audit. Nineteen
high findings remain, including the independent `electron-builder` 26.15.3
packaging tree through `app-builder-lib`, `@electron/asar`, platform packagers,
and their glob/minimatch dependencies. Address this separately so packaging
compatibility and signing remain explicit gates.

Origin: `upgrade-electron-and-rebuild-toolchain-past-audited-advisori`.

## Log

- 2026-07-25: Upgraded the stable packaging line to `electron-builder` /
  `app-builder-lib` 26.15.7 and pinned the reviewed `@electron/asar` 4.2.1,
  `@electron/universal` 3.0.6, EJS 6.0.1, and `electron-winstaller` 5.4.4
  implementations. Replaced the Windows installer's retired
  `temp -> rimraf -> glob` cleanup path with the private Node-22-compatible
  `vendor/temp-safe` shim, and added lockfile/API ratchets.
- 2026-07-25: Made headless desktop validation credential-free so smoke runs
  never decrypt live provider secrets or block on an OS-keychain prompt.
- 2026-07-25: Verified a standard clean install and a full npm audit with no
  high/critical findings in the packaging chain. The synchronized latest main
  adds two unrelated moderate Hono-adapter findings through the tutor-remote MCP
  dependency. Lint/format/workplan checks, the hermetic root and tutor-core
  suites, 32/32 desktop tests, and 11/11 development smoke checks pass. With no
  currently valid Apple identity in the local keychain, built with identity
  discovery disabled, applied and verified an ad-hoc macOS signature, then
  passed the packaged-app smoke battery 11/11.
