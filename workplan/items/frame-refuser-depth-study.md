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
