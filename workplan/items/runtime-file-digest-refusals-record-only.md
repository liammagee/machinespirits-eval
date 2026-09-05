---
id: runtime-file-digest-refusals-record-only
title: Record file digests at run time instead of refusing on drift
status: done
type: infra
priority: P1
owner: claude
source: review
created: 2026-09-04
updated: 2026-09-05
verification: "No site in services/ or scripts/ throws on a drifted digest of a code, schema, prompt, design, registration or go-request file in this repo. Each such site records the observed and recorded digests. Sealed data, run artifacts and recorded-value comparisons are unchanged. lint:all, test:ratchets, wp:source-check and the hermetic suite pass."
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
| `tutorStubBoredomSemanticValidation.js` | 235 | the go request, hashed one frame up in its `scripts/` runner | converted |
| `tutorStubResistantProfileRouteCanary.js` | 166 | the go request, hashed one frame up in its `scripts/` runner | converted |

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

- `tutorStubResistanceRecoverySemanticValidationRuntime.js:90-91`:
  `goRequest.source.launchCommit` and `launchTree`.
- `tutorStubResistanceSplitMeasurementValidationRuntime.js:239-240` and
  `296-297`: the same two fields, on the v3 and the split go requests.
- `tutorStubResistanceSemanticValidationRuntime.js:176` and `260`: the archive
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

### What still blocks after this change

Resume and archive checks compare whole plan objects, and a plan object embeds
registration digests. Editing a registration between a run and its resume still
blocks, because the plan bytes on disk no longer equal the recomputed plan.

- `tutorStubResistanceRecoverySemanticValidationRuntime.js:307, 759, 887`
- `tutorStubResistanceSplitMeasurementValidationRuntime.js:365-368, 564, 1150, 1284`
- `tutorStubResistanceSemanticValidationRuntime.js:195` and `354`: an archive
  entry, and this run's own `report.json` reached through a transition id derived
  from its bytes.

That is a run-artifact check, not a source pin, so it is out of this card's
scope. If it bites, the fix is to compare the fields that matter rather than to
widen this change.

## Round two: the rest of the repo

A second sweep looked at every run-time file-hash comparison in `scripts/` and
`services/`, not only `services/tutorStub*.js`. The sweep found 115 candidate
sites in 50 files: a genuine file-hash call within ten lines back, and a
`throw`, a `fail(`, an `errors.push` or a `process.exit` within eight lines
forward.

### What decided each site

A site converts when all three hold. The code hashes a file on disk at run
time; it blocks on a mismatch; and the hashed file is a registration, a design,
a go request, a code file, a JSON schema or a prompt **in this repo**.

Three rules pruned most of the 115.

**Run artifacts are not source files.** A pin binding an analysis to a
`batch-plan.json`, a `batch-result.json`, a reader response, a packet, a trace,
an archive or a DB export stays. No edit anywhere in the repo changes those
bytes, so the pin never blocks a bug fix. The pin checks a recorded artifact.
It does not pin a design file.

**Sealed data keeps its pin.** Any path holding `heldout`, `held-out`,
`development-corpus`, `blind-read` or `certificate` is untouched. So is the
annotation handbook: `build-adaptive-warrant-challenge-corpus.js:748-772`
already lists `'annotation handbook'` as `'pin'` in the same table as
`'blinded corpus'` and `'private key'`, and the handbook itself lives outside
this repo under `../machinespirits-eval-private/`.

**A comparison of two written-down values is not a file digest.** Lines like
`request.bindings.corpus_sha256 !== manifest.corpus.sha256` read two recorded
fields. They sit in the same `||` chain as a real digest term, so the sweep
flags them, and they all stay.

### Converted outside `services/tutorStub*.js`

