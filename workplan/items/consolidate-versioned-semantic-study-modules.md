---
id: consolidate-versioned-semantic-study-modules
title: "Consolidate the copy-pasted versioned semantic study modules"
status: triaged
type: maintenance
priority: P2
owner: codex
source: manual
created: 2026-08-27
updated: 2026-08-27
verification: One parameterized module plus a per-version frozen-constants
  descriptor replaces the duplicated families; every file whose bytes are
  pinned in a sealed manifest or named in .prettierignore is unchanged
  byte-for-byte (checked by sha256 before/after); all existing tests pass
  unchanged; a regression test proves each historical version resolves the
  same constants as its old file did.
claim_status: methods
links:
  notes:
    - services/tutorStubResistanceMeasurementValidationV6Runtime.js
    - services/tutorStubResistanceRecoverySemanticAdjudicationV2.js
tags:
  - tutor-stub
  - refactor
  - codex-sol
  - effort-ultra
---

About 17,000 lines across 34 files are near-exact copies: the resistance and
boredom semantic adjudication, validation, and measurement-validation families
in `services/`, mirrored by per-version analyze and build scripts in
`scripts/`. A token rename from V6 to V7 leaves a 2-line diff (a version
integer and a frozen commit hash). The version pinning is legitimate science;
the duplicated carrier is not.

The fix: one parameterized module, and a small frozen-constants table per
version (version integer, corpus commit, instrument freeze commit, status
string). Hard constraint: files with sha256 pins in sealed study records must
keep their exact bytes — route only new versions and unpinned files through
the shared module, and prove pinned files untouched.

Suggested worker: Codex Sol at Ultra reasoning effort. The mechanical diff is
easy; knowing which bytes are load-bearing is the hard part.
