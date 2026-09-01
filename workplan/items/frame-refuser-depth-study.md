---
id: frame-refuser-depth-study
title: Test whether any tutor move lifts the frame-refuser above naming a condition
status: done
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-08-26
updated: 2026-08-31
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
claim_status: scope-bound
depends_on:
  - resistant-learner-strategy-close
links:
  items:
    - resistant-learner-strategy-close
    - resistance-action-register-integration
    - frame-refuser-refusal-narrowing
    - frame-refuser-satisfiable-condition
  notes:
    - notes/2026-08-26-frame-refuser-depth-registration.md
    - config/tutor-stub-frame-refuser-depth-design.v1.json
    - notes/2026-08-27-frame-refuser-depth-registration-v2.md
    - config/tutor-stub-frame-refuser-depth-design.v2.json
    - notes/2026-08-27-frame-refuser-depth-registration-v3.md
    - config/tutor-stub-frame-refuser-depth-design.v3.json
    - notes/2026-08-27-frame-refuser-depth-registration-v4.md
    - config/tutor-stub-frame-refuser-depth-design.v4.json
    - notes/2026-08-29-frame-refuser-depth-registration-v5.md
    - config/tutor-stub-frame-refuser-depth-design.v5.json
    - config/tutor-stub-resistant-learner-merged-semantic-registration.v6.json
    - notes/2026-08-30-frame-refuser-depth-v6-diagnosis.md
    - notes/2026-08-30-frame-refuser-depth-construct-finding.md
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
- 2026-08-27: Gate 1 v4 paid run FAILED (run root
  `.tutor-stub-auto-eval/frame-refuser-depth-gate1-v4-2026-08-27`, source
  commit c83596b8, clean tree, 1,266 of 9,504 reservations). The v4 fixes
  worked: treatment delivery 19/19 adjudicated turns delivered (v3:
  13/18), attrition back to 40% (19 typed failures of 48; v3: 61%), both
  arms reached the floor of 8 completed (14 treatment, 15 reference), and
  the determinate-outcome and accounting gates passed. Three gates
  failed, all in the reader panel. (1) Pairwise exact endpoint agreement
  under 0.8 in both arms (treatment a-b 0.714, a-c 0.714; reference a-b
  0.733). Reader_a (codex.gpt-5.6-sol) sits in every failing pair and
  cast 6 of the 9 stray votes; its stray rung-2 votes quote learner posts
  that name a quantitative bound (pressure-interval overlap) while still
  withholding — Sol grades that as a sizing update, both Claude seats
  hold it at rung 1. A real rubric-boundary case, not noise. (2)
  Treatment reader_b (sonnet-5) eligible fidelity votes 10 of 14 vs floor
  12: four votes on `delivered_test_bounded_distinction` returned
  `evidence_invalid` with empty evidence arrays and were discarded. (3)
  Treatment bridge-read 2/14 = 0.143 vs bound 0.1 (rows marrick_r11,
  rowan_flat_r4; one row over). Endpoint substance: treatment 0/14 at
  rung 2, reference 1/15 = 0.067 (design base 0.114) — no lift even
  before the gates. Kill rule: no powered run on this registration; any
  continuation is a fresh registration. Run archived at
  `artifacts/tutor-stub-live/frame-refuser-depth-gate1-v4-2026-08-27` in
  the private archive repo.
- 2026-08-27: CLOSED as a firm calibration-stage null; claim scope-bound.
  Pooled across the four calibration runs, the condition-discharge move
  produced rung 2 in 0 of 38 graded dialogues; the sealed bridge in 2 of
  38 (design base 0.114). At the registered alternative rate of 0.35,
  0 of 38 is near impossible; even at the base rate it has about a 1%
  chance. The v4 run showed the move itself is clean (delivery 19/19),
  so the null is about the persona, not the instrument. Claim boundary:
  this persona, this engagement ladder, this move family, calibration
  data only — no powered run ran, so no registered powered claim exists.
  Two bounded readings recorded: (1) the persona's named condition
  demands evidence the world may not contain, so meeting it can never
  complete; (2) the v4 judge disagreement sits exactly where the learner
  gives ground while refusing (names bounds, weighs the pressure-interval
  overlap) — movement below the ladder's resolution. Successor cards:
  `frame-refuser-refusal-narrowing` (finer endpoint on the archived
  transcripts first) and `frame-refuser-satisfiable-condition` (persona
  whose condition the world can meet). Tutor-conduct measurement needs no
  new card (resistance-action register line). Paper fold-in pending: one
  bounded paragraph in the resistant-learner section under its claim
  discipline. All four runs archived in the private archive repo.
