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
runs therefore do not inherit the packaged application's native ABI. The
restoration rebuilds `node-pty` through npm's bundled `node-gyp` directly;
`npm rebuild node-pty` also invokes the published package's development-only
TypeScript `prepare` hook, whose compiler is intentionally absent from a
consumer install.

Every executed command, duration, exit code, source SHA, and lane outcome is
written to `.test-tmp/local-ci/<timestamp>/summary.{json,md}`. The directory is
ignored. A failed command stops the run unless `--keep-going` is supplied.

## Faster and offline forms

```bash
npm test
npm run ci:local:quick
npm run ci:local -- --no-install --offline
npm run ci:local -- --lane lint,validation,workplan --no-install
npm run ci:local -- --dry-run
npm run ci:local -- --list
```

`npm test` is the comprehensive fast local code gate: it runs the root files in
one hermetic Node process, then runs the in-housed tutor-core suite. The full
local-CI profile deliberately runs the two root shards sequentially to match
the hosted matrix contract, so it can take longer even though the selected test
coverage is identical.

`quick` omits the root/core suites, PTY/lifecycle lanes, risk coverage, and
surface acceptance. It is a development check, not merge evidence.

`--offline` suppresses only the managed archive/tag fetch. `refs:check` still
runs against the refs already present locally. `--no-install` reuses the
current dependency tree instead of rebuilding it from the lockfile.

For a test-performance profile, retain the hermetic runner's normally temporary
per-file timing and TAP reports under the ignored test-output root:

```bash
npm run test:root -- --quiet --report-dir .test-tmp/hermetic-profile
```

Use a different report directory for each concurrently isolated run. The
production database and dialogue logs remain isolated in a separate temporary
root and are still removed after the run. Node 22 records file wall time plus
aggregate test duration; Node 20 labels its aggregate-duration fallback because
that runtime does not emit a file-scoped completion summary.

To calibrate this machine's root-test worker count without weakening hermetic
selection or file accounting, add a bounded Node concurrency value:

```bash
npm run test:root -- --quiet --test-concurrency=8 \
  --report-dir .test-tmp/hermetic-profile-c8
```

This control applies only to the root Node phase. The routine default should be
changed only from repeated same-checkout profiles; subprocess- and PTY-heavy
tests can make the machine's logical-CPU count an inefficient worker count.

To reproduce the PR-body link locally, save the final body and add:

```bash
npm run ci:local -- --pr-body-file /tmp/pr-body.md
```

## PR creation gate

Use the repository wrapper when a committed feature branch is ready to hand
off:

```bash
npm run pr:create -- --title "Describe the change" --workplan <item-id>
```

The default `auto` policy requires a clean non-main branch synchronized with
`origin/main`, validates the final `Workplan item:` link, and runs quick local
CI before it performs any remote write. It then pushes with normal hooks,
verifies remote SHA parity, and creates a draft PR. If one of this repository's
hosted CI workflows attaches during the bounded wait, the wrapper marks the PR
ready and leaves the expensive matrix to GitHub. If no hosted CI attaches, the
PR remains draft while full local CI runs; only a passing, SHA-matched report is
added to the body before the PR becomes ready.

Useful variants:

```bash
# Keep the admitted PR as a draft.
npm run pr:create -- --title "Describe the change" --workplan <item-id> --draft

# Always run full local CI before the first push.
npm run pr:create -- --title "Describe the change" --workplan <item-id> --ci full

# Use a reviewed body instead of the generated template-derived body.
npm run pr:create -- --title "Describe the change" --workplan <item-id> --body-file /tmp/pr-body.md

# Validate branch, synchronization, and body without CI or remote writes.
npm run pr:create -- --title "Describe the change" --workplan <item-id> --dry-run
```

`--ci quick` deliberately skips both the hosted-check wait and the full local
fallback; use it only when that narrower policy is intentional. `--no-install`
and `--offline` are passed to a required full local gate. A failure after draft
creation leaves the draft URL in the error output rather than presenting an
unadmitted PR as ready.

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