| File | What is now recorded |
| --- | --- |
| `analyze-tutor-stub-resistance-action-register-baseline.js` | batch trace sources |
| `analyze-tutor-stub-resistance-action-register-confirmation.js` | the confirmation analysis source |
| `analyze-tutor-stub-resistance-recovery-offset-cleaning.js` | the source instrument registration |
| `audit-tutor-prompt-agency.js` | each audited tutor prompt |
| `build-adaptive-warrant-challenge-corpus.js` | the targeted-challenge freeze protocol |
| `execute-adaptive-state-benchmark-v2-s1.js` | the superseded source config |
| `prepare-adaptive-warrant-outcome-study.js` | the outcome-study menu source pins |
| `prepare-learner-profile-world-deconfound.js` | the world configs, the launch plan, the two certified artifacts, the frozen design |
| `rehearse-tutor-stub-frame-refuser-depth-v6-anchor.js` | the v6 merged semantic registration |
| `replay-learner-profile-recovery-l1.js` | the quiet detector and the pressure trigger |
| `run-adaptive-warrant-baseline-study.js` | the runtime-boundary sources, the placeholder set, the contract, the mechanism-validation freeze, the annotation-freeze provenance |
| `run-adaptive-warrant-decision-readers.js` | the decision-reader freeze bindings |
| `run-adaptive-warrant-outcome-main-block.js` | the inherited pilot bindings, the reader runner, the decision preparer, the world configs, reviewer note 097a |
| `run-adaptive-warrant-outcome-pilot.js` | the go note, the pilot bindings, the pinned checkouts |
| `run-adaptive-warrant-semantic-readers.js` | the semantic-reader freeze bindings |
| `run-adaptive-warrant-semantic-schema-acceptance-ping.js` | the synthetic fixtures and the acceptance bindings |
| `run-adaptive-warrant-semantic-schema-smoke.js` | the synthetic fixtures and the smoke bindings |
| `run-adaptive-warrant-steering-decomposition.js` | the inherited pilot bindings, the reader runner, the decision preparer, the world configs, reviewer note 103 |
| `run-derivation-phase6-gate.js` | the decision contracts, the verdict evaluators, the canary invariants, the continuations |
| `run-tutor-stub-boredom-action-register-proof-dag.js` | the source closure and the recovery registration |
| `run-tutor-stub-boredom-semantic-validation.js` | the go request |
| `run-tutor-stub-first-draft-campaign.js` | the two campaign configs, the world-quality files, the focused test suites, the model-free fixtures |
| `run-tutor-stub-resistance-action-register-confirmation.js` | the live-batch go request |
| `run-tutor-stub-resistance-action-register-crossed.js` | the live-batch go request |
| `run-tutor-stub-resistance-semantic-validation.js` | the go request |
| `run-tutor-stub-resistant-profile-route-canary.js` | the go request |
| `score-late-presence-read.js` | ruling 004 |
| `seal-guarded-warrant-instrument-freeze.js` | the acceptance response schema, the inherited bindings, the schema copy |
| `seal-guarded-warrant-outcome-manifest.js` | the inherited manifest pins |
| `services/adaptiveTutor/stateBenchmarkStage1Executor.js` | the S0 parent source set |
| `services/adaptiveTutor/stateBenchmarkStage2Lineage.js` | the S1 parent config |
| `services/adaptiveTutor/stateObservabilityPreflightLineage.js` | the preflight contract and its S1-relevant contract |
| `services/adaptiveTutor/stateObservabilityReliabilityV22Lineage.js` | the reliability contract and its S1-relevant contract |
| `services/adaptiveWarrantReaderRetake.js` | reviewer ruling 094a |

Rulings in `docs/` are treated as registration-class documents. Ruling 004 in
`score-late-presence-read.js` and ruling 094a in `adaptiveWarrantReaderRetake.js`
get the same treatment: the digest is written down, and the path check and the
missing-file check still refuse.

### Helpers

`services/recordedFileDigest.js` grew `recordObservedDigest`, for the case where
the caller already holds both digests, and `recordSourceSetDigests`, for a set
of files a lineage check reads together. `services/recordedSourceProvenance.js`
is new: it writes down a recorded commit and tree beside the current checkout.

## Report

Items 1 and 2 were ruled on 2026-09-04 in a walk-through. Items 3 to 7 still
need a ruling.

### 1. Two `config/` edits (ruled: keep)

