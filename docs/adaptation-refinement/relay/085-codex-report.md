# 085 — Codex report: v4 outcome-pilot fingerprint guard refusal

**Date:** 13 August 2026. Direction: 083e returning to 083c task 1. GO note: 083a. Resume authority: 083d. HEAD at precondition check: `e2bda86c9311842b8a12c988ead5a0162337276f`.

## Final status

- Report classification: guard refusal after one technical resume.
- Checkpoint status at final exit: `generation`.
- Initial launch exit status: 0; returned status: `generation_quarantine_stop`.
- Resume launch exit status: 1.
- Exact final guard output:

  ```text
  [outcome-pilot] error: annotationCaseFingerprint guard found duplicates
  ```

- Worktree precondition: clean.
- GO note worktree blob: `3dfbd1907103486e2ca59e6ab85222d5b41e8db1`.
- GO note HEAD blob: `3dfbd1907103486e2ca59e6ab85222d5b41e8db1`.
- Frozen instrument SHA-256: `6a64b31fb57fa4a60e6ef4a42414c422d9b0e2964bdf6ee8491193fc026f3c5f`.
- Initial launch: 17 complete dialogue seals, 1 quarantined dialogue seal, 440 admitted generation-call events.
- Quarantined initial order 17: `bare`, `world_102_marigold_archive_box`, seed 517; child status `learner_analysis_incomplete`; unanalyzed turn 6; failure code `invalid_semantic_events`; message `strict public learner analysis returned invalid semantic events: overlapping_events:non_atomic_span, overlapping_events:non_atomic_span`.
- The quarantined initial order-17 trace contained 30 `model_call_budget_reserved` events. The checkpoint initially recorded 0 for that row because the evidence-invalid result carried no trace path. The checkpoint was repaired to add those 30 events.
- The initial order-17 directory was preserved at `.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v4-live-2026-08-13/dialogues/quarantine-attempt-1-outcome-pilot-17-world_102-marigold_archive_box-s517-bare`.
- Resume count: 1.
- Resume command: the GO-note command with `--resume` added.
- Resume result: replacement order 17 sealed complete with learner-analysis coverage 1.0 and 25 generation-call events.
- Final checkpoint rows: 18 complete dialogue rows and 1 preserved quarantined dialogue row.

## Counter

- Counter before: 4,198.
- Initial admitted generation-call events: 440.
- Quarantined initial order-17 generation-call events: 30.
- Resume replacement generation-call events: 25.
- Total reserved-call events consumed: generation 495; presence readers 0; decision readers 0; total 495.
- Counter after: 4,693 of 19,337.
- Remaining under the ceiling: 14,644.
- Remaining within the 1,116-call pilot plan: generation 45; presence readers 288; decision readers 288; total 621.

## Mandatory guards

- Learner-analysis coverage guard on the final 18-dialogue admitted set: 18 passed at coverage 1.0; 0 unanalyzed turns.
- Learner-analysis coverage guard on the quarantined initial order-17 attempt: not checked because the child seal status was `learner_analysis_incomplete`.
- Case extraction: 144 cases.
- 144-case fingerprint guard: failed; 139 unique fingerprints; 3 duplicate groups; duplicate-group sizes 2, 2, and 4.
- Duplicate group `5f1763f3d7c86001df7d62d2012b8df9c7088a43a9e91b314ce4db04057e9f10`: order 18 gated seed 517 turn 1 and order 4 gated seed 515 turn 1, both `world_102_marigold_archive_box`.
- Duplicate group `25206ef68475fa0337ac154263a2d581d98ea53144ae52573c8889249dfa2e6f`: order 2 gated seed 515 turn 1 and order 9 gated seed 516 turn 1, both `world_101_kestrel_signal_lamp`.
- Duplicate group `05aa986d7663d27395cd3b55f6d8b4452acf6f5e37a558c12948dcf372004ced`: order 5 standing-permission seed 515 turn 1, replacement order 17 bare seed 517 turn 1, order 6 bare seed 515 turn 1, and order 10 bare seed 516 turn 1, all `world_102_marigold_archive_box`.
- Presence-reader calls: 0.
- Decision-reader calls: 0.

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

- The fingerprint guard stopped the run before either reader channel.
- The 72-dialogue main block was not launched.
- No branch push was performed.
