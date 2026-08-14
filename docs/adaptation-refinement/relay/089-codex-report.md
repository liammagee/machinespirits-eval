# 089 — Codex report: v4 outcome-pilot frozen-reader binding refusal

**Date:** 13 August 2026. Direction: 088. GO note: 083a. Resume
authority: 083d. Presence-cap repair commit:
`7d82ab48201dc8e1d2f25918b2c5cd65adeaacaf`.

## Final status

- Final status: guard refusal after four resume invocations in this
  direction; no reader call was made.
- Checkpoint status at final exit: `generation`.
- Checkpoint update: `2026-08-13T05:12:53.803Z`.
- Exact final guard output:

  ```text
  [outcome-pilot] error: outcome pilot frozen reader binding mismatch: reader_digest
  ```

- Manifest `presence_channel.digests.reader_digest`:
  `6cb95fd8032f4c43c9fdc1e45808680365d5a0d3eb2dda5ef085e4d97e10145f`.
- Effective `reader_schema_digest` after the authorized preparer edit:
  `936d2ef8dbaaa24ec465dba1120b6e348b59cab756ae43af73c9e727b82e0be7`.
- Cause: `adaptiveWarrantSemanticInstrumentBindings()` includes the
  complete preparer file SHA-256 inside `reader_schema_digest`. The
  authorized cap edit therefore changes both the separately pinned
  preparer digest and the derived reader digest.
- Direction 088 task 2 says to touch no other digest. The driver did
  not re-pin `reader_digest`, bypass the bindings guard, or resume
  again.
- Presence-reader response files: 0.
- Decision-reader response files: 0.
- Final checkpoint rows: 18 complete dialogue rows and 1 preserved
  quarantined dialogue row.
- The 72-dialogue main block was not launched.

## Cap repair and verification

- Repair commit: `7d82ab48201dc8e1d2f25918b2c5cd65adeaacaf`.
- Packet cap changed from 42,000 to 60,000 only in the three places
  named by direction 088: the semantic preparer, outcome-study scorer,
  and pilot manifest.
- Every 14,000-byte response cap remains unchanged.
- `scripts/score-semantic-reader-presence-gate.js` remains unchanged.
- Preparer SHA-256 after the edit:
  `05c748220a24e82c40a84fd319b73ae6184883c5350aaecf432cde1b920a6e9f`;
  the pilot manifest carries that exact pin. No other manifest digest
  was changed.
- The launcher error now derives both cap values from
  `PRESENCE_CHANNEL_CAPS`.
- Focused launcher and preparer suites: 39 passed, 0 failed.
- ESLint on the five changed JavaScript test/source files: passed.
- `git diff --check`: passed.

## Resumes and zero-call artifact regeneration

- Resume 5: GO-note command plus `--resume`; refused at the clean
  worktree guard because the newly appended tracked progress line was
  dirty. Calls remained generation 495, presence 0, decision 0. The
  progress boundary was committed at `70c0294b`.
- Resume 6: GO-note command plus `--resume`; refused because the
  semantic brittleness preflight was commit-stale. Reader calls 0.
- Zero-call regeneration after resume 6: the repository brittleness
  preflight script regenerated `semantic-brittleness-preflight.json`
  in place; status `passed`; `zero_model_calls: true`; preparer digest
  `05c74822…`. The refusal boundary was committed at `47917e64`.
- Resume 7: GO-note command plus `--resume`; passed the refreshed
  brittleness preflight and refused because the schema-acceptance
  carryover was commit-stale. Reader calls 0.
- Before resume 8, after committing the progress boundary at
  `f1ea1c6f`, both zero-call artifacts were regenerated in place so
  they shared source commit
  `f1ea1c6f9d6b9afa5edd934ea42074268232c223`.
- The schema-acceptance carryover was regenerated from the unchanged
  paid source
  `/private/tmp/adaptive-warrant-v3-schema-acceptance-carryover-ed19be42-r52-s514.json`;
  original SHA-256
  `59e3a6b05ebad416ece70160b59e1efe255d773421243a7d980db6be261073d8`;
  `carryover.new_calls: 0`; original paid result unchanged.
- Resume 8: GO-note command plus `--resume`; both zero-call artifacts
  passed, then the frozen-reader bindings guard refused on
  `reader_digest`. Reader calls 0.

## Packet sizes

- The final preparer packet-size range is unavailable: resume 8
  stopped at the frozen-reader bindings guard before packet
  preparation, and changing the additional digest was outside the
  direction.
- The prior refused preparation recorded its first packet at 46,007
  bytes under the old 42,000-byte cap.
- Ruling 088's zero-call sizing bounded the v4 packet set at most
  53,851 bytes (44,302 static-frame bytes plus the largest 9,549-byte
  blinded case). This is a reviewer-derived bound, not a final
  preparer-reported range.

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
- Frozen-reader bindings guard: failed on `reader_digest` before
  packet preparation or either reader channel.

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
- The raised packet constant was prospective: no reader call occurred
  under either the old or new cap.
- No sealed dialogue artifact or paid schema-acceptance source was
  regenerated or modified.
- No additional digest was changed after the binding contradiction.
- No branch push was performed.
