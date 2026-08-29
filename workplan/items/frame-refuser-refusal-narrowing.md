---
id: frame-refuser-refusal-narrowing
title: Measure whether condition discharge narrows the frame-refuser's refusal
status: active
type: experiment
priority: P2
owner: claude
source: manual
created: 2026-08-27
updated: 2026-08-29
verification: >-
  A written narrowing codebook exists before any reader call. Reader
  calibration on archived transcripts passes registered agreement floors
  under its own signed approval and spend ceiling. A fresh registered
  contrast runs only if the scale shows spread on archived rows, with its
  own endpoint, floors, power scan, and attended approval. Archived rows
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
- P1 (small paid block, own approval): three-seat reader calibration on a
  sampled slice of archived rows; registered agreement floors; report
  whether the scale spreads between the two tutor versions.
- Gate: fresh registered contrast on fresh dialogues only if P1 shows
  spread and agreement.

## Log

- 2026-08-27: Card opened from the depth-study closeout. No model call is
  authorized; P0 is zero-call.
- 2026-08-29: **P0 done, zero-call.**
  `config/tutor-stub-frame-refuser-narrowing-codebook.v1.md` defines the three
  registered marks with their directions: open demands still standing at the
  end of a turn (lower is narrower), bound tightness on a 0–3 scale over the
  turn's narrowest demand (higher is narrower), and sub-claims conceded on the
  tutor's line (higher is narrower). Counting rules cover the cases that would
  otherwise be judged twice — a demand restated in narrower terms is one demand
  scored on tightness, a withdrawn demand is a concession rather than an open
  demand, and a concession on the wider frame is out of scope because a learner
  who abandons the frame has left the persona.

  The tie-break the readers needed is written plainly: a learner naming a bound
  while still withholding is rung 1 on the ladder, always. That is the cell
  where the fourth calibration failed pairwise agreement (0.714 and 0.733), and
  since the ladder is deliberately unamended the disagreement would otherwise
  recur. Under the codebook the same turn reads unambiguously as ladder rung 1
  with bound tightness 3.

  The codebook takes no authority over the ladder: it never converts to a
  ladder score, never breaks a ladder tie, and never enters a primary endpoint.
  Where a run carries both, the ladder is the endpoint and this is report-only.

  **One thing to fix before P1.** The card asks for worked examples from the
  archived gray-zone rows. Those rows live in the private archive and are not in
  this checkout, so the five examples are authored illustrations, marked as such
  in the file. Writing invented learner speech and presenting it as archived
  evidence would be fabrication. Replace them with real rows before reader
  calibration, keep the ones that still discriminate, and record any example the
  real transcripts contradict.

  `tests/tutorStubFrameRefuserNarrowingCodebook.test.js` (6 tests) pins the
  three marks and their directions, the tie-break with the agreement figures it
  answers, the four sentences disclaiming authority over the ladder, the
  no-model-call boundary with its stated null outcome, and that the examples
  stay marked as authored.

  Next is P1: three-seat reader calibration on a sampled slice of archived rows,
  under its own attended approval and spend ceiling. If the scale does not
  spread between the two versions of the tutor, that is the finding and the card
  closes.
