# 090 — Codex report: v4 outcome-pilot non-empty presence directory refusal

**Date:** 13 August 2026. Direction: 088 as amended by note 088a. GO
note: 083a. Resume authority: 083d. Presence-cap repair commit:
`7d82ab48201dc8e1d2f25918b2c5cd65adeaacaf`. Reader-digest re-pin
commit: `21400c4ae8ef112f23f7e732727b352ea9f8fd5c`.

## Final status

- Final status: guard refusal after three resume invocations in this
  direction; no reader call was made.
- Checkpoint status at final exit: `generation`.
- Checkpoint update: `2026-08-13T05:23:57.873Z`.
- Exact final guard output:

  ```text
  [outcome-pilot] error: semantic annotation output directory is not empty: /Users/lmagee/Dev/machinespirits/ms-adaptation-refinement/.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v4-live-2026-08-13/presence-collection
  ```

- The directory contains the zero-call partial preparation left by the
  earlier 42,000-byte cap refusal: one presence-reader-a packet and its
  response schema. It contains no response file.
- The direction authorized in-place regeneration only for the
  commit-stale brittleness preflight and schema-acceptance carryover.
  The driver did not delete, move, or rewrite `presence-collection` and
  did not retry after this new refusal.
- Presence-reader response files: 0.
- Decision-reader response files: 0.
- Final checkpoint rows: 18 complete dialogue rows and 1 preserved
  quarantined dialogue row.
- Worktree precondition before resume 9: clean.
- GO note worktree blob: `3dfbd1907103486e2ca59e6ab85222d5b41e8db1`.
- GO note HEAD blob: `3dfbd1907103486e2ca59e6ab85222d5b41e8db1`.
- Frozen instrument SHA-256:
  `6a64b31fb57fa4a60e6ef4a42414c422d9b0e2964bdf6ee8491193fc026f3c5f`.
- The 72-dialogue main block was not launched.

## Cap change and reader re-pin

- Cap-change commit:
  `7d82ab48201dc8e1d2f25918b2c5cd65adeaacaf`.
- Packet cap changed from 42,000 to 60,000 in the semantic preparer,
  outcome-study scorer, and pilot manifest. Every 14,000-byte response
  cap remains unchanged.
- Preparer SHA-256 after the cap edit:
  `05c748220a24e82c40a84fd319b73ae6184883c5350aaecf432cde1b920a6e9f`.
- Reader-digest re-pin commit:
  `21400c4ae8ef112f23f7e732727b352ea9f8fd5c`.
- Re-pinned `presence_channel.digests.reader_digest`:
  `936d2ef8dbaaa24ec465dba1120b6e348b59cab756ae43af73c9e727b82e0be7`.
- On resume 11 the frozen-reader bindings guard passed all seven
  checks, including `reader_digest` and `semantic_preparer`.

## Resumes and zero-call artifact regeneration

- Resume 1: replacement order 17 sealed complete; generation events
  increased from 470 to 495; reader calls 0.
- Resume 2: refused because the brittleness preflight was stale;
  reader calls 0. The repository script regenerated it in place with
  zero model calls.
- Resume 3: refused because the schema-acceptance carryover was stale;
  reader calls 0. `carryOverOutcomeSchemaAcceptance()` regenerated it
  from the unchanged paid source with zero new calls.
- Resume 4: fingerprint guard passed; preparation refused because the
  first 46,007-byte presence packet exceeded the old 42,000-byte cap;
  reader calls 0.
- Resume 5: refused at the clean-worktree guard because the appended
  tracked progress line was dirty; reader calls 0.
- Resume 6: refused because the brittleness preflight was commit-stale;
  reader calls 0. The repository script regenerated it with zero model
  calls.
- Resume 7: passed the refreshed preflight and refused because the
  schema-acceptance carryover was commit-stale; reader calls 0.
- Before resume 8 both zero-call artifacts were regenerated at source
  commit `f1ea1c6f9d6b9afa5edd934ea42074268232c223`; the carryover used
  the unchanged paid source and recorded zero new calls.
- Resume 8: both carryovers passed, then the frozen-reader bindings
  guard refused on the derived `reader_digest`; reader calls 0.
- Resume 9: GO-note command plus `--resume`; refused with
  `[outcome-pilot] error: semantic brittleness preflight is stale or fingerprint-mismatched`;
  reader calls 0.
- Zero-call regeneration after resume 9: the repository brittleness
  preflight script regenerated `semantic-brittleness-preflight.json`
  in place; status `passed`; source commit
  `21400c4ae8ef112f23f7e732727b352ea9f8fd5c`;
  `zero_model_calls: true`; reader schema digest `936d2ef8…`.
