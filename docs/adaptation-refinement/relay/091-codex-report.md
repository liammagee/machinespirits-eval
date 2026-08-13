# 091 — Codex report: v4 outcome-pilot frozen-reader resume failure

**Date:** 13 August 2026. Direction: 088 tasks 5–6, as amended by
088a and 090a. GO note: 083a. Resume authority: 083d. Presence-cap
repair commit: `7d82ab48201dc8e1d2f25918b2c5cd65adeaacaf`.
Reader-digest re-pin commit:
`21400c4ae8ef112f23f7e732727b352ea9f8fd5c`. Stale-presence
quarantine and resume-direction commit:
`6885374e2df882b840d7c1e89a60a7c4a6537acb`.

## Final status

- Final status: terminal frozen-reader launcher failure on resume 14;
  no outcome ruling is available.
- Checkpoint status at final exit: `readers`.
- Checkpoint update: `2026-08-13T05:29:29.156Z`.
- Exact parent-process output:

  ```text
  [outcome-pilot] error: one or both frozen reader launchers failed
  ```

- Both complete reader packet sets were prepared: 288 presence packets
  and 288 decision packets, with their schemas.
- No `semantic-reader-run.json` or `decision-reader-run.json` exists.
  The `presence-readers` and `decision-readers` directories are empty.
- Presence-reader response files: 0.
- Decision-reader response files: 0.
- The checkpoint therefore remains at generation 495, presence readers
  0, decision readers 0.
- Evidence-based diagnosis: the outcome launcher passes `--resume` to
  both child reader commands whenever the parent is resumed. Both child
  launchers then try to read their own run checkpoint before writing a
  fresh one. These reader-output directories were fresh, so neither
  child run checkpoint existed and both children exited before the first
  call. The parent launcher does not retain child stderr when no log path
  is supplied, so the exact child error text is unavailable; the parent
  error above is exact.
- This is not either retry class authorized by 090a: it is neither a
  commit-stale brittleness/schema carryover nor a refusal on a non-empty
  packet/schema-only output directory. No repair, further resume, or
  quarantine was attempted.
- Final checkpoint rows: 18 complete dialogue rows and 1 preserved
  quarantined dialogue row.
- Worktree precondition before resume 12: clean.
- GO note worktree blob: `3dfbd1907103486e2ca59e6ab85222d5b41e8db1`.
- GO note HEAD blob: `3dfbd1907103486e2ca59e6ab85222d5b41e8db1`.
- Frozen instrument SHA-256:
  `6a64b31fb57fa4a60e6ef4a42414c422d9b0e2964bdf6ee8491193fc026f3c5f`.
- The 72-dialogue main block was not launched.

## Authorized commits and bindings

- Commit `7d82ab48` raised only the presence packet transport cap from
  42,000 to 60,000 in the semantic preparer, outcome scorer, and pilot
  manifest. Every 14,000-byte response cap remained unchanged.
- Commit `21400c4a` re-pinned the derived reader digest to
  `936d2ef8dbaaa24ec465dba1120b6e348b59cab756ae43af73c9e727b82e0be7`.
- Commit `6885374e` records note 090a and the reviewer's preservation of
  the stale old-cap presence collection.
- Preparer SHA-256:
  `05c748220a24e82c40a84fd319b73ae6184883c5350aaecf432cde1b920a6e9f`.
- On resume 14 the frozen-reader bindings guard passed all seven checks,
  including `reader_digest` and `semantic_preparer`.

## Every resume and zero-call regeneration

1. Resume 1: replacement order 17 sealed complete; generation events
   increased from 470 to 495; reader calls 0.
2. Resume 2: refused because the brittleness preflight was stale; reader
   calls 0. The repository preflight script regenerated it in place with
   zero model calls.
3. Resume 3: refused because the schema-acceptance carryover was stale;
   reader calls 0. `carryOverOutcomeSchemaAcceptance()` regenerated it
   from the unchanged paid source with zero new calls.
4. Resume 4: the fingerprint guard passed; preparation refused because
   the first 46,007-byte presence packet exceeded the old 42,000-byte
   cap; reader calls 0.
5. Resume 5: refused at the clean-worktree guard because the appended
   tracked progress line was dirty; reader calls 0.
6. Resume 6: refused because the brittleness preflight was commit-stale;
   reader calls 0. The repository script regenerated it with zero model
   calls.
7. Resume 7: passed the refreshed preflight and refused because the
   schema-acceptance carryover was commit-stale; reader calls 0.
8. Before resume 8 both zero-call artifacts were regenerated at source
   commit `f1ea1c6f9d6b9afa5edd934ea42074268232c223`; the carryover used
   the unchanged paid source and recorded zero new calls. Resume 8 then
   refused on the derived `reader_digest`; reader calls 0.
9. Resume 9: refused because the brittleness preflight was commit-stale;
   reader calls 0. The repository script regenerated it at source commit
   `21400c4ae8ef112f23f7e732727b352ea9f8fd5c`, with zero model calls.
