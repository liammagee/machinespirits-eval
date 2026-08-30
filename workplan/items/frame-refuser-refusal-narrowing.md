---
id: frame-refuser-refusal-narrowing
title: Measure whether condition discharge narrows the frame-refuser's refusal
status: active
type: experiment
priority: P2
owner: codex
source: manual
created: 2026-08-27
updated: 2026-08-29
branch: codex/frame-refuser-narrowing-p0
verification: >-
  A written narrowing codebook exists before any reader call. Reader
  calibration on archived transcripts passes registered agreement floors
  under its own explicit GO and spend ceiling. A fresh registered
  contrast runs only if the scale shows spread on archived rows, with its
  own endpoint, floors, power scan, and explicit GO. Archived rows
  are never reused as confirmatory evidence. All paid artifacts are
  committed in the private archive repository.
claim_status: planned
depends_on:
  - frame-refuser-depth-study
links:
  items:
    - frame-refuser-depth-study
    - frame-refuser-satisfiable-condition
  notes:
    - config/tutor-stub-frame-refuser-narrowing-codebook.v1.md
tags:
  - tutor-stub
  - resistant-learners
  - frame-refusal
  - engagement-ladder
---

## Question

The depth study closed on a firm null: no graded treatment dialogue in 38
reached rung 2 (working under protest). But the v4 judge disagreement sat
exactly where the learner gives ground while refusing — it names the
pressure interval, weighs the bead overlap, ranks what evidence would
count. The engagement ladder has no rung for that. Question: does the
condition-discharge move narrow the refusal — fewer demanded proofs,
tighter named bounds, more conceded sub-claims — even though it never
produces rung 2?

## Assets carried in

- 77 completed dialogues (76 with a determinate grade) across the four
  archived depth calibration runs, with transcripts, traces, and reader
  votes, in the private archive repo under
  `artifacts/tutor-stub-live/frame-refuser-depth-gate1*-2026-08-27`.
- The concrete gray-zone rows from v4: Sol's stray rung-2 votes quote
  learner posts that name quantitative bounds while withholding. These are
  the seed examples for the codebook.

## Constraints

- Archived rows serve instrument building only. They were generated under
  four superseded designs; any confirmatory claim needs a fresh registered
  run on fresh dialogues.
- Reader calibration on archived transcripts is paid reading and needs its
  own attended approval and spend ceiling before any call.
- No officious authorization: no commit-bound approvals, no re-signature
  cycles; provenance recorded, not enforced.

## Critical path

- P0 (zero-call): write the narrowing codebook — countable marks of a
  narrowing refusal (number of distinct demanded proofs per turn, bound
  tightness, sub-claims conceded), with worked examples from the archived
  gray-zone rows and an explicit tie-break for "names a bound while
  refusing".
- P1 (small paid block, explicit GO): three-seat reader calibration on a
  sampled slice of archived rows; registered agreement floors; report
  whether the scale spreads between the two tutor versions.
- Gate: fresh registered contrast on fresh dialogues only if P1 shows
  spread and agreement.

## Log

- 2026-08-27: Card opened from the depth-study closeout. No model call is
  authorized; P0 is zero-call.
