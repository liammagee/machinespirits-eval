---
id: report-unclassified-hermetic-test-files-as-actionable-drift
title: Report unclassified hermetic test files as actionable drift, not an
  internal failure
status: review
type: infra
priority: P3
owner: claude
source: manual
created: 2026-07-27
updated: 2026-07-27
verification: >-
  With an unclassified `routes/*.test.js` on disk, `npm run test:manifest`
  prints "Unable to synchronize hermetic test manifest: classified test manifest
  drift; extra: …" before the change and a named remedy after it, checked by
  stashing only the two script edits so the same file is scored both ways; both
  `--check` and `--write` exit 1 and `--write` leaves
  config/hermetic-test-manifest.json byte-identical, so the manifest is never
  written in a state its own validator rejects; a manifest fault that is not
  drift (`version must be 1`) still reaches the top-level handler; the drift
  message text is unchanged, so the pre-existing assertions in
  tests/hermeticTestRunner.test.js and the two `error.message` consumers in
  scripts/run-hermetic-tests.js are unaffected; tests/hermeticTestRunner.test.js
  is 37/37 and tests/evaluationDataCloseout.test.js 2/2 (the only two files
  importing the changed modules); the root suite runs 521 files and 7226 tests
  with 51 failures across 28 files, every one a loopback or PTY bind the local
  sandbox refuses (`listen EPERM … 127.0.0.1`), and re-running those same 28
  files with the change stashed gives the identical 51, so none of them move;
  lint, lint:cycles, format:check, test:manifest, and skills:permissions:check
  all pass.
branch: claude/zealous-heyrovsky-357f4b
links:
  prs: []
  notes: []
  items:
    - hermetic-test-manifest-scanner-must-skip-gitignored-paths-ne
tags:
  - testing
  - ci
  - hermetic
---

## Problem

Carried over from the "Not fixed here" section of
[[hermetic-test-manifest-scanner-must-skip-gitignored-paths-ne]]. A test file
that belongs to no class surfaced through `validateTestManifest` throwing, which
`runManifestSync` caught in its top-level handler:

```
Unable to synchronize hermetic test manifest: classified test manifest drift; extra: routes/zz-manifest-probe.test.js
```

Two things are wrong with that. "Unable to synchronize" is the register of an
internal failure, and the line names no remedy — while the two suite-level drift
classes both end with "Run `npm run test:manifest:update`". So the one drift a
person actually has to think about was the one presented as a crash, and the two
that `--write` repairs unattended were the ones that explained themselves.

## What changed

The drift class is now carried structurally rather than parsed back out of the
message. `assertExactFiles` throws a `TestInventoryDriftError` holding `label`,
`missing`, and `extra` beside the text; `runManifestSync` catches it, and
re-throws anything that is not `classified` drift so a genuinely broken manifest
still reaches the top-level handler.

The message string is byte-identical to before. Matching on prose would have
made the wording load-bearing, and there are existing assertions and two
`error.message` consumers in `scripts/run-hermetic-tests.js` that read it.

`missing` is reported as two kinds, because the remedies differ:

- **Classified, not on disk.** A `fixtureExclusions` entry naming a file that
  has since been deleted. Drop the entry.
- **Classified, but the scan cannot see it.** The file exists, but sits
  somewhere the scan passes over — git-ignored, or under a name in
  `TEST_SCAN_EXCLUDED_DIRECTORIES` such as `vendor/` or `exports/`. Un-ignore or
  move it, or drop the entry. This case became reachable only with the previous
  change, which moved enumeration to `git ls-files`.

`--write` still refuses to write when validation fails, so the manifest is never
left in a state its own validator rejects.

## Evidence

Same unclassified file, scored both ways by stashing only the two script edits:

- Before: `Unable to synchronize hermetic test manifest: classified test
  manifest drift; extra: routes/zz-manifest-probe.test.js`
- After: `Hermetic test manifest does not account for every test file.` plus
  `- on disk, in no class: …` and the "Move each unclassified file into … then
  run `npm run test:manifest:update`" remedy.

`--check` and `--write` both exit 1, and `git diff` on the manifest after
`--write` is empty.

The new test builds its fixture with no git repository, so the filesystem walk
runs rather than `git ls-files`, and exercises all three buckets at once — an
unclassified `routes/` file, a `fixtureExclusions` entry naming a deleted file,
and an entry naming a file that exists under `vendor/`. It also asserts the
negative case: a manifest with `version: 2` is not drift and must keep throwing
past the new catch.

## Log

- 2026-07-27 — Opened and fixed in one pass. Splitting `missing` into absent and
  unscanned was the part worth the effort: both arrive as one list from the same
  set difference, and collapsing them would have printed "drop the entry" at
  someone whose real problem is a file git is ignoring.
