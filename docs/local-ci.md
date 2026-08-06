# Local CI

`npm run ci:local` is the auditable fallback for GitHub Actions and the
pre-merge confidence gate for unusually sensitive changes. It reproduces the
repository's data-independent CI, validation, and workplan commands without
replacing GitHub's parallel Node matrix.

## Normal use

```bash
npm run ci:local
```

The default `full` profile:

1. installs the locked root dependencies with `npm ci`;
2. checks the hermetic test inventory and skill permissions;
3. refreshes managed refs, then runs ref governance, ESLint, import-cycle, and
   Prettier checks;
4. runs both root shards and tutor-core under the local Node 22 runtime;
5. runs the dedicated PTY/loopback and application-lifecycle lanes;
6. enforces risk-coverage floors;
7. runs content and paper-claim smoke validation;
8. checks workplan source, tests, generated-view exclusion, and commit links;
9. runs web plus packaged-Electron surface acceptance when the changed paths
   match that workflow's trigger family.

The surface lane restores root native modules to the Node ABI before the web
check and as an always-run cleanup after Electron packaging. Repeated local
runs therefore do not inherit the packaged application's native ABI.

Every executed command, duration, exit code, source SHA, and lane outcome is
written to `.test-tmp/local-ci/<timestamp>/summary.{json,md}`. The directory is
ignored. A failed command stops the run unless `--keep-going` is supplied.

## Faster and offline forms

```bash
npm run ci:local:quick
npm run ci:local -- --no-install --offline
npm run ci:local -- --lane lint,validation,workplan --no-install
npm run ci:local -- --dry-run
npm run ci:local -- --list
```

`quick` omits the root/core suites, PTY/lifecycle lanes, risk coverage, and
surface acceptance. It is a development check, not merge evidence.

`--offline` suppresses only the managed archive/tag fetch. `refs:check` still
runs against the refs already present locally. `--no-install` reuses the
current dependency tree instead of rebuilding it from the lockfile.

To reproduce the PR-body link locally, save the final body and add:

```bash
npm run ci:local -- --pr-body-file /tmp/pr-body.md
```

## Node 20 parity

The host uses Node 22. Add GitHub's second runtime through a disposable Docker
filesystem:

```bash
npm run ci:local -- --node20-container
# or only that lane
npm run ci:local:node20
```

The checkout is mounted read-only, copied without `.git`, dependencies, test
reports, or coverage output, and tested inside `node:20-bookworm`. Container
dependencies never become root-owned files in the host checkout. Pulling the
image requires network access the first time.

## Boundaries

- GitHub remains authoritative for hosted Ubuntu/macOS behavior, permissions,
  event payloads, artifacts, and concurrent job scheduling.
- The local runner is sequential so failures and reports are deterministic.
- DB-backed provenance, message-chain, and paper-manifest validators remain
  separate because GitHub deliberately lacks the private evaluation database.
- Paid or model-consuming commands are never part of local CI.
- During an Actions outage, do not merge merely because no check appeared.
  Run the full local profile, retain its ignored report path in the PR body,
  and trigger GitHub CI again after service recovery.
