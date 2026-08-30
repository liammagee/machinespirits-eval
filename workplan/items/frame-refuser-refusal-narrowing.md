---
id: frame-refuser-refusal-narrowing
title: Measure whether condition discharge narrows the frame-refuser's refusal
status: active
type: experiment
priority: P2
owner: codex
source: manual
created: 2026-08-27
updated: 2026-08-30
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
    - config/tutor-stub-frame-refuser-narrowing-instrument.v1.md
    - config/tutor-stub-frame-refuser-narrowing-calibration-design.v1.json
tags:
  - tutor-stub
  - resistant-learners
  - frame-refusal
  - engagement-ladder
branch: codex/frame-refuser-narrowing-p1-recovery
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

- 2026-08-29: **P0 complete, zero-call.** Replaced all five authored
  illustrations with literal public learner turns from five of the six v4 rows
  where the three-seat panel split 2–1 between rungs 1 and 2. The codebook now
  records the private archive commit, report hash, per-transcript hashes, job
  ids, turn numbers, and all three narrowing marks without copying full paid
  artifacts into this repository.

  The real rows contradict three conveniences in the draft: this seed set has
  no unbounded tightness-0 refusal, no explicit demand withdrawal, and no bare
  “run it and tell me” request. More importantly, one report evidence span came
  from a nested `public_learner_surface` rendering that differs from the literal
  public learner turn. The codebook now requires P1 packets to use and
  exact-match literal `turns[].learner` text; later omission does not silently
  close an earlier demand.

  No P1 reader call is authorized. The card remains active for the separately
  registered three-seat calibration, with its own explicit GO and spend
  ceiling. If its sample cannot demonstrate the missing states, readers cannot
  meet the agreement floors, or the measure does not spread, that is the
  finding and the card closes.

- 2026-08-29: **Post-merge source correction, zero-call.** A runtime audit after
  P0 merged found that its evidence check had reversed the final learner-turn
  mapping. `state.turns[].learner` is the learner input before that row's tutor
  response; the semantic packet's final `post_horizon` is the newly generated
  learner response after the final tutor turn. The report-cited
  `public_learner_surface` is therefore the correct final public post, not a
  nested rendering to discard.

  The codebook now uses the report's exact `post_N` surfaces for five archived
  A=2, B=1, C=1 disagreement rows across v2 and v4. Their cumulative
  `(open demands, tightness, concessions)` scores are `(1,3,2)`, `(2,3,2)`,
  `(2,3,1)`, `(1,3,2)`, and `(1,3,3)`. A direct regression test pins the packet
  order so a stored incoming learner turn cannot again be mistaken for the
  learner response generated after the final tutor turn.

  No P1 reader call is authorized. The card remains active for the separately
  registered three-seat calibration under its own explicit GO and spend
  ceiling; this correction changes neither that gate nor the sealed engagement
  ladder.

- 2026-08-30: **P1 registration and launcher implemented, zero-call.** The
  prospective design fixes a 24-row archived sample before reading: six rows
  from each of v1-v4, twelve per arm, and twelve per world, selected by the
  registered seed. Three independent low-effort seats (Sol, Sonnet 5, and Opus
  5) each receive only a blind case id, the rule-only reader instrument, and the
  public dialogue packet. Each seat gets one attempt per row with no automatic
  retry, for 72 planned calls and a fail-before-call maximum of 72 attempts.

  Agreement must reach a 0.90 eligible-row rate for every seat and 0.80 exact
  pairwise agreement for dispositions, all three marks, and first-to-last
  direction, with at least 20 paired direction rows. The separate spread gate
  requires at least eight scorable rows per arm, three distinct final-state
  tuples, 0.25 assigned-row movement, and an absolute assigned-row narrower-rate
  gap of 0.15. Only both gates passing can open design work for a fresh study;
  the archived rows remain instrument-building evidence and can never become a
  confirmatory result.

  The shared paid-study launch contract supplies the create-once private
  destination, per-call reservation ledger, and 72-attempt ceiling. A complete
  dry run byte-verified all four reports and all 24 selected transcripts against
  private archive commit `7c8c8130e0d19431694c222af8cd9b0dd7e2a360`,
  resolved the three exact routes, and executed zero model calls. The paid block
  remains unlaunched: this design grants no call authority, and the proposed
  numerical ceiling still needs the user's confirmation in the signed GO note
  after the design and launcher merge.

- 2026-08-30: **P1 launched under the user's exact GO; paused on one technical
  transport failure.** The merged design/launcher commit is
  `762dc030f3e7cacefd0041fcaacacfcb9f1bc308`; the signed GO note is
  `notes/2026-08-30-frame-refuser-narrowing-p1-go.md` at
  `e6f1830e396a26214c1167ab606bee04e265d55f`, with a maximum of 72 model
  attempts. The clean detached launch passed the registered safety checks and
  zero-call preflight, then wrote its create-once run under the private archive
  at `artifacts/tutor-stub-live/frame-refuser-narrowing-p1-2026-08-30`.

  The launcher stopped and sealed the run after reserving 11 attempts: ten
  reader records completed, and `nrw_004/reader_b` failed before producing a
  structured response with the transport classification
  `response_free_error (result_error_without_structured_output)`. The failed
  assignment is retained and will not be retried. The original root, its result
  files, failure record, and append-only ledger remain unchanged; model activity
  is inactive.

  This corrective branch adds bounded missing-only recovery. It revalidates the
  original plan, sealed failure ledger, packet and route provenance, and all ten
  stored reader measurements; excludes those ten completed assignments and the
  failed assignment; and admits only the 61 never-attempted assignments into a
  fresh create-once destination. The recovery launch cap is 61, so the two
  destinations can reserve no more than the original combined ceiling of 72.
  The code and zero-call checks do not themselves resume model activity. If a
  transport failure repeats during the recovery launch, the recovery seals and
  stops for human review rather than opening another automatic continuation.
