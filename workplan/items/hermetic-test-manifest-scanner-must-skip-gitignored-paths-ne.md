---
id: hermetic-test-manifest-scanner-must-skip-gitignored-paths-ne
title: Skip gitignored paths when scanning for hermetic test-manifest drift
status: review
type: infra
priority: P3
owner: claude
source: manual
created: 2026-07-27
updated: 2026-07-27
verification: >-
  With two nested `.claude/worktrees/<name>/` checkouts on disk, `npm run
  test:manifest` reports 88 KB of false drift before the change and
  "Hermetic test manifest is synchronized." after it; the git and filesystem
  enumerations agree file-for-file on the real repository (533 files each, empty
  symmetric difference) once `.claude/` is removed, so nothing else moved in or
  out of the contract; all three genuine drift classes are still reported —
  unregistered `tests/`, unregistered `tutor-core/services/__tests__/`, and an
  unclassified `routes/` test; two new tests in tests/hermeticTestRunner.test.js
  fail against the unfixed scanner and pass against the fixed one; the full file
  is 36/36, and both root shards plus the core suite run 7362 tests with 5
  failures, each of which reproduces identically on HEAD (two worktree-basename
  assertions, three file loads needing this worktree's symlinked node_modules);
  lint, prettier, refs:check, lint:cycles, and workplan validation pass.
branch: claude/zealous-heyrovsky-357f4b
links:
  prs: []
  notes: []
  items:
    - hermetic-tap-summary-on-forced-exit
tags:
  - testing
  - ci
  - hermetic
---

## Problem

`npm run test:manifest` fails on any checkout that has a nested agent worktree,
reporting every test file inside `.claude/worktrees/<name>/` as unclassified —
88 KB of drift across two nested checkouts here. Those worktrees are created by
this repo's own tooling; `.gitignore:49` (`.claude/*`) covers them and they are
untracked, so CI checks out fresh and never sees the problem.

That confines the damage to local runs, which is what makes it worth fixing
rather than tolerating: the validator is meant to be a pre-push check, and it
cannot be one if it is red for anyone running agents in worktrees. A validator
that is always red trains people to stop reading it.

The defect is narrow. `discoverRootTestFiles` and `discoverCoreTestFiles` read
named directories (`tests/`, `services/__tests__/`) and are unaffected. Only
`discoverAllContractTestFiles` walked the tree from `.`, and it is the one
feeding the `classified` check — "every test file on disk belongs to exactly one
class". Its exclusion list was a hand-maintained denylist of directory names,
and denylists of "what is not really part of the repo" drift by construction.
`eslint.config.js` had already hit the same wall and answered it by adding
`.claude/worktrees/` to its own ignore list.

## What changed

`discoverAllContractTestFiles` now enumerates candidates with
`git ls-files --cached --others --exclude-standard -- '*.test.js'`. Tracked
files *plus* untracked-not-ignored ones: enumerating from the index alone would
have blinded the check to a newly written test file, which is the drift it
exists to catch.

The denylist stays, applied on top. The two mechanisms answer different
questions and both are still needed — git's `--exclude-standard` answers "is
this path part of the checkout", while `TEST_SCAN_EXCLUDED_DIRECTORIES` answers
"is this a checked-in area deliberately outside the contract". `vendor/`,
`data/`, and `exports/` are all tracked here, so dropping the denylist would
have quietly widened the contract.

Three cases needed handling beyond the swap:

- **Not a repository.** The manifest fixtures build synthetic project roots in
  `mktemp` directories. Git enumeration returns null there and the walk runs.
- **Not the repository root.** `git rev-parse --show-toplevel` must resolve to
  `projectRoot` itself. Run from a subdirectory git answers for the enclosing
  repository, and a fixture directory under an ignored path would come back
  empty — a silent pass rather than a failure.
- **Deleted but still indexed.** `--cached` names files removed from the working
  tree. Left in, the git enumeration would disagree with the per-suite
  filesystem discovery and the manifest would be unsatisfiable in both
  directions at once.

The fallback walk was hardened to match, so a host without git does not
reintroduce the defect: `.claude` joins the denylist, and the walk no longer
descends into a directory carrying its own `.git` — a submodule or a
`git worktree add` target parked somewhere the denylist does not name.

## Evidence

The git and filesystem enumerations were compared file-for-file on the real
repository before anything was changed: 533 files each, empty symmetric
difference, once `.claude/` was removed from the walk's output. So the swap is
behaviour-preserving for this repo and the only thing it changes is the defect.

Reproduction, in the parent checkout with two nested worktrees present:

- Before: `classified test manifest drift; extra: …`, 88 KB of paths.
- After: `Hermetic test manifest is synchronized.`

Genuine drift, checked one class at a time in a linked worktree — an
unregistered `tests/*.test.js`, an unregistered
`tutor-core/services/__tests__/*.test.js`, and an unclassified `routes/*.test.js`
— all still reported, with the first two reaching the actionable
"Run `npm run test:manifest:update`" path.

The two new tests fail against the unfixed scanner and pass against the fixed
one, which is the check that matters: a test green both ways would prove
nothing. The git-backed one also covers the deleted-but-indexed case; the
non-git one covers the fallback walk and the nested-`.git` skip.

## Not fixed here

An unclassified file surfaces through `validateTestManifest` throwing, which
`runManifestSync` catches in its top-level handler and prints as "Unable to
synchronize hermetic test manifest: …". That is the wrong register for what is
an ordinary, actionable drift report — the two suite-level classes print a
"Run `npm run test:manifest:update`" line and this one does not. Pre-existing,
untouched, and worth a separate look.

## Log

- 2026-07-27 — Opened and fixed in one pass. The comparison against the real
  repository came first and is what made the swap safe to make: had the two
  enumerations disagreed anywhere but `.claude/`, the right fix would have been
  the narrower denylist entry instead.