- 2026-08-29: **P0 draft written, zero-call; P0 remains open.**
  `config/tutor-stub-frame-refuser-narrowing-codebook.v1.md` defines the three
  registered end-of-turn states with their directions: open demands still
  standing (lower is narrower), tightness of the narrowest still-open bound on a
  0–3 scale (higher is narrower), and cumulative still-maintained sub-claims
  conceded on the tutor's line (higher is narrower). Counting rules cover the
  cases that would otherwise be judged twice — a demand restated in narrower
  terms is one demand scored on tightness, a withdrawn demand is a concession
  rather than an open demand, and a concession on the wider frame is out of scope
  because a learner who abandons the frame has left the persona.

  The tie-break the readers needed is written plainly: a learner naming a bound
  while still withholding is rung 1 on the ladder, always. That is the cell
  where the fourth calibration failed pairwise agreement (0.714 and 0.733), and
  since the ladder is deliberately unamended the disagreement would otherwise
  recur. Under the codebook the same turn reads unambiguously as ladder rung 1
  with bound tightness 3.

  The codebook takes no authority over the ladder: it never converts to a
  ladder score or breaks a ladder tie. In the already registered satisfiable
  study, the ladder remains the primary endpoint and narrowing is report-only;
  P1 is instrument-building calibration, not confirmatory evidence. A later
  fresh registration may promote a validated narrowing measure to a predeclared
  endpoint with its own floors, power analysis and claim boundary.

  **One thing to fix before P1.** The card asks for worked examples from the
  archived gray-zone rows. Those rows live in the private archive and are not in
  this checkout, so the five examples are authored illustrations, marked as such
  in the file. Writing invented learner speech and presenting it as archived
  evidence would be fabrication. Replace them with real rows before reader
  calibration, keep the ones that still discriminate, and record any example the
  real transcripts contradict.

  `tests/tutorStubFrameRefuserNarrowingCodebook.test.js` pins the three marks and
  their directions, the tie-break with the agreement figures it answers, the
  present-versus-future endpoint boundary, the no-model-call gate, the open P0
  state, arm-denominator dispositions, and the authored-example status.

  The end-of-turn state rules were tightened before any reader call: prior open
  demands and their bounds carry forward until explicitly changed, concessions
  are cumulative while retained rather than counted only on the turn they first
  appear, and every assigned dialogue stays in the arm denominator with an
  explicit unscored disposition for persona exit or tutor non-delivery. P1 must
  predeclare and report arm-level missingness rather than using scorable-row
  spread alone to open the fresh-study gate.

  Next is completion of P0: replace the authored examples with the archived
  gray-zone rows and record any contradiction they expose. Only then may P1 run
  a three-seat reader calibration under its own explicit GO and spend ceiling.
  If the scale cannot be read reliably or does not spread between tutor
  versions, that is the finding and the card closes.

- 2026-08-29: **P0 complete, zero-call.** Read the archived v1–v4 calibration
  reports and their public transcripts from the private repository without
  making a reader or generation call. The cited v2 and v4 files were tracked
  and byte-identical to private archive commit
  `ea940aaec0fead44c6ed6a0a9c3bdb09b1cfff1a`. Replaced all five authored
  illustrations with exact public learner posts from rows where reader A voted
  rung 2 while the other two seats held the row at rung 1:
  `depth_reference_cal4_world_030_rowan_flat_r6`,
  `depth_treatment_cal_world_005_marrick_r6`,
  `depth_reference_cal_world_030_rowan_flat_r4`,
  `depth_treatment_cal4_world_030_rowan_flat_r10`, and
  `depth_reference_cal4_world_030_rowan_flat_r3`. Each example records its
  archive version, job id, learner post, all three narrowing marks, and the
  unchanged ladder rung.

  Source verification corrected an off-by-one mistake in the unfinished draft:
  the first transcription used each turn's incoming learner text rather than
  the report-cited public post produced after that turn. The final examples now
  use the report's exact post identifiers and transcript surfaces. Rebuilding
  the cumulative ledgers also exposed more retained state than the draft had
  counted: the examples score `(open demands, tightness, concessions)` as
  `(1,3,2)`, `(2,3,2)`, `(2,3,1)`, `(1,3,2)`, and `(1,3,3)` respectively.

  The real rows refine the codebook in two ways. A bound can be decisive without
  being numeric — “one crucible alone” is a tightness-3 pass/fail line — and
  readers must carry forward earlier demands and concessions even when the
  dissenting evidence span quotes only the final post. The selected disagreement
  rows do not supply the draft's explicit demand-withdrawal or bare “run it and
  tell me” examples. Those invented lines were removed rather than passed off as
  archive evidence; their associated counting rules remain hypotheses for P1.

  No P1 reader call is authorized. The card remains active because its next
  step is paid instrument calibration on archived rows under a separate,
  literal GO and spend ceiling. The narrowing scale remains report-only beside
  the sealed engagement ladder in the satisfiable-condition study.
