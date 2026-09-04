---
id: runtime-file-digest-refusals-record-only
title: Record file digests at run time instead of refusing on drift
status: active
type: infra
priority: P1
owner: claude
source: review
created: 2026-09-04
updated: 2026-09-04
verification: "No service under services/tutorStub*.js throws on a drifted digest of a code, schema, prompt, design, registration or go-request file. Each such site records the observed and recorded digests. Sealed corpus and certificate pins are unchanged. lint:all, test:ratchets and the hermetic suite pass."
claim_status: planned
links:
  items:
    - in-place-edits-numbered-file-ratchet
---

## What this changes

PR #994 took the file-digest pins out of the tests. The same pattern still ran
inside `services/tutorStub*.js`: code read a file, hashed it, and threw (or
pushed a blocking issue) when the digest did not match a value stored in code
or in a registration. A one-line bug fix in a judge or a schema then read as a
design change, which is what the two hard rules in `CLAUDE.md` ban.

Each such site now records the observed and the recorded digest and carries on.
New helper: `services/recordedFileDigest.js`.

## Inventory

Every row is a site in `services/` that read a file at run time and compared the
digest with a stored value. "Converted" means the refusal is gone and the site
now calls `recordFileDigest` and puts the record on the object the function
already returns, in `digestRecords`. Line numbers are as of this branch.

| File | Line | File hashed at run time | Outcome |
| --- | --- | --- | --- |
| `tutorStubBoredomActionRegisterProofDagPreflight.js` | 1285 | v3 semantic adjudicator module named by the registration | converted |
| `tutorStubBoredomSemanticValidation.js` | 165-176 | every source-closure entry whose path is not sealed | converted |
| `tutorStubBoredomSemanticValidation.js` | 99 | frozen held-out corpus | kept refusing (sealed data) |
| `tutorStubResistanceActionRegisterExecution.js` | 134 | crossed V2 registration named by the prefix bundle | converted |
| `tutorStubResistanceActionRegisterManipulationValidation.js` | 59-66 | base registration, fidelity instrument registration, contrast repair audit note | converted |
| `tutorStubResistanceActionRegisterStudy.js` | 1123 | v10 base registration | converted |
| `tutorStubResistanceAxisDiscriminationPreflight.js` | 82 | axis study registration | converted |
| `tutorStubResistanceConfirmationSemanticRuntime.js` | 72 | confirmation outcome instrument registration | converted |
| `tutorStubResistanceRecoverySemanticValidation.js` | 347 | outcome semantic instrument registration | converted |
| `tutorStubResistanceRecoverySemanticValidation.js` | 439, 445 | validation and instrument registrations named by the contract | converted |
| `tutorStubResistanceRecoverySemanticValidationRuntime.js` | 74, 80 | validation and instrument registrations named by the v3 go request | converted |
| `tutorStubResistanceRecoverySemanticValidationV3.js` | 53-57 | v3 ensemble implementation, seat implementation, seat response schema | converted |
| `tutorStubResistanceRecoverySemanticValidationV3.js` | 155 | v3 outcome instrument registration | converted |
| `tutorStubResistanceRecoverySemanticValidationV5.js` | 114 | v5 adjudication instrument registration | converted |
| `tutorStubResistanceRecoverySemanticValidationV6.js` | 117 | v6 adjudication instrument registration | converted |
| `tutorStubResistanceRecoverySemanticValidationV7.js` | 117 | v7 adjudication instrument registration | converted |
| `tutorStubResistanceRecoverySemanticValidationV8.js` | 124 | v8 adjudication instrument registration | converted |
| `tutorStubResistanceSemanticRuntime.js` | 537 | semantic registration named by the result | converted |
| `tutorStubResistanceSemanticTraceAudit.js` | 74 | semantic registration named by the trace events | converted |
| `tutorStubResistanceSemanticValidation.js` | 351 | semantic instrument registration | converted |
| `tutorStubResistanceSemanticValidation.js` | 437, 443 | validation and instrument registrations named by the contract | converted |
| `tutorStubResistanceSemanticValidationV2.js` | 203-214 | v1 validation registration, v1 instrument registration | converted |
| `tutorStubResistanceSemanticValidationV2.js` | 216-222 | v2 instrument registration, adjudicator implementation, response schema | converted |
| `tutorStubResistanceSemanticValidationV2.js` | 532, 538 | v2 endpoint validation and instrument registrations | converted |
| `tutorStubResistanceSemanticValidationV3.js` | 311-332 | v1 and v2 validation and instrument registrations | converted |
| `tutorStubResistanceSemanticValidationV3.js` | 334-340 | v3 instrument registration, adjudicator implementation, response schema | converted |
| `tutorStubResistanceSemanticValidationV3.js` | 663, 669 | v3 endpoint validation and instrument registrations | converted |
| `tutorStubResistanceSemanticValidationV4.js` | 68-78 | v4 instrument registration, ensemble and seat implementations, response schema, scoring implementation | converted |
| `tutorStubResistanceSplitMeasurementValidationRuntime.js` | 223, 229 | validation and instrument registrations named by the v3 go request | converted |
| `tutorStubResistanceSplitMeasurementValidationRuntime.js` | 281, 287 | split-measurement instrument and stage validation registrations | converted |
| `tutorStubResistanceWarmNonwarmConfirmation.js` | 50-56 | trigger instrument, outcome and fidelity instrument | converted |
| `tutorStubResistantProfileRouteCanary.js` | 115-126 | every source-closure entry whose path is not sealed | converted |

