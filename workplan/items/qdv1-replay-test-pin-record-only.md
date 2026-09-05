---
id: qdv1-replay-test-pin-record-only
title: Record the qd-v1 replay digest in the test instead of enforcing it
status: done
type: infra
priority: P2
owner: claude
source: review
created: 2026-09-04
updated: 2026-09-04
verification: "tests/learnerProfileRecoveryL1.test.js no longer hashes services/tutorStubQuietDetectorV1.js and compares the result with a stored digest. A formatting change to that file leaves the suite green and prints one drift line. lint:all, test:ratchets, wp:source-check and the file's own tests pass."
claim_status: methods
links:
  items:
    - runtime-file-digest-refusals-record-only
---

## What this changes

`runtime-file-digest-refusals-record-only` closed as PR #1019 and listed one
site it chose not to touch, under "A test pin that survives":
`tests/learnerProfileRecoveryL1.test.js` read
`services/tutorStubQuietDetectorV1.js`, hashed it, and asserted the result
equalled the digest written into `config/learner-profile-recovery-l1.json`.
The card left it because the brief said not to delete a test.

This changes the assertion rather than deleting the test.

## Why it had to go

The replay itself stopped enforcing that digest in the same PR.
`validateLearnerProfileRecoveryManifest` calls `recordObservedDigest` for the
quiet detector and the pressure trigger, writes any drift to stderr, and carries
on. The test then asserted the digest matched. So the test was stricter than the
code it covered: the replay was taught to tolerate an edit, and the test was
not.

The pinned file is a frozen historical detector, kept so the L1 recovery replay
reproduces an old run. It is still a `.js` file under `services/`, so it goes
through eslint and prettier in `npm run lint:all`. A prettier bump rewrites it,
the digest moves, and `npm test` turns red with no correct fix available: you
either edit the literal, which pretends the historical bytes changed, or you
revert the formatting and fight the linter. That is the trap the hard rule in
`CLAUDE.md` names.

## What is checked now

`validateLearnerProfileRecoveryManifest` returns the two records it already
built, as `digestRecords`. The addition is additive; the three other fields are
unchanged.

The test asserts the quiet-detector record is present, names the right file, and
carries a well-formed observed digest. It still compares the manifest's recorded
digest with the literal
`318da00fff7fc8049fc21640f2978cc119ff3a45a53a5dd126e3df66656ec6c4`. That is a
comparison of two written-down values, which the closed card's own rule allows,
and it is the check worth keeping: it fails if someone rewrites the manifest to
silence a drift, and it does not fail when the detector is reformatted.

It does not assert `drifted === false`. Asserting a record has not drifted is
the banned shape again.

## The guard that actually protects the detector

The next test in the same file already exercises both detectors:

    detectQdV1(createQdV1State(), line, { pressure: 'neutral' }).type === null
    detectQdV2(createQdV2State(), line, { pressure: 'neutral' }).type === 'flat'

A real edit to qd-v1's classification breaks that. The byte pin only caught
whitespace.

## Mutation proof

Appending a comment line to `services/tutorStubQuietDetectorV1.js` and rerunning
the file: 6 tests pass, and stderr prints

    file digest drift: replay quiet detector services/tutorStubQuietDetectorV1.js
    recorded 318da00fff7f observed c72e72bae8de

Before this change the same edit failed the first assertion. The detector was
reverted after the probe.

## Sweep

A sweep of `tests/` and `services/__tests__/` for the banned shape found no
other case. 132 `createHash('sha256')` calls sit across about 100 test files;
the ones naming a path under `services/`, `scripts/` or `prompts/` are spawn
arguments, source-closure lists, path equality checks, or drift-record lookups.
The two sites this card's parent first listed are already fixed:
`tutorStubResistanceSemanticValidation.test.js` lost its registration pin, and
`tutorStubBoredomSemanticV4InstrumentReadiness.test.js` now pins only the
validation certificate and the held-out corpus, which is what byte pins are for.

## Log

- 2026-09-04: written, changed, probed, merged.
