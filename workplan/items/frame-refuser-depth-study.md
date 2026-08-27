---
id: frame-refuser-depth-study
title: Test whether any tutor move lifts the frame-refuser above naming a condition
status: active
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-08-26
updated: 2026-08-27
verification: >-
  A fresh registration fixes one move contrast, an engagement endpoint of
  rung 2 or higher on the sealed ladder, registered interpretability floors,
  and a power scan against the measured base rate of 0.114 before any paid
  call. Calibration and the powered run each start only after their own
  signed GO under the lightweight paid-study policy. The delivered move is
  read from tutor text, not from the assignment, and the two arms must show
  distinct delivered behaviour at a registered floor. A null inside the
  powered design's claim boundary is a result. All paid artifacts pass
  npm run archive:runs and are committed in the private archive repository.
claim_status: planned
depends_on:
  - resistant-learner-strategy-close
links:
  items:
    - resistant-learner-strategy-close
    - resistance-action-register-integration
  notes:
    - notes/2026-08-26-frame-refuser-depth-registration.md
    - config/tutor-stub-frame-refuser-depth-design.v1.json
    - notes/2026-08-27-frame-refuser-depth-registration-v2.md
    - config/tutor-stub-frame-refuser-depth-design.v2.json
    - notes/2026-08-27-frame-refuser-depth-registration-v3.md
    - config/tutor-stub-frame-refuser-depth-design.v3.json
tags:
  - tutor-stub
  - resistant-learners
  - frame-refusal
  - engagement-ladder
---

## Question

In the sealed §6.28 powered run the frame-refuser reached rung 1 — naming a
condition under which it would engage — in 70 of 70 dialogues, but reached
rung 2 (working under protest) in only 0.114 of them, against 0.592 for the
bored learner. The registered endpoint is saturated one rung below the
interesting variation. The question: does any tutor move raise the
frame-refuser's rung-2 rate above its measured base?

## Assets carried in

- The engagement ladder and the three-seat modal reader panel (Sol, Sonnet,
  and Opus; modal value across eligible votes per field, 0.8 pairwise
  agreement floor) are validated on sealed data and are reused unchanged.
  (Description corrected 2026-08-27, outcome-blind: earlier drafts said
  two-seat; the sealed v5 instrument has three seats.)
- The measured rung-2 base rate of 0.114 on face B anchors the power scan.
- The claim scope stays inside the R1 worlds (Marrick and Rowan Flat) and the
  persona-permitted elicitation boundary.

## Constraints from the closed lines

- The two arms must deliver different behaviour, checked from tutor text at a
  registered floor. The v7 boredom study delivered one behaviour twice and
  its fidelity gate compared the assigned move with its own copy; that class
  of defect voids the run.
- Any registered instruction must be read by code on the generating path.
  The v8 reference arm's instruction was read by nothing and one dialogue in
  five broke it.
- The power scan runs against the measured base rate before sizing, and no
  registered floor is relaxed after data.
- No further paid call in the boredom line is authorized; this card covers
  the frame-refuser only.

## Critical path

- P0 (zero-call): pick the move contrast and freeze the design file. The
  working proposal: treatment takes the learner's named condition as the
  object of joint work — the tutor tests the condition with public evidence
  instead of arguing past it; reference acknowledges the condition and
  carries its own line forward. Endpoint: rung 2 or higher within a
  registered window after the first condition-naming turn.
- P1 (zero-call): registration doc with endpoint window, delivered-contrast
  and reader floors, power scan, and spend ceiling.
- Gate 1: signed GO, then a small calibration block (about 12-18 dialogues)
  to check delivered contrast, reader agreement, and the realised base rate.
- Gate 2: second signed GO, then the smallest powered block reaching 80%
  power under the calibration estimates.
- Closeout: seal, fold into the paper under its claim discipline, archive.

## Log

- 2026-08-26: Card opened after the §6.28 close. No model call is authorized
  or active; P0 is zero-call.
- 2026-08-26: P0 and P1 done zero-call. Design file
  `config/tutor-stub-frame-refuser-depth-design.v1.json` (revision 1) and
  registration `notes/2026-08-26-frame-refuser-depth-registration.md` frozen.
  Treatment is condition discharge (meet the named condition with one public
  exhibit, re-offer the same test); reference is the sealed
  standing-conditions bridge at its measured 0.114. Registered alternative
  0.35; sizing rule picks the smallest arm size reaching 0.80 exact power at
  the calibration-updated reference rate (60 per arm at the design base).
  Calibration is 20 dialogues and waits on a signed Gate 1 approval.