The brief said not to edit any file under `config/`. Two one-line additions to
`config/hermetic-test-manifest.json` register the new test files
`tests/recordedFileDigest.test.js` and `tests/recordedSourceProvenance.test.js`.
Without them the hermetic runner does not select the new tests. This file is a
test manifest, not a record of a measurement. The edit was made in `0948cbbe`
and `c490c83c`; the user ruled to keep it.

### 2. Authorization ceremonies (ruled: one converted, two out of scope)

Three sites looked like a paid-run approval bound to a digest.

- `run-adaptive-warrant-semantic-readers.js:89` and
  `prepare-adaptive-warrant-annotation-batches.js:832` hash
  `diagnostic-freeze-manifest.json`, which
  `build-adaptive-warrant-v3-semantic-diagnostic.js` writes into the run's own
  output directory. A run artifact never changes on a repo edit, so it is on
  the OUT list. No change.
- `run-adaptive-warrant-baseline-study.js:609-732` put the source-file digest
  and the child-policy digest inside the signed contract, and the plan identity
  in `services/adaptiveWarrantStudyIntegrity.js` folded the same two digests
  into the fingerprint the contract carries. A one-line source fix changed
  both, so the signed authorization was refused and `--resume` threw
  `resume plan drift`. Converted in `4c7e7eb0`: the two digests now sit beside
  the contract in `source_provenance_record`, the plan identity omits them,
  and `validateAdaptiveWarrantLaunchAuthorization` records observed against
  approved to stderr instead of refusing. The format check on the two
  `approved_*` fields stays, so a malformed value still fails under the same
  label. The recomputed `approval_digest` check at line 658 stays: it catches
  a request file whose contract was edited after the signature, which the
  `tamperedRequest` test covers.

### 3. One loop, two roles (ruled: split by role)

`services/program2ExperimentSafety.js:388` hashes a list of paths in one loop.
The certifier names each entry by role. `launch_plan`, `pilot_bundle:N` and
`pilot_trace:<job>` are run artifacts written into the run's output directory,
so a hash mismatch there still refuses. `world` points at a
`config/drama-derivation/world-*.yaml` and `gate_spec` at a
`config/adaptive-tutor-evidence/*-gates.json`, both edited in place in git.
For those two roles a well-formed hash that moved is now written to stderr
through `recordObservedDigest`, returned in a `records` array, and kept by the
launcher as `evidenceDrift` in the launch attempt record. A missing or
escaping file still refuses for every role, and so does a missing or malformed
digest on any role. The launcher runs the futility check on the gate spec
inside the certificate, so that pin never changed what runs. The user ruled on
2026-09-04 to convert both. `docs/program2-launch-certificates.md` and the
launcher's certificate reminder line now say so. The dated note
`notes/program-2/2026-07-26-launch-safety-contract.md` still says the
gate-spec file cannot change after certification; it is a record and was left.

### 4. Development evidence (ruled: keep the pin)

`tutorStubResistanceSemanticValidationV2.js:231` and
`tutorStubResistanceSemanticValidationV3.js:349` hash
`config/tutor-stub-resistance-semantic-adjudication-development-evidence.v2.json`
and its v3 sibling. A development-evidence JSON is not a registration, a design,
a go request, a code file, a schema or a prompt, so it fails the IN test. The
name is close to `development-corpus`, which is on the OUT list, but does not
match it. Neither list fits, so I left both.

The file is a small frozen manifest. It lists the corpora the instrument was
developed on with their digests and case counts, discloses that the v1 and v2
held-out corpora were consumed, and states that v3 held-out reuse is not
allowed. It holds no code digest. A change to it is a change to the study's
measurement rules, and the go covers the study only until the study changes.
The user ruled on 2026-09-04 to keep the pin. No code changed.

### 5. Diagnosis note pin (ruled: convert to a record)

`rehearse-tutor-stub-frame-refuser-depth-v6-anchor.js:387` threw
`diagnosis note bytes drifted from the pinned sha256` on
`notes/2026-08-30-frame-refuser-depth-v6-diagnosis.md`. That note is in git and
is edited in place, so it looks like the banned shape, but the four anchor
surfaces are quoted verbatim from it and the rehearsal reads it as its own
frozen evidence. The v6 merged registration in the same file was converted.

