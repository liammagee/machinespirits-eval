---
id: local-ci-parity-runner
title: Package the GitHub CI contract as a reproducible local runner
status: review
type: infra
priority: P1
owner: codex
source: manual
created: 2026-08-07
updated: 2026-08-07
branch: codex/local-ci-parity-runner
verification: "One documented npm command reproduces the CI, validation, and workplan lanes locally with fresh-install, reporting, path-gated surface acceptance, and optional isolated Node 20 parity; focused contract tests and the complete local gate pass."
tags:
  - ci
  - developer-experience
  - reliability
---

GitHub Actions can fail before it creates a workflow run, leaving a PR with no
check suite to rerun. Package the repository's data-independent CI contract as
a local command so an outage has an auditable fallback rather than an informal
list of commands.

Acceptance:

- `npm run ci:local` mirrors the Node 22 CI, validation, and workplan commands.
- The runner records command, duration, exit status, source SHA, and selected
  lanes in ignored JSON and Markdown reports.
- A fresh dependency install is the default; explicit offline/no-install modes
  remain available for an already provisioned checkout.
- The packaged Electron acceptance lane runs automatically when the same path
  family as the GitHub workflow changes.
- Optional Node 20 parity runs in a disposable Docker filesystem without
  writing container-owned dependencies into the host checkout.
- Tests fail if the npm entry points or the manual GitHub CI trigger drift.

Log:

- 2026-08-07 — Added the fail-fast/reporting runner, bounded profiles and
  lanes, fresh-install default, path-gated surface checks, manual CI dispatch,
  optional read-only Node 20 Docker lane, and repository documentation.
- 2026-08-07 — Fresh `npm ci` passed. The finalized Node 22 full gate passed
  all eight selected lanes in
  `.test-tmp/local-ci/2026-08-06T21-06-53-616Z/summary.md`, including both root
  shards, tutor-core, PTY/lifecycle, risk coverage, claim/workplan governance,
  and real web plus signed packaged-Electron acceptance. Docker is absent on
  this host, so the isolated Node 20 lane is contract-tested and dry-run
  verified but was not executed locally.
