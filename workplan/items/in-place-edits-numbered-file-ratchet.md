---
id: in-place-edits-numbered-file-ratchet
title: Edit designs and judges in place; ratchet numbered sibling files
status: active
type: infra
priority: P1
owner: claude
source: review
created: 2026-09-03
updated: 2026-09-03
verification: "CLAUDE.md and AGENTS.md carry the in-place rule; the go-request checker, packager and their three tests are gone; VALIDATOR_ONLY_GROUPS is empty; the three tests that hashed code, design or registration files no longer do; `npm run test:ratchets` fails when a new numbered sibling file appears under config/, services/ or scripts/; lint:all and the hermetic suite pass."
claim_status: planned
links:
  items:
    - remove-go-packager-working-tree-source-pins
    - shared-paid-study-launch-contract
  notes:
    - docs/paid-study-authorization-policy.md
    - scripts/run-structural-ratchets.js
tags:
  - paid-study
  - provenance
  - testing
  - maintenance
---

Each change to a study design or a judge prompt became a new numbered file next
to the old one. The crossed registration for the resistant learner is ten files
(`config/tutor-stub-resistance-action-register-crossed-registration.v1..v10.json`,
3,487 lines). The v4 to v5 step changed 19 lines. The recovery adjudicator is
eight files, `V2` to `V9` in `services/`, 6,211 lines; `V6`, `V7` and `V8` are
about 1,120 lines each, and the V7 to V8 step added one sentence. A model wrote each file whole. Three things
pushed agents to copy instead of edit:

1. Tests hashed the source or registration file and compared the digest with a
   literal. An in-place edit turned the test red. A new file did not.
2. The go-request checker and packager expected a chain of superseding files.
3. Nothing mechanical stopped the next copy.

This card does three things in one PR:

- **Rule.** One hard-rule line in `CLAUDE.md` and the policy bullet in
  `AGENTS.md`: amend a design, judge prompt or corpus file in place and commit.
  A new numbered file is banned. A new study gets a new name. Provenance is the
  commit hash in the run ledger.
- **Delete the pins on code.** Remove the digest literals for source, schema,
  design and registration files from
  `tests/tutorStubResistanceSemanticAdjudicationV2.test.js`,
  `tests/tutorStubResistanceSemanticAdjudicationV3.test.js` and
  `tests/tutorStubResistantLearnerMergedRegistration.test.js`. Pins on sealed
  data (held-out corpus, validation certificate) stay. Delete
  `scripts/check-tutor-stub-resistant-profile-study-go-request.js`,
  `scripts/package-tutor-stub-resistant-profile-study-go-request.js` and their
  three tests; empty `VALIDATOR_ONLY_GROUPS` in `scripts/ci-change-policy.js`.
  This supersedes `remove-go-packager-working-tree-source-pins` (PR #991),
  which kept the packager alive read-only.
- **Ratchet.** `tests/numberedSiblingFileRatchet.test.js` counts numbered
  sibling files under `config/`, `services/` and `scripts/` and fails when a
  count goes above its cap. Raising the cap in the same commit, with a reason
  in the commit message, is the only escape. The runner
  `scripts/run-structural-ratchets.js` picks the test up so the pre-push hook
  runs it.

## Follow-up (not in this PR)

Runtime digest refusals still live in services that load historical study
files and throw when a recorded digest of a code file drifts. They guard
closed studies and their tests. Convert each to record-only when its study is
next touched, or leave it if the study is archived:

- `services/tutorStubResistanceActionRegisterStudy.js:1121`
- `services/tutorStubResistanceActionRegisterExecution.js:41,105`
- `services/tutorStubResistanceSemanticValidationRuntime.js:570`
- `services/tutorStubResistanceRecoverySemanticValidationRuntime.js:468,953`
- `services/tutorStubResistanceAxisDiscriminationPreflight.js:82`
- `services/tutorStubResistanceSplitMeasurementValidationRuntime.js:773,1340`
- `services/tutorStubResistanceActionRegisterManipulationValidation.js:65`
- `services/tutorStubResistanceRecoverySemanticValidationV3.js:54-59`
- `services/tutorStubResistanceRecoverySemanticValidationV6.js:42`
- `services/tutorStubResistanceSemanticValidationV4.js:70-75`
- `services/tutorStubResistanceConfirmationSemanticRuntime.js:70`
- `services/tutorStubResistantLearnerCalibration.js:768,1356-1362,1442-1445`

66 config JSON files record a digest of a `services/` or `scripts/` file. They
are records. Leave them.