The script never reads the note's content: the four amendment surfaces and the
30-row roster are constants in the script, so the note's bytes never changed
what runs. The rehearsal ran on 2026-08-30 and the line closed on 2026-08-31.
The user ruled on 2026-09-05 to convert it. The loader now records the digest
through `recordObservedDigest`, returns it in `digestRecords`, and the plan
writes `observed_sha256` and `drifted` beside the recorded sha under
`diagnosis_note`. No test touched the pin.

### 6. A clean-worktree stop, not a digest (ruled: leave it)

`run-tutor-stub-first-draft-campaign.js:326` calls
`gitWorktreeState({ required: true })` when the config sets
`require_clean_worktree`, which refuses to start on a dirty tree. This is not a
digest check, so it is outside the brief, but it is the same class of stop.

Three stops hang on it: a start blocker when the tree is dirty, a per-cell
throw when the tree became dirty after start, and a per-cell throw when HEAD
moved. 28 of 59 campaign configs set the flag; the loader forces v8 and v9 to.
The line has not moved since 2026-08-17. The user ruled on 2026-09-05 to leave
all three. No code changed.

### 7. A test pin that survives (ruled: leave it)

`tests/learnerProfileRecoveryL1.test.js:34-38` hashes
`services/tutorStubQuietDetectorV1.js` and compares it with the literal
`318da00fff7fc8049fc21640f2978cc119ff3a45a53a5dd126e3df66656ec6c4`. This is the
reintroduction trap: a one-line fix to the detector turns `npm test` red. The
brief said not to delete a test, so it stays.

The V1 file is not the live detector. It is a frozen copy of the qd-v1 quiet
detector, added on 2026-08-17 in PR #654 so the L1 recovery can replay a
historical run with the exact bytes used then. The replay validator and the
deconfound paid gate record this digest and continue; the validator refuses
only on the version string. The user ruled on 2026-09-05 to leave the test as
it is. No code changed.

The two other test pins this card first listed are gone. In
`tests/tutorStubResistanceSemanticValidation.test.js` the one assertion that
hashed `registration.v1.json` against a literal was removed; the test and its
other assertions stay, including the drift assertion on the line below. In
`tests/tutorStubBoredomSemanticV4InstrumentReadiness.test.js` the pin became a
format check, and a second test was added to read the unpinned files back.

### Endpoint contract and endpoint go request, versus certificate and corpus

`tutorStubBoredomSemanticV4InstrumentReadiness.test.js` held one test pinning
four files. Two of them are sealed data, and they keep their literal digests:
the validation certificate and the held-out corpus. The other two are the
endpoint contract and the superseded HOLD request, both edited in place. Those
now get a format check and a read-back, so a typo fix in either no longer turns
`npm test` red. The same split runs through the rest of this card: an endpoint
contract and a go request are registration files and are recorded; a
certificate and a corpus are sealed and stay pinned.

## Closed 2026-09-04

Merged as PR #1019. Checked on main at c4607dc8: `services/recordedFileDigest.js`
exists; the two test pins named above now assert the drift record; the sealed
data pins at `tutorStubBoredomSemanticValidation.js:99` and the run-artifact
pins are unchanged; `npm run lint:all`, `npm run test:ratchets` and
`npm run wp:source-check` pass; CI on that commit is green. The one local
hermetic failure is the partial-clone test noted on the ratchet card.

## Reopened 2026-09-04

Reopened for the item-by-item walk-through of the seven sites reported in
PR #1019. Rulings on items 1 to 7 are recorded above and carried in PR #1026.

## Closed 2026-09-05

All seven items walked and ruled. Items 3 and 5 changed code: the world and
gate-spec evidence roles record, and the diagnosis-note pin in the frame-refuser
rehearsal records. Items 1, 2, 4, 6 and 7 stay as they were. Carried in
PR #1026.
