# Frame-refuser depth study — registration, revision 2 (zero-call)

Date: 2026-08-27. Workplan item: `frame-refuser-depth-study`.
Design file: `config/tutor-stub-frame-refuser-depth-design.v2.json` (revision 2).
Supersedes: `notes/2026-08-26-frame-refuser-depth-registration.md` (revision 1),
which stays in the repo as provenance.
Status: prospective design. This note authorizes no model call.

## Why a revision 2 exists — full disclosure

The revision-1 Gate 1 calibration ran on 2026-08-27 and **failed its own
gates before any powered run**. The complete failed run is archived at
`../machinespirits-eval-private/artifacts/tutor-stub-live/frame-refuser-depth-gate1-2026-08-27`
and none of its rows are reused, pooled, or resampled here. Three instrument
defects were found in the registration itself; revision 2 is a fresh
registration that fixes them and is disclosed as such. No registered floor is
relaxed inside a study: the changed gate below belongs to this new
registration, not to a rescored revision 1.

1. **Case-id echo defect.** Revision-1 case ids mixed hyphens and
   underscores (`depth-treatment-cal-world_005-r1`). The sealed reader seat
   (Sol) deterministically merged the hyphen-underscore boundary when echoing
   the id (`-cal-world_005` came back `-cal_world_005`) in 12 of 12 completed
   dialogues, and the sealed validator rightly voided every one of its votes.
   The eligible-vote, pairwise-agreement, and determinate gates failed in
   both arms as a direct consequence. Fix: revision-2 case ids are
   underscore-only lowercase (`depth_treatment_cal_world_005_r1`), the design
   registers `caseIdRule: underscore_only_lowercase`, the plan builder
   refuses any other shape, and the launch preflight re-checks every id.
2. **Floor sizing defect.** Revision 1 set determinate and eligible-vote
   floors of 8 against 10 planned dialogues per arm. The sealed face-B
   machinery retains about a third of dialogues as typed substantive
   failures (sealed face-B completion 64.8%; the failed run completed 7/10
   and 5/10). Floors of 8 were therefore near-unreachable even with a clean
   reader seat — the reference arm's jurisdiction floor of 6 was arithmetic-
   impossible at 5 completed rows. Fix: revision 2 plans 36 dialogues, 18
   per arm, 9 per world per arm. At the sealed completion base rate the
   probability of at least 8 completed rows per arm is about 0.98. The
   floors themselves are unchanged.
3. **Contamination double-count defect.** The revision-1 gate
   `reference_contamination_bound` counted adjudicated non-deliveries
   against the 0.1 contamination bound. A typed non-delivery is already
   retained as a substantive failure; counting it again as contamination
   charged one event twice, and the failed run's 2 reference non-deliveries
   (in 9 adjudicated) tripped the gate with zero actual exhibits presented.
   Fix below under "Delivered-contrast floors".

The one-line summary of the failed run: every gate that failed traced to the
instrument (id echo, floor arithmetic, gate denominator), not to the tutor or
the learner. Delivery itself worked — treatment delivered 10/10 adjudicated
turns; the blind panel read 0 of 7 completed treatment rows as the bridge
move.

## Question (unchanged from revision 1)

In the sealed merged powered run (paper §6.28) the frame-refuser reached
rung 1 in 70 of 70 determinate dialogues but rung 2 in only 8 of 70 (0.114).
Does a tutor move that discharges the learner's named condition with
already-public evidence and re-offers the exact local test raise the rung-2
rate above the rate under the sealed standing-conditions bridge?

## Arms (unchanged from revision 1)

Both arms run the sealed face-B machinery unchanged: the
`frame_refuser-r1-rival-dag-v3` persona, the two worlds (Marrick, Rowan
Flat), the merged turn-gate trigger, the 8-post-trigger-turn horizon, the
plain register held fixed.

- **Treatment — condition discharge.** Restate the learner's named condition
  in one clause, present one named already-public exhibit bearing on it, and
  re-offer the same local test in the same turn. No standing question, no
  private evidence.
- **Reference — standing-conditions bridge.** The sealed move, unchanged;
  its measured rung-2 rate of 0.114 is the anchor.

## Delivered-contrast floors (authoritative; changed in revision 2)

Both floors read tutor text, never the assignment.

- **Treatment delivery rate ≥ 0.8** on adjudicated intervention turns, via
  the per-arm delivery adjudication on the generating path (one repair per
  episode; exhaustion is a typed non-delivery failure, never scored).
  Unchanged from revision 1.
- **Treatment bridge-read bound ≤ 0.1** on completed treatment rows — NEW.
  A completed treatment row whose blind three-seat fidelity panel reads the
  committed intervention turn as the sealed bounded-distinction bridge
  (modal `delivered_test_bounded_distinction` = yes) counts against the
  bound. This catches the v7 defect class — the two arms converging on one
  delivered behaviour — through an instrument independent of the delivery
  adjudicator, and it replaces the revision-1 contamination gate.
- **Reference cleanliness is enforced, certified, and reported — not
  gated.** The bundled reference adjudication question forbids presenting an
  exhibit toward the named condition, so a completed reference row exists
  only after the delivery seat certified the turn bridge-without-exhibit.
  The per-row certificate count is reported (`completed_delivery_certified`).
  A gate on top of this enforcement could fail only by re-counting typed
  failures, which is defect 3 above; a gate that cannot otherwise fail is
  ceremony.

## Endpoint and readers (unchanged from revision 1)

Primary: proportion of determinate completed dialogues per arm with
`final_graded_engagement_rung` = 2, two-sided exact conditional test at
alpha 0.05. Secondary: rung ≥ 1 rate as a saturation check. Ladder, echo
guard, and the three-seat modal endpoint panel (Sol, Sonnet, Opus; modal
value across eligible medium/high-confidence votes; 0.8 pairwise floor) are
the sealed instruments, unchanged. Endpoint seats see the public transcript
only.

## Calibration (Gate 1, needs its own typed approval)

36 dialogues: 18 per arm, 9 per world per arm, sha256-ranked balanced
allocation, master seed **2026082701** (fresh for revision 2 so no
revision-1 assignment is re-drawn). Authoritative gates:

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

## Power scan and sizing rule (unchanged from revision 1)

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
powered run; no row from the failed first calibration is reused. Ceilings:
64 planned calls per dialogue (fail-before-call), **2,304** planned calls
for calibration (36 × 64), at most 3 reservations per planned call
(**7,128** reservations). Generation stack held to the sealed one
(codex.gpt-5.6-luna tutor and learner, low effort) so the reference arm
stays comparable with the measured 0.114.

## Authority

This design grants no model calls. Each gate starts on one attended
invocation with TTY-only typed operator approval recorded in approval.json
(calibration phrase: `APPROVE CALIBRATION 7128`). The launch preflight
refuses the superseded revision-1 design file, so the failed registration
cannot be rerun by accident. Provenance (source commit, tree, dirty flag) is
recorded in plan.json and never enforced: the approval covers the study —
question, arms, endpoint, floors, ceilings — and a code-defect fix does not
void it. No GO note, commit binding, source-file byte pin, approval schema
version, or re-signature cycle is used.