10. Resume 10: refused because the schema-acceptance carryover was
    commit-stale; reader calls 0. `carryOverOutcomeSchemaAcceptance()`
    regenerated it from the unchanged paid source with zero new calls.
11. Resume 11: both carryovers and all frozen-reader bindings passed,
    then preparation refused because `presence-collection` was not empty;
    reader calls 0.
12. Resume 12: after the reviewer quarantined the stale collection,
    refused because the brittleness preflight was commit-stale; reader
    calls 0. The repository preflight script regenerated
    `semantic-brittleness-preflight.json` in place at source commit
    `6885374e2df882b840d7c1e89a60a7c4a6537acb`; status `passed`;
    `zero_model_calls: true`.
13. Resume 13: passed the refreshed brittleness preflight and refused
    because the schema-acceptance carryover was commit-stale; reader
    calls 0. `carryOverOutcomeSchemaAcceptance()` regenerated
    `semantic-schema-acceptance-carryover.json` in place from
    `/private/tmp/adaptive-warrant-v3-schema-acceptance-carryover-ed19be42-r52-s514.json`;
    source commit `6885374e2df882b840d7c1e89a60a7c4a6537acb`;
    `carryover.new_calls: 0`; original SHA-256
    `59e3a6b05ebad416ece70160b59e1efe255d773421243a7d980db6be261073d8`;
    original paid result unchanged.
14. Resume 14: both zero-call artifacts, all frozen-reader bindings,
    coverage, case extraction, fingerprinting, and both packet preparations
    passed. The parent then failed with `one or both frozen reader
    launchers failed`. Neither child wrote a run checkpoint or response;
    reader calls remained 0. No further resume followed.

## Every quarantine and preservation action

- Before the admitted v4 run, the reviewer preserved the zero-call
  leftovers from launch attempts 2 and 3 at
  `.tutor-stub-auto-eval/quarantine-zero-call-attempts-2and3-adaptive-warrant-outcome-pilot-v4-2026-08-13`
  under note 083e.
- During generation, initial order 17 (`bare`,
  `world_102_marigold_archive_box`, seed 517) stopped at
  `learner_analysis_incomplete` after 30 reserved-call events. It remains
  excluded and preserved at
  `.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v4-live-2026-08-13/dialogues/quarantine-attempt-1-outcome-pilot-17-world_102-marigold_archive_box-s517-bare`.
  Resume 1 generated the admitted 25-event replacement.
- Under note 090a, the reviewer preserved the refused old-cap
  packet/schema-only directory at
  `.tutor-stub-auto-eval/quarantine-presence-collection-oldcap-42000-2026-08-13`.
  It contained no reader response.
- This driver made no additional quarantine move. The new complete
  packet/schema collections remain in the run directory untouched, as do
  the empty child reader-output directories.
- Nothing was deleted. No sealed dialogue artifact, paid
  schema-acceptance source, or reader artifact was modified.

## Packet sizes

- The final preparer-reported presence packet-size range is
  **45,419–50,523 bytes** across 288 packets: 144 for
  `presence-reader-a` and 144 byte-identical counterparts for
  `presence-reader-b`.
- All 288 packets are below the authorized 60,000-byte transport cap.
- The packet collections contain 288 response schemas and zero response
  files.
- This supersedes the old-cap partial observation of 46,007 bytes and is
  the complete v4 preparer range requested by direction 088 task 6.

## Counter

- Counter before the v4 pilot: 4,198.
- Initial generation-call events: 440.
- Quarantined initial order-17 generation-call events: 30.
- Resume-1 replacement generation-call events: 25.
- Total reserved-call events consumed: generation 495; presence readers
  0; decision readers 0; total 495.
- Counter after: 4,693 of 19,337.
- Remaining under the ceiling: 14,644.
- Remaining within the 1,116-call pilot plan: generation 45; presence
  readers 288; decision readers 288; total 621.

## Mandatory guards

- Learner-analysis coverage guard on the final 18-dialogue admitted set:
  18 passed at coverage 1.0; 0 unanalyzed turns.
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
- Frozen-reader bindings guard: passed all seven checks on resume 14.
- Presence and decision packet preparation: passed, 288 packets each.
- Reader execution: failed before either child wrote a run checkpoint or
  response.

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
- These are observed values only; interpretation remains reserved to the
  reviewer.

## Recorded limitations and authorization boundary

- The v4 presence readers are specified under extraction schema v3.2
  while the frozen instrument's presence-gate confirmation was validated
  under the prior schema bytes (note 083b).
- V4 presence packets are 45,419–50,523 bytes, above the approximately
  32 KB confirmation envelope (ruling 088). The growth is registered
  sensor frame, not case content.
- The raised packet constant and reader-digest re-pin were prospective:
  no reader call occurred before or after either change.
- No consensus value and no outcome score exists because neither reader
  channel ran.
- No branch push was performed.