Both source-closure loops keep a refusal for sealed entries. A module constant
`SEALED_SOURCE_CLOSURE_PATH` matches `heldout`, `held-out`, `development-corpus`,
`blind-read` and `certificate`; an entry whose path matches still asserts. No
closure names a sealed file today, so the guard says what happens if one is
added.

The contrast repair audit note is the one call the first version of this card
flagged as arguable. It kept its pin; a follow-up converted it. The pin cannot
stop anyone editing `notes/2026-08-22-v10-plain-warm-contrast-zero-call-audit.md`.
All it does is make a paid validation run refuse to start after the edit. The
note is in git, so what was measured is already durable, and any change to it
shows in the diff. A held-out corpus is pinned because the science depends on
nobody reading or altering it before the run. This note writes up a run that
already finished, and nothing downstream reads it as data.

Tests that expected a throw now assert the record: the call returns, the record
is drifted, and the recorded and observed digests differ. Test names stay close
to the old ones.

A test must not put the pin back. Asserting that a record has not drifted
compares a live digest with a stored one, which is the shape CLAUDE.md bans, and
a typo fix in the file then turns `npm test` red. The drift test builds a
fixture root under `os.tmpdir()`, writes a design whose recorded digest is
wrong, and checks the loader records the drift and returns. Two mutations
confirm it: editing the note leaves the file green, and re-adding the refusal
turns it red.

## Left as is

### Sealed data keeps its byte pin

`tutorStubBoredomSemanticValidation.js:99` pins the frozen held-out corpus.
Every `heldout.corpusSha256` check in the validation family is untouched. So is
the certificate check. This is what byte pins are for.

`tutorStubFirstDraftCampaign.js:205, 236, 250` pins a frozen extract of an
earlier run's dialogue trace. The code resolves it as kind `sealed_trace`. It is
recorded run data, so the pin stays.

### A source commit or tree recorded in a go request

These compare provenance a go request wrote down against the current checkout.
The brief left them alone and so did I.

- `tutorStubResistanceRecoverySemanticValidationRuntime.js:90-91` —
  `goRequest.source.launchCommit` and `launchTree`.
- `tutorStubResistanceSplitMeasurementValidationRuntime.js:239-240` and
  `296-297` — the same two fields, on the v3 and the split go requests.
- `tutorStubResistanceSemanticValidationRuntime.js:176` and `260` — the archive
  manifest's `source` block against the plan's. Both hold the commit and the tree
  the run was launched from.

### Not a file digest

- `tutorStubResistantLearnerCalibration.js:896-901` hashes parsed sub-blocks of
  the design object (`measurement`, `readerPanel`, `decisionPolicy`), not a file.
- `tutorStubResistantLearnerSemanticRuntime.js:349-381` does the same for
  `instrument`, `calibrationDecisionPolicy` and `readerPanel`.
- `tutorStubResistanceActionRegisterStudy.js:788` hashes five parsed
  `preservation` sub-blocks and compares the result with a literal.
- `tutorStubResistanceActionRegisterStudy.js:790, 894, 912-913` compare
  registration content (stopped-run commits and trees written into the
  registration), not any file on disk.
- `tutorStubFrameRefuserNarrowingCalibration.js:57` is a format check: a regex
  on a 40-character hex string.
- `tutorStubResistanceSplitMeasurementValidationRuntime.js:342-352` compares run
  destinations and stage order, no digest.

### The digest arrives from a caller in `scripts/`

Two sites compare a digest handed in as an argument, where the file read happens
one frame up in a `scripts/` runner. Criterion 1 does not hold in the service, so
I did not guess at them.

- `tutorStubBoredomSemanticValidation.js:235` —
  `assert(authorization.request.sha256 === requestSha256, ...)`.
- `tutorStubResistantProfileRouteCanary.js:166` — the same assertion.

### What still blocks after this change

Resume and archive checks compare whole plan objects, and a plan object embeds
registration digests. Editing a registration between a run and its resume still
blocks, because the plan bytes on disk no longer equal the recomputed plan.

- `tutorStubResistanceRecoverySemanticValidationRuntime.js:307, 759, 887`
- `tutorStubResistanceSplitMeasurementValidationRuntime.js:365-368, 564, 1150, 1284`
- `tutorStubResistanceSemanticValidationRuntime.js:195` and `354` — an archive
  entry, and this run's own `report.json` reached through a transition id derived
  from its bytes.

That is a run-artifact check, not a source pin, so it is out of this card's
scope. If it bites, the fix is to compare the fields that matter rather than to
widen this change.

### Outside `services/tutorStub*.js`

Two tests still hold the banned shape. They are out of the brief's scope and are
listed here so the next reader can see them.

- `tests/tutorStubResistanceSemanticValidation.test.js:137-140` asserts a source
  file's digest equals a literal.
- `tests/tutorStubBoredomSemanticV4InstrumentReadiness.test.js:63` asserts a
  registration field equals the live digest of a service file.
