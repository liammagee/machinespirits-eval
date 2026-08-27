# Frame-refuser depth study — registration, revision 4 (zero-call)

Date: 2026-08-27. Workplan item: `frame-refuser-depth-study`.
Design file: `config/tutor-stub-frame-refuser-depth-design.v4.json` (revision 4).
Supersedes: `notes/2026-08-27-frame-refuser-depth-registration-v3.md`
(revision 3), which stays in the repo as provenance, as do revisions 1 and 2.
Status: prospective design. This note authorizes no model call.

## Why a revision 4 exists — full disclosure

The revision-3 Gate 1 calibration ran on 2026-08-27 and **failed its own
gates before any powered run**. The complete failed run is archived at
`../machinespirits-eval-private/artifacts/tutor-stub-live/frame-refuser-depth-gate1-v3-2026-08-27`
and none of its rows are reused, pooled, or resampled here. The run
accounted for all 36 units: 14 complete, 22 retained typed failures, 0
technical failures, 743 of 7,128 reservations spent. Two things failed:

1. **Quote-echo trap (new in revision 3; 0 such exhaustions in revision 2,
   5 in revision 3).** The revision-3 treatment adjudication banned the
   standing-precondition formula by name — but wrote no rule for words the
   tutor *quotes from the learner*. The frame-refuser's own scripted
   condition-naming line IS that formula ("Before your question can stand,
   we must assay whether a shilling's debased alloy matches the leavings of
   one crucible alone…"). A tutor restating the learner's condition by
   quoting that sentence handed the adjudicator the banned surface in the
   tutor's turn: 4 of 5 exhausted treatment drafts quoted the line verbatim
   and were rejected for it. One draft that dropped the quote passed
   ("…the repair notebook is the exhibit, and I am ready to run that check
   in it now."), which shows the registered move is deliverable — the
   instrument was rejecting the echo, not the move. Fix, from both sides:
   the instruction now requires the restatement **in the tutor's own
   words** (no word-for-word repetition of the learner's sentence), and the
   adjudication question now judges **only the tutor's own voice** —
   words the candidate explicitly quotes or attributes to the learner do
   not count as the tutor's use of a banned formula, while the required
   restatement must not itself be such a quote.
2. **Attrition outran the plan (gates `determinate_outcome` and
   `eligible_vote_rate`, 7 completed per arm vs the floor of 8).** The
   36-dialogue plan absorbed 22 retained typed failures — 61 percent,
   against 39 percent in the revision-2 run. Beyond the 5 quote-echo
   exhaustions, the trace diagnosis found two pre-existing channels the
   revision-3 wording never touched: scripted-learner noncompliance
   (`tutor_stub_learner_noncompliance`, 6 revision-2 → 8 revision-3) and
   reference-arm delivery exhaustion
   (`tutor_stub_tutor_bounded_test_non_delivery`, 4 → 8, instruction
   unchanged between the two runs — draw noise is not excluded). Fix:
   revision 4 plans **48 dialogues (24 per arm, 12 per world per arm)**
   with every gate constant and floor unchanged. At the revision-3
   attrition rate (0.39 completion) the expected completed count per arm is
   9.4; at the revision-2 rate (0.61) it is 14.6; the floor of 8 is
   reachable under both. No floor moves, so the resize cannot relax any
   registered standard — it only buys room for the failure classes the
   sealed machinery is known to produce.

The treatment delivery-rate gate (13/18 adjudicated turns = 0.72 vs 0.8)
and the treatment bridge-read bound (1/7 vs 0.1) failed as arithmetic
consequences of the same exhaustions and the small completed denominator;
no gate logic changes. Pairwise endpoint agreement passed in both arms
(1.0 treatment, 0.857 reference), so the revision-2 instrument repairs
held.

Known issue, disclosed and not fixed here (carried from the revision-3
note): the shared analysis fallback can emit the literal summary
"Classifier returned non-JSON output." into the tutor's turn contract. The
generation path is shared with sealed studies, so it is not edited inside
this registration; the string is grep-able in transcripts and any affected
row will be reported.

## Question (unchanged)

In the sealed merged powered run (paper §6.28) the frame-refuser reached
rung 1 in 70 of 70 determinate dialogues but rung 2 in only 8 of 70 (0.114).
Does a tutor move that discharges the learner's named condition with
already-public evidence and re-offers the exact local test raise the rung-2
rate above the rate under the sealed standing-conditions bridge?

## Arms (treatment instruction amended in revision 4)

Both arms run the sealed face-B machinery unchanged: the
`frame_refuser-r1-rival-dag-v3` persona, the two worlds (Marrick, Rowan
Flat), the merged turn-gate trigger, the 8-post-trigger-turn horizon, the
plain register held fixed.

- **Treatment — condition discharge, committed voice, own words.** Restate
  the learner's named condition in one short clause **in your own words —
  never a word-for-word repetition or quotation of the learner's
  sentence**; present exactly one named already-public exhibit bearing on
  it; re-offer the exact same local test in one sentence in committed
  voice — state readiness to run it now on the named exhibit. Banned by
  name: asking what would give the question standing; any
  standing-precondition formula such as "before your question can have
  standing"; asking the learner what assay or test would establish the
  condition; private evidence.
- **Reference — standing-conditions bridge.** The sealed move, unchanged;
  its measured rung-2 rate of 0.114 is the anchor.

## Delivered-contrast floors (authoritative; constants unchanged)

Both floors read tutor text, never the assignment.

- **Treatment delivery rate ≥ 0.8** on adjudicated intervention turns, via
  the per-arm delivery adjudication on the generating path (one repair per
  episode; exhaustion is a typed non-delivery failure, never scored). The
  adjudication question now instructs the seat to judge only the tutor's
  own voice and to exempt explicit quotes of the learner, while requiring
  the restatement itself to be the tutor's own words.
- **Treatment bridge-read bound ≤ 0.1** on completed treatment rows, read
  by the blind three-seat fidelity panel (modal
  `delivered_test_bounded_distinction` = yes counts against the bound).
- **Reference cleanliness is enforced, certified, and reported — not
  gated** (unchanged; rationale in the revision-2 note).

## Endpoint and readers (unchanged)

Primary: proportion of determinate completed dialogues per arm with
`final_graded_engagement_rung` = 2, two-sided exact conditional test at
alpha 0.05. Secondary: rung ≥ 1 rate as a saturation check. Ladder, echo
guard, and the three-seat modal endpoint panel (Sol, Sonnet, Opus; modal
value across eligible medium/high-confidence votes; 0.8 pairwise floor) are
the sealed instruments, unchanged. Endpoint seats see the public transcript
only.

## Calibration (Gate 1, needs its own typed approval)

48 dialogues: 24 per arm, 12 per world per arm, sha256-ranked balanced
allocation, master seed **2026082901** (fresh for revision 4 so no
revision-1, revision-2, or revision-3 assignment is re-drawn; case ids
carry a `cal4` stem so no id collides with any archived run). Authoritative
gates (constants unchanged from revision 2):

- determinate-outcome rate 0.8 (floor 8)
- eligible-vote rate 0.8 per seat and instrument (floor 8)
- pairwise exact endpoint agreement 0.8
- treatment delivery rate 0.8 on adjudicated intervention turns
- treatment bridge-read bound 0.1 on completed treatment rows
- zero confirmed prohibited deliveries
- jurisdiction retained on 0.67 of completed rows (floor 6)

Registered purpose: update the power table's reference rate for sizing; not
an interim outcome analysis. Kill rule: stop before a powered run if any
gate fails or the treatment arm shows zero adjudicated deliveries. No floor
is relaxed after data.

## Power scan and sizing rule (unchanged)

Registered alternative: treatment rung-2 rate 0.35. Sizing rule for the
powered run (Gate 2, its own typed approval): the smallest n per arm in
{42, 48, 54, 60, 72, 84, 90} whose exact power against 0.35, computed at the
calibration-updated reference rate, reaches 0.80 (60 per arm at the design
base of 0.114). If no n at or below 90 reaches 0.80, the study stops and
reports infeasible at ceiling. A null licenses "no lift to 0.35 or beyond at
this size," nothing stronger.

## Dispositions, ceilings, models

Measurement-indeterminate units are retained and stopped, never repaired,
rerun, replaced, or recoded. A technical failure halts the block. No valid
unit is rerun; no outcome selection; no pooling of calibration rows into the
powered run; no row from any failed calibration is reused. Ceilings scale
with the resize at the registered per-dialogue rates: 64 planned calls per
dialogue (fail-before-call), **3,072** planned calls for calibration
(48 × 64), at most 3 reservations per planned call plus the per-dialogue
authorization headroom of 6 (**9,504** reservations, 198 per dialogue —
the same per-dialogue ceiling as every prior revision). Generation stack
held to the sealed one (codex.gpt-5.6-luna tutor and learner, low effort)
so the reference arm stays comparable with the measured 0.114.

## Authority

This design grants no model calls. Each gate starts on one attended
invocation with TTY-only typed operator approval recorded in approval.json
(calibration phrase: `APPROVE CALIBRATION 9504`). The launch preflight
refuses all three superseded design files, so no failed registration can be
rerun by accident. Provenance (source commit, tree, dirty flag) is recorded
in plan.json and never enforced: the approval covers the study — question,
arms, endpoint, floors, ceilings — and a code-defect fix does not void it.
No GO note, commit binding, source-file byte pin, approval schema version,
or re-signature cycle is used.
