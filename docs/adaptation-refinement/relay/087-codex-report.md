# 087 — Codex report: v4 outcome-pilot transport-cap refusal

**Date:** 13 August 2026. Direction: 086. GO note: 083a. Resume authority: 083d. Fingerprint-guard repair commit: `41ca37ff1e05110f7aa8d8e419eb6cd9e23da221`.

## Final status

- Final status: guard refusal after three additional resume invocations.
- Checkpoint status at final exit: `generation`.
- Checkpoint update: `2026-08-13T04:58:02.021Z`.
- Exact final guard output:

  ```text
  [outcome-pilot] error: presence-reader-a-batch-01 exceeds the 42000-byte prompt limit
  ```

- First presence packet: 46,007 bytes.
- Presence packet cap: 42,000 bytes.
- Difference: 4,007 bytes.
- First response-schema file: 12,706 bytes.
- Response-schema cap: 14,000 bytes.
- Presence-reader response files: 0.
- Decision-reader response files: 0.
- Final checkpoint rows: 18 complete dialogue rows and 1 preserved quarantined dialogue row.
- Worktree precondition before resume: clean.
- GO note worktree blob: `3dfbd1907103486e2ca59e6ab85222d5b41e8db1`.
- GO note HEAD blob: `3dfbd1907103486e2ca59e6ab85222d5b41e8db1`.
- Frozen instrument SHA-256: `6a64b31fb57fa4a60e6ef4a42414c422d9b0e2964bdf6ee8491193fc026f3c5f`.

## Guard repair and verification

- Repair commit: `41ca37ff1e05110f7aa8d8e419eb6cd9e23da221`.
- Changed files: `scripts/run-adaptive-warrant-outcome-pilot.js`; `tests/adaptiveWarrantOutcomePilot.test.js`.
- Case fingerprint inputs: dialogue identity, turn index, content SHA-256.
- Required guard tests: legitimate byte-twins pass and report; doubled identity refuses; mutated case refuses; count drift refuses.
- Focused launcher tests: 17 passed, 0 failed.
- Required prompt/world tests: 22 passed, 0 failed.
- Derivation world quality: 35 passed, 0 failed.
- ESLint on the two changed files: passed.

## Resumes and zero-call artifact regeneration

- Earlier resume 1, recorded in report 085: replacement order 17 sealed complete; generation attempts increased from 470 to 495; reader calls 0.
- Resume 2 command: GO-note command plus `--resume`.
- Resume 2 result: refused with `[outcome-pilot] error: semantic brittleness preflight is stale or fingerprint-mismatched`; reader calls 0.
- Zero-call regeneration after resume 2: `scripts/run-adaptive-warrant-semantic-brittleness-preflight.js` regenerated `semantic-brittleness-preflight.json` in place; status `passed`; source commit `41ca37ff1e05110f7aa8d8e419eb6cd9e23da221`; new model calls 0.
- Resume 3 command: GO-note command plus `--resume`.
- Resume 3 result: refused with `[outcome-pilot] error: semantic schema-acceptance ping did not pass or is stale`; reader calls 0.
- Zero-call regeneration after resume 3: `carryOverOutcomeSchemaAcceptance()` regenerated `semantic-schema-acceptance-carryover.json` in place from `/private/tmp/adaptive-warrant-v3-schema-acceptance-carryover-ed19be42-r52-s514.json`; source commit `41ca37ff1e05110f7aa8d8e419eb6cd9e23da221`; `carryover.new_calls` 0; original paid result unchanged.
- Resume 4 command: GO-note command plus `--resume`.
- Resume 4 result: fingerprint guard passed; presence packet preparation refused at 46,007 bytes against 42,000; reader calls 0.

## Counter

- Counter before: 4,198.
- Initial generation-call events: 440.
- Quarantined initial order-17 generation-call events: 30.
- Resume-1 replacement generation-call events: 25.
- Total reserved-call events consumed: generation 495; presence readers 0; decision readers 0; total 495.
- Counter after: 4,693 of 19,337.
- Remaining under the ceiling: 14,644.
- Remaining within the 1,116-call pilot plan: generation 45; presence readers 288; decision readers 288; total 621.

## Mandatory guards

- Learner-analysis coverage guard on the final 18-dialogue admitted set: 18 passed at coverage 1.0; 0 unanalyzed turns.
- Learner-analysis coverage guard on the quarantined initial order-17 attempt: not checked because the child seal status was `learner_analysis_incomplete`.
- Case extraction: 144 cases.
- Case-fingerprint guard: passed.
- Expected case count: 144.
- Observed case count: 144.
- Observed `(dialogue, turn)` identity count: 144.
- Unique identity-plus-turn-plus-content fingerprints: 144.
- Unique content fingerprints: 139.
- Byte-twin groups: 3; group sizes 2, 2, and 4.
- Presence-reader calls: 0.
- Decision-reader calls: 0.

## Byte-twin groups

- Content SHA-256 `5f1763f3d7c86001df7d62d2012b8df9c7088a43a9e91b314ce4db04057e9f10`: order 18 gated seed 517 turn 1 and order 4 gated seed 515 turn 1, both `world_102_marigold_archive_box`.
- Content SHA-256 `25206ef68475fa0337ac154263a2d581d98ea53144ae52573c8889249dfa2e6f`: order 2 gated seed 515 turn 1 and order 9 gated seed 516 turn 1, both `world_101_kestrel_signal_lamp`.
- Content SHA-256 `05aa986d7663d27395cd3b55f6d8b4452acf6f5e37a558c12948dcf372004ced`: order 5 standing-permission seed 515 turn 1, replacement order 17 bare seed 517 turn 1, order 6 bare seed 515 turn 1, and order 10 bare seed 516 turn 1, all `world_102_marigold_archive_box`.

## Registered prediction observations

- P1 registered never-breaker pattern order 4: first arming turn 7; challenge turn 7.
- P1 registered never-breaker pattern order 9: first arming turn 6; challenge turns 6, 7, 8.
- P1 registered never-breaker pattern order 13: first arming turn 4; challenge turns 4, 5, 6.
- P1 registered never-breaker pattern order 18: first arming turn 5; challenge turns 5, 7.
- P2 registered self-breaker pattern order 2: first arming turn 3; challenge turn 3.
- P2 registered self-breaker pattern order 11: first arming turn 5; challenge turn 5.
- Back-to-back challenge turns: order 9 at 6–7 and 7–8; order 13 at 4–5 and 5–6.

## Recorded limitation

The v4 presence readers run under extraction schema v3.2 while the frozen instrument's presence-gate confirmation was validated under the prior schema bytes.

## Authorization boundary

- The 42,000-byte presence packet guard stopped the run before either reader channel.
- The fingerprint-guard repair did not alter reader packets.
- No sealed dialogue artifact was regenerated or modified.
- The source paid schema-acceptance artifact was not modified.
- The 72-dialogue main block was not launched.
- No branch push was performed.