- 2026-08-27: Gate 1 launcher built zero-call. New calibration-only CLI
  `scripts/run-tutor-stub-frame-refuser-depth-calibration.js` +
  `services/tutorStubFrameRefuserDepthLaunch.js`; depth support (validator,
  arm projection, 20-job balanced plan, compilation preflight, gated
  calibration report) added to `services/tutorStubResistantLearnerCalibration.js`.
  Dry run passes all 12 preflight checks with zero model calls: 20 jobs,
  1,280 planned calls under the 3,960 ceiling, 8 compiled arm-world-scene
  rows, 20 rival DAGs, 24 route rows probed. Two outcome-blind description
  corrections recorded: the sealed endpoint panel is three-seat modal, not
  two-seat (design JSON `measurement.readerPanel.seats`, registration note,
  this card). Disclosed prospectively: the depth contrast is bundle-level —
  condition-discharge bundle vs bridge bundle, including handoff-mode
  differences — not a single-sentence manipulation. Calibration waits on the
  operator's attended TTY-typed approval (`APPROVE CALIBRATION 3960`); no GO
  note, no commit binding.
- 2026-08-27: Revision-1 Gate 1 calibration ran attended and FAILED its own
  gates before any powered run. Full run archived in the private archive repo
  (`artifacts/tutor-stub-live/frame-refuser-depth-gate1-2026-08-27`), rows
  never reused. Diagnosis: three instrument defects, none in the tutor or
  learner. (1) Mixed hyphen-underscore case ids defeated Sol's case-id echo
  in 12/12 completed dialogues, voiding all its votes — the eligible-vote,
  pairwise, and determinate gates failed in both arms. (2) Floors of 8 were
  sized against 10 planned dialogues per arm, near-unreachable under the
  sealed machinery's ~35% typed-failure attrition (7/10 and 5/10 completed).
  (3) The reference contamination gate double-counted typed non-delivery
  failures as contamination (2/9 tripped it with zero actual exhibits).
  Delivery itself worked: treatment delivered 10/10; blind panel read 0/7
  completed treatment rows as the bridge.
- 2026-08-27: Revision 2 registered zero-call as a fresh registration with
  disclosure (`notes/2026-08-27-frame-refuser-depth-registration-v2.md`,
  `config/tutor-stub-frame-refuser-depth-design.v2.json`). Fixes: underscore-
  only case ids (registered rule, checked at plan build and launch preflight);
  36 dialogues, 18 per arm (floors unchanged, now reachable at P≈0.98);
  contamination gate replaced by a blind-panel arm-separation bound
  (`maximumTreatmentBridgeReadRate` 0.1 on completed treatment rows) with
  reference cleanliness enforced by the bundled adjudication and certified
  per row, reported not gated. Fresh master seed 2026082701; no revision-1
  assignment re-drawn. Ceilings 2,304 planned calls / 7,128 reservations.
  Launch preflight refuses the superseded revision-1 file. Dry run passes
  all 14 checks zero-call; 12/12 tests pass. Calibration waits on attended
  TTY-typed `APPROVE CALIBRATION 7128`.
- 2026-08-27: Revision-2 Gate 1 calibration ran attended and FAILED two
  treatment gates before any powered run; archived at
  `artifacts/tutor-stub-live/frame-refuser-depth-gate1-v2-2026-08-27` in the
  private archive repo, rows never reused. Every revision-2 plumbing fix
  held (11/11 determinate both arms, floors reachable, reference arm passed
  all gates). Diagnosis: the treatment instruction under-specified the voice
  of the re-offer — the tutor delivered condition + exhibit + re-offer
  wrapped in the reference move's standing formula ("Before your question
  can have standing…", one turn ending "what assay shall test that?").
  Blind panel read 3/11 completed treatment turns as the bridge (bound 0.1);
  one endpoint seat pair hit 0.727 vs the 0.8 floor, partly on the same
  hybrid turns. The bridge-read gate did its registered job: it caught the
  v7 arm-convergence class.
- 2026-08-27: Revision 3 registered zero-call as a fresh registration with
  disclosure (`notes/2026-08-27-frame-refuser-depth-registration-v3.md`,
  `config/tutor-stub-frame-refuser-depth-design.v3.json`). Changes: the
  treatment instruction and adjudication question now require the re-offer
  in committed voice (state readiness to run the test now on the named
  exhibit) and ban the standing-precondition formula by name; fresh master
  seed 2026082801 with a `cal3` case-id stem so no id collides with either
  archived run; sizing, floors, gates, and ceilings unchanged. Known issue
  disclosed, not fixed: the shared analysis fallback can leak "Classifier
  returned non-JSON output." into a spoken turn. Launch preflight refuses
  both superseded revisions. Calibration waits on attended TTY-typed
  `APPROVE CALIBRATION 7128` (unchanged — ceilings did not move).