- 2026-08-30: REOPENED (done → active) for a fifth, instrument-repaired
  calibration. Revision 5 registered zero-call
  (`notes/2026-08-29-frame-refuser-depth-registration-v5.md`,
  `config/tutor-stub-frame-refuser-depth-design.v5.json`; PR #871). The
  archived-trace attribution of the three v4 gate failures is
  instrument-side, none in the tutor or persona: (1) the sonnet seat
  attached evidence quotes to no-votes where the contract demands JSON
  null, voiding 29/29 `whole_frame_compliance` votes in both arms and
  4/14 treatment fidelity votes; (2) the sol seat split rung boundaries
  on 9/29 rows, bidirectional, every failing pair involving sol
  (sonnet-opus pairs 0.857/0.933); (3) both bridge reads came from
  treatment turns quoting the learner's standing formula, passed under
  revision 4's own-voice carve-out. Fixes: merged semantic registration
  v6 (`config/tutor-stub-resistant-learner-merged-semantic-registration.v6.json`)
  amends exactly four surfaces — outright evidence-null instruction, a
  registered one-retry evidence-null slip tolerance, per-field schema
  restatement, and three worked examples anchoring the disputed rung
  boundaries — and the revision-5 treatment instruction plus
  adjudication question fail delivery on the standing formula wherever
  it appears in the turn (own voice, quotation marks, or attributed
  words). No gate constant, floor, ceiling, sizing rule, or disposition
  moves; no archived row is reused. Fresh seed 2026083001, `cal5` stem,
  48 dialogues (24 per arm); ceilings unchanged (3,072 planned calls,
  9,504 reservations). Zero-call dry run passes all 14 preflight
  checks; depth suite 18/18, registration suites 6/6 (v6) and 11/11
  (v5). The 2026-08-27 pooled calibration-stage null stands as recorded
  in its own scope; the fifth calibration tests whether it survives the
  repaired instrument. Gate 1 waits on attended TTY-typed
  `APPROVE CALIBRATION 9504`; the launch preflight refuses all four
  superseded designs.
- 2026-08-30: Gate 1 v5 calibration ran under attended TTY approval
  (launch 13:59Z, sealed 14:50Z) and FAILED — one gate:
  `pairwise_exact_endpoint_agreement`, both arms (treatment sol-sonnet
  14/18 = 0.778, sol-opus 0.833, sonnet-opus 0.944; reference sol-sonnet
  and sol-opus 5/8 = 0.625, sonnet-opus 1.000). All three v4 fixes held:
  eligible-vote gates passed with zero evidence-null slip retries used
  (the sharpened prompt alone sufficed), bridge reads 0 (v4: 2/14),
  treatment delivery 24/24. The residual is one seat at one boundary:
  all 7 splits are 1-versus-2 with modal 1, and 6 of the 7 are sol
  voting 2 alone — unidirectional now (bidirectional in v4), 6 of 7 in
  `world_030_rowan_flat`, sitting exactly where the learner concedes
  bounds while withholding the rung-2 concession. So the open problem
  moved from contract-level to construct-level (a sharper rung-2 anchor
  or sub-rung resolution at that boundary). Accounting: 26 complete /
  22 retained typed failures, 0 technical; reference attrition worsened
  again — 16/24 typed failures (11 bounded-test non-delivery), exactly
  at floor 8 completed, under an instruction byte-unchanged since v2,
  pointing generator-side. Substance, calibration-scope only: treatment
  rung-2 1/18 = 0.056 — `depth_treatment_cal5_world_005_marrick_r11`,
  unanimous 3-0, the first treatment rung-2 in five calibrations —
  reference 0/8 (design base 0.114). Fidelity `delivered_register`
  sol-sonnet under 0.8 in both arms (0.556/0.750), report-only as
  registered. Kill rule holds: no powered run on this registration; any
  continuation is a fresh registration (revision 6). Run archived in
  the private archive repo at
  `artifacts/tutor-stub-live/frame-refuser-depth-gate1-v5-2026-08-30`
  (run commit 5455c0989; ledger section commit 797bfa484, which also
  backfills v1-v4 rows). Disposition — close again as a calibration-stage
  null now re-confirmed under the repaired contract, or register a
  revision 6 on the construct question — awaits the operator.
- 2026-08-30: Zero-call revision-6 diagnosis drafted
  (`notes/2026-08-30-frame-refuser-depth-v6-diagnosis.md`). Reading the
  archived deviant-seat evidence shows all seven v5 splits — the sonnet
  one included — share one grammar: a concessive application of a
  completed public result (grant what the exhibit supports at an
  intermediate node, then convert the grant into a narrower
  unproved-path requirement in the same sentence). The sealed v6
  rung-1 examples are all prospective/conditional, so that indicative
  corridor is unlit, and the rung-2 definition's applies-completed-result
  disjunct has no partial-application carve-out. The note freezes a
  draft concessive-application anchor clause plus a worked-example pair
  (one verbatim from archived split row
  `depth_reference_cal5_world_030_rowan_flat_r9`, one constructed
  minimal contrast) and a dispute-targeted rehearsal protocol: 16
  archived split rows (v4+v5) plus 14 unanimous controls including both
  lineage rung-2 rows, three seats, ~90 reads, success criteria fixed
  before any read, kill-cheap rule if sol still splits. Companion leg
  before any revision 6: classify the 11 reference bounded-test
  non-delivery transcripts and size for attrition. Rehearsal and any
  registration await operator instruction.
- 2026-08-30: The anchor rehearsal ran (operator-approved, unregistered,
  archived transcripts only — 90 reads over the frozen 30-row roster,
  harness `scripts/rehearse-tutor-stub-frame-refuser-depth-v6-anchor.js`,
  seed 2026083002, 0 transport failures, 3 non-decisive evidence-format
  invalids) and returned the pre-registered verdict
  `kill_no_revision_6_construct_finding`. Resolution PASSED: the deviant
  seat voted the archived modal on 15/16 splits (floor 13; 16/16
  semantically), 6/6 v5 sol-high (floor 5). Stability FAILED: 11/14
  controls kept (floor 12; one break quote-format-only), and both
  lineage rung-2 controls (`…cal5_world_005_marrick_r11`,
  `…cal4_world_030_rowan_flat_r10`) were demoted to rung 1 by all three
  seats against the no-demotion clause. The archived rung-2 evidence
  turns share the splits' concessive-application grammar, so a
  consistent boundary leaves zero unambiguous rung-2 events across five
  calibrations (registered alternative 0.35). Sealed in the private
  archive repo at
  `artifacts/tutor-stub-analysis/frame-refuser-depth-v6-anchor-rehearsal-2026-08-30`
  (run commit adcc8ae15, ledger a78845b8f).
- 2026-08-31: CLOSED (active → done) on the construct finding, per the
  diagnosis note's pre-fixed decision rule: no revision 6, no merged
  registration v7, no further paid call in this line. The persona's
  genuine movement sits below the ladder's resolution at the
  concede-bounds-while-withholding seam — a generator/construct result,
  not a seat or anchoring defect. Closing note
  `notes/2026-08-30-frame-refuser-depth-construct-finding.md`. The
  attrition companion leg is moot (required only before a revision 6).
  Budget moves to `frame-refuser-satisfiable-condition`; the finer-
  endpoint question stays with `frame-refuser-refusal-narrowing`. The
  2026-08-27 pooled calibration-stage null stands in scope, now bounded
  by this finding. claim_status stays scope-bound. Recorded 2026-08-31:
  the designated successor `frame-refuser-satisfiable-condition` closed
  2026-08-30 by its own substantive-failure rule (0/48 units produced
  the jurisdictional trigger), and `frame-refuser-refusal-narrowing`
  closed the same day at failed_agreement — the budget handoff is moot,
  and any continuation in this line needs a fresh card and its own
  registration.