- Resume 10: GO-note command plus `--resume`; passed the refreshed
  brittleness preflight and refused with
  `[outcome-pilot] error: semantic schema-acceptance ping did not pass or is stale`;
  reader calls 0.
- Zero-call regeneration after resume 10:
  `carryOverOutcomeSchemaAcceptance()` regenerated
  `semantic-schema-acceptance-carryover.json` in place from the
  unchanged paid source
  `/private/tmp/adaptive-warrant-v3-schema-acceptance-carryover-ed19be42-r52-s514.json`;
  source commit `21400c4ae8ef112f23f7e732727b352ea9f8fd5c`;
  `carryover.new_calls: 0`; original SHA-256
  `59e3a6b05ebad416ece70160b59e1efe255d773421243a7d980db6be261073d8`;
  original paid result unchanged.
- Resume 11: GO-note command plus `--resume`; both zero-call artifacts
  and all frozen-reader bindings passed, then preparation refused
  because `presence-collection` was not empty; reader calls 0.
- No resume followed the final refusal.

## Packet sizes

- A final preparer-reported packet-size range is unavailable because
  resume 11 refused before preparation could rebuild the complete
  packet set.
- The preserved partial preparation contains exactly one packet, so
  its observed packet-size range is 46,007–46,007 bytes. Its SHA-256
  is `8e98117be3e30601afb8572e2f18507221361523edc6265aa9b645fb59198d32`.
- Its response-schema file is 12,706 bytes.
- This is the packet emitted by the earlier old-cap attempt, not a
  final 288-packet range under the 60,000-byte cap.
- Ruling 088's zero-call sizing bounded the intended v4 packet set at
  no more than 53,851 bytes. This remains a reviewer-derived bound,
  not a final preparer-reported range.

## Counter

- Counter before the v4 pilot: 4,198.
- Initial generation-call events: 440.
- Quarantined initial order-17 generation-call events: 30.
- Resume-1 replacement generation-call events: 25.
- Total reserved-call events consumed: generation 495; presence
  readers 0; decision readers 0; total 495.
- Counter after: 4,693 of 19,337.
- Remaining under the ceiling: 14,644.
- Remaining within the 1,116-call pilot plan: generation 45; presence
  readers 288; decision readers 288; total 621.

## Mandatory guards

- Learner-analysis coverage guard on the final 18-dialogue admitted
  set: 18 passed at coverage 1.0; 0 unanalyzed turns.
- The preserved quarantined initial order-17 attempt remains excluded;
  it stopped with `learner_analysis_incomplete`.
- Case extraction: 144 cases.
- Case-fingerprint guard: passed.
- Expected case count: 144.
- Observed case count: 144.
- Observed `(dialogue, turn)` identity count: 144.
- Unique identity-plus-turn-plus-content fingerprints: 144.
- Unique content fingerprints: 139.
- Byte-twin groups: 3; group sizes 2, 2, and 4.
- Frozen-reader bindings guard: passed all seven checks on resume 11.
- Presence preparation guard: refused on the non-empty output
  directory before either reader channel.

## Registered prediction observations

- P1 registered never-breaker pattern order 4: first arming turn 7;
  challenge turn 7.
- P1 registered never-breaker pattern order 9: first arming turn 6;
  challenge turns 6, 7, 8.
- P1 registered never-breaker pattern order 13: first arming turn 4;
  challenge turns 4, 5, 6.
- P1 registered never-breaker pattern order 18: first arming turn 5;
  challenge turns 5, 7.
- P2 registered self-breaker pattern order 2: first arming turn 3;
  challenge turn 3.
- P2 registered self-breaker pattern order 11: first arming turn 5;
  challenge turn 5.
- Back-to-back challenge turns: order 9 at 6–7 and 7–8; order 13 at
  4–5 and 5–6.
- These are observed values only; interpretation remains reserved to
  the reviewer.

## Recorded limitations and authorization boundary

- The v4 presence readers are specified under extraction schema v3.2
  while the frozen instrument's presence-gate confirmation was
  validated under the prior schema bytes (note 083b).
- V4 presence packets are sized up to approximately 54 KB, above the
  approximately 32 KB confirmation envelope (ruling 088). The growth
  is registered-sensor frame, not case content.
- The raised packet constant and reader-digest re-pin were prospective:
  no reader call occurred before or after either change.
- No sealed dialogue artifact or paid schema-acceptance source was
  regenerated or modified.
- The preserved `presence-collection` was not touched after the final
  refusal.
- No branch push was performed.
