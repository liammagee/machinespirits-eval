# 092 — Codex report: v4 outcome-pilot terminal decision-reader failure

**Date:** 13 August 2026. Direction: 091a. GO note: 083a.
Resume authority: 083d. Parent-launcher repair commit:
`f43bcc64eaf9e66567971787c7602674317b6b55`.

## Final status

- Final status: terminal reader failure; no outcome ruling is available.
- The parent-launcher repair worked. Both reader children started fresh from a
  resumed parent, wrote their own checkpoints, and retained launcher output in
  the run root.
- The decision child stopped at `decision-reader-a-batch-121` with checkpoint
  status `incomplete_model_call_failure` and exact error:
  `codex CLI turn failed before producing an accepted response`.
- The failed decision batch exposed sample
  `case-a82be9a3a0d29dd15d28bfd7` and produced no accepted response file.
- The presence child was still running when the decision failure became
  visible. Because the parent waits for both children, the driver delivered
  SIGINT to the presence child and parent to prevent further paid calls on a
  run that could no longer complete. All paid artifacts were preserved and
  untouched.
- No resume followed the paid failure. The 72-dialogue main block was not
  launched. Nothing was pushed.

## Exact calls and counter

- Presence channel: **151 attempted, 151 completed, 0 failed** of 288 planned.
  - `presence-reader-a`: 144 completed.
  - `presence-reader-b`: 7 completed.
  - Response files: 151.
- Decision channel: **121 attempted, 120 completed, 1 failed** of 288 planned.
  - `decision-reader-a`: 120 completed, then batch 121 failed.
  - `decision-reader-b`: 0 attempted.
  - Response files: 120.
- Reader attempts in this direction: **272**.
- Generation remains 495 calls from report 091.
- Global counter: **4,965 / 19,337**, computed from the settled pre-reader
  counter 4,693 plus 272 reader attempts. Remaining ceiling room: **14,372**.
- The parent checkpoint still shows its pre-reader accounting
  (`generation=495`, readers 0/0) because `runReaderProcesses` reserves the two
  complete 288-call channel blocks only after both children exit successfully.
  The child checkpoints and response files above are the authoritative actual
  reader-call account for this incomplete run.

## Observed endpoint values

- **No endpoint values were produced.** The launcher never reached assembly or
  `scoreAdaptiveWarrantOutcomeStudy()`.
- `outcome-pilot-score.json` is absent. Presence consensus, decision consensus,
  and every outcome-study endpoint are therefore unavailable, not zero.
- The partial paid reader responses are preserved as incomplete evidence and
  are not interpreted here. Interpretation remains reserved to the reviewer.

## Repair and verification

- Changed only:
  - `scripts/run-adaptive-warrant-outcome-pilot.js`;
  - `tests/adaptiveWarrantOutcomePilot.test.js`.
- The parent now appends `--resume` independently only when the corresponding
  child checkpoint exists:
  - `presence-readers/semantic-reader-run.json`;
  - `decision-readers/decision-reader-run.json`.
- Child logs are retained at the run root:
  - `presence-readers-launcher.log`;
  - `decision-readers-launcher.log`.
- The focused outcome-pilot suite passed **19/19**, including a resumed parent
  with both child checkpoints absent and a resumed parent with only the
  semantic child checkpoint present.
- `npm test` itself refused before executing tests because the pre-existing
  hermetic manifest omits five on-disk suites:
  `adaptiveWarrantFallbackPassClosure`,
  `adaptiveWarrantLearnerAnalysisCoverage`,
  `adaptiveWarrantOutcomePilot`, `adaptiveWarrantOutcomeStudy`, and
  `semanticReaderPresenceGate`. This unrelated manifest was not edited under
  the parent-only direction.
- The full root Node suite and full in-housed tutor-core Vitest suite were then
  run directly under the same isolated hermetic environment and both exited
  0. The root TAP reported 2,069 top-level test/suite items. ESLint passed.
- `git diff --check` passed before commit.
- The frozen-reader bindings guard passed all seven checks unchanged:
  `extraction_schema_digest`, `reader_digest`, `semantic_preparer`,
  `provider_response_schema`, `decision_preparer`, `decision_runner`, and
  `decision_handbook`.
- No digest, cap, child runner, service, or manifest pin changed.

## Resumes, zero-call regeneration, and quarantine

1. Resume 15: refused before reader dispatch because
   `semantic-brittleness-preflight.json` was commit-stale. It was regenerated
   in place by the repository preflight script with status `passed` and
   `zero_model_calls: true`.
2. Resume 16: refused before reader dispatch because
   `semantic-schema-acceptance-carryover.json` was commit-stale. It was
   regenerated in place from the unchanged paid source
   `/private/tmp/adaptive-warrant-v3-schema-acceptance-carryover-ed19be42-r52-s514.json`
   (SHA-256
   `59e3a6b05ebad416ece70160b59e1efe255d773421243a7d980db6be261073d8`),
   with `new_calls: 0` and `byte_identical: true`.
3. Resume 17: refused because the packet-only `presence-collection` directory
   from resume 14 was non-empty. Audit found zero `*.response.json` files in
   both packet collections and zero files in both child reader directories.
   Under task 7, both 578-file packet/schema collections were preserved as:
   - `quarantine-resume17-presence-collection-zero-response`;
   - `quarantine-resume17-decision-collection-zero-response`.
4. Resume 18: rebuilt both packet collections, started both children fresh,
   and accumulated the paid calls reported above. The decision child then
   failed terminally at batch 121. No further resume or quarantine occurred.

## Preserved evidence

- Run root:
  `.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v4-live-2026-08-13`.
- Presence checkpoint SHA-256:
  `cfb1727de2da5967178c26d435d8fde88c192ccb06819af0f0d39a38584f550c`.
- Decision checkpoint SHA-256:
  `1d1309b13112861a5ea561ecfaa423f1a51d9913ebc81e8aa483a9781c9ba01b`.
- Decision launcher log retains the exact child error. Presence launcher log
  is empty because that child emitted no stdout/stderr before SIGINT.
- GO-note worktree and HEAD blobs remained
  `3dfbd1907103486e2ca59e6ab85222d5b41e8db1`.
- Frozen instrument SHA-256 remained
  `6a64b31fb57fa4a60e6ef4a42414c422d9b0e2964bdf6ee8491193fc026f3c5f`.
- No paid artifact was deleted or overwritten, and nothing was pushed. Paid
  responses, the failed decision checkpoint, zero-call quarantines, sealed
  dialogues, and the paid schema-acceptance source all remain preserved.