- 2026-08-27: Revision-3 Gate 1 calibration launched attended and halted after
  5 dialogues on a code defect, not a study defect. The treatment arm's typed
  exhaustion code (`tutor_stub_tutor_condition_discharge_non_delivery`) was
  missing from the shared retained-failure code list, so the first treatment
  delivery exhaustion crossed the child boundary unrecognized and read as a
  technical failure; the halt rule then stopped the block as registered. The
  treatment arm never exhausted delivery in the v1 or v2 runs, so this path
  first executed paid live. Recorded outcomes: 1 complete treatment
  (delivered), 1 mislabeled treatment exhaustion, 3 retained reference
  non-deliveries; 31 dialogues never started; 73 of 7,128 reservations used.
  Fix (zero-call): the code joins the retained list, and the launcher gains
  `--resume`, which keeps every recorded paid outcome, re-types the mislabeled
  row from its recorded trace (never re-runs it), runs only the never-started
  dialogues under the same ceilings, and records the attended re-typed phrase
  plus provenance in a ledger `resume` entry. No approval artifact is voided
  or re-signed. 16/16 depth tests pass, including a launch-halt-resume round
  trip and a fail-closed refusal when a recorded technical failure has no
  delivery verdict to re-type. A read-only probe over the real run root
  confirms the re-type fires on exactly the one mislabeled row. Resume waits
  on the operator's attended TTY-typed `APPROVE CALIBRATION 7128`.
- 2026-08-27: Resume ran attended to the end: 36/36 dialogues accounted, 743
  of 7,128 reservations, zero technical failures; the re-typed row and 21 new
  typed non-deliveries were all retained, so the code fix held live. The
  calibration FAILED its authoritative gates; under the kill rule no powered
  run happens on this registration. Attrition drove it: 22/36 dialogues ended
  as typed non-delivery (11 per arm), leaving 7 completed per arm against
  floors of 8 — the determinate-outcome and eligible-vote gates failed in
  both arms. The treatment arm also failed its turn-level delivery floor
  (13/18, 0.72 vs 0.8) and the blind-panel arm-separation bound (1/7
  completed rows read as the bridge, bound 0.1). The reader panel held where
  measurable: pairwise endpoint agreement 1.0 (treatment) and 0.86
  (reference). All 14 completed dialogues ended at rung 1; reference rung-2
  rate 0/7 against the measured base 0.114. Non-delivery concentrated in the
  Marrick world (14/18 exhausted vs 8/18 in Rowan Flat) and hit both arms
  alike, and reference exhaustion rose from 7/18 (v2) to 11/18 under an
  unchanged instruction — the committed-voice change cannot be the whole
  story. Run archived at
  `artifacts/tutor-stub-live/frame-refuser-depth-gate1-v3-2026-08-27` in the
  private archive repo. Any continuation needs a fresh registration; no
  floor is relaxed after data.
- 2026-08-27: Post-run trace diagnosis (zero-call, recorded artifacts only).
  The attrition splits into three channels. (1) Treatment delivery exhaustion,
  0 in v2 to 5 in v3: the frame-refuser voices its condition IN the banned
  standing formula (its scripted turn is "Before your question can stand, we
  must assay..."), the treatment instruction tells the tutor to restate the
  condition, tutors often close by quoting the learner's line verbatim, and
  the registered adjudication question bans the formula with no exemption for
  quoted learner words — 4 of the 5 final rejected drafts contain the quoted
  formula. The ban catches the echo, not the tutor's own move; the 7
  completed treatment rows show the committed-voice move is deliverable when
  the quote is dropped. (2) Learner noncompliance, 6 (v2) to 8 (v3): the
  scripted learner fails its own compliance check; pre-existing channel,
  untouched by the v3 change. (3) Reference delivery exhaustion, 4 (v2) to 8
  (v3) under an unchanged instruction: rejected drafts phrase the bridge as a
  question to the learner or quote the warrant instead of stating the bounded
  test; draw noise not excluded. Any v4 must exempt (or forbid) the learner
  quote in the treatment turn AND budget floors for the realized 61%
  attrition, else fix the learner-noncompliance channel first.
- 2026-08-27: Revision 4 registered (zero-call). Design
  `config/tutor-stub-frame-refuser-depth-design.v4.json`; note
  `notes/2026-08-27-frame-refuser-depth-registration-v4.md`. Two changes,
  both from the trace diagnosis. (1) Quote-echo trap closed from both
  sides: the treatment instruction now requires the condition restatement
  in the tutor's own words (no word-for-word repetition of the learner's
  sentence), and the adjudication question judges only the tutor's own
  voice — explicit quotes of the learner are exempt from the formula ban,
  while the restatement itself must not be such a quote. (2) Attrition
  budgeted: 48 dialogues (24 per arm, 12 per world per arm) so the
  unchanged floors of 8 completed per arm are reachable at both observed
  attrition rates (39% in v2, 61% in v3). Gates, floors, endpoint, power
  scan, and the sealed stack are unchanged. Fresh seed 2026082901, `cal4`
  case-id stem; the launch preflight refuses all three superseded designs.
  Ceilings scale at the registered 198 reservations per dialogue: 3,072
  planned calls, 9,504 reservations (approval phrase `APPROVE CALIBRATION
  9504`). Zero-call dry run passes all 14 preflight checks; depth suite
  17/17. The paid Gate 1 run waits on attended TTY-typed approval.
