# Frame-refuser depth study — registration (zero-call)

Date: 2026-08-26. Workplan item: `frame-refuser-depth-study`.
Design file: `config/tutor-stub-frame-refuser-depth-design.v1.json` (revision 1).
Status: prospective design. This note authorizes no model call.

## Question

In the sealed merged powered run (paper §6.28) the frame-refuser reached
rung 1 — adding a new condition, implication, or missing-result requirement
for the offered local test — in 70 of 70 determinate dialogues, but reached
rung 2 — actually beginning or committing now to that exact test, wider
reservation unretracted — in only 8 of 70 (0.114). The registered endpoint is
saturated one rung below the interesting variation.

The question: does a tutor move that discharges the learner's named condition
with already-public evidence and re-offers the exact local test raise the
rung-2 rate above the rate under the sealed standing-conditions bridge?

## Arms

Both arms run the sealed face-B machinery unchanged: the
`frame_refuser-r1-rival-dag-v3` persona, the two worlds (Marrick, Rowan
Flat), the merged turn-gate trigger, the 8-post-trigger-turn horizon, and the
plain register held fixed in both arms.

- **Treatment — condition discharge.** On the first registered intervention
  tutor turn after the trigger, the tutor restates the learner's named
  condition in one clause, presents one named already-public exhibit that
  bears on that condition, and re-offers the same local test in the same
  turn. It does not ask what would give its question standing and it
  introduces no private evidence.
- **Reference — standing-conditions bridge.** The sealed move, unchanged:
  name the disputed standing, ask what would give the question standing,
  offer one bounded distinction. Its measured rung-2 rate is the 0.114
  anchor.

## Delivered-contrast floors (authoritative)

The two arms must show different delivered behaviour, read from tutor text by
the per-arm delivery adjudication, never from the assignment. Treatment
delivery rate at least 0.8; reference contamination (an intervention turn
that presents an exhibit toward the named condition) at most 0.1. Both
instructions are read by code on the generating path through the sealed
delivery-enforcement mechanism, one repair per episode, exhaustion retained
as a typed non-delivery failure that is never scored. These floors carry the
two delivery lessons from the closed boredom line: v7 delivered one behaviour
twice and its gate compared the assignment with its own copy; v8's reference
instruction was read by nothing and one dialogue in five broke it.

## Endpoint and readers

Primary: the proportion of determinate completed dialogues per arm with
`final_graded_engagement_rung` = 2, compared by a two-sided exact conditional
test at alpha 0.05. Secondary: the rung>=1 rate per arm as a saturation
check. The ladder, echo guard, and two-seat endpoint panel (Sol and Sonnet,
both eligible medium/high-confidence votes must agree per field, 0.8
pairwise-agreement floor) are the sealed instruments, unchanged. Endpoint
seats see the public transcript only; the arm assignment is never shown to
them.

## Calibration (Gate 1, needs its own signed approval)

20 dialogues: 10 per arm, 5 per world per arm, sha256-ranked balanced
allocation, master seed 2026082601. Authoritative gates: determinate-outcome
rate 0.8 (floor 8), eligible-vote rate 0.8 per seat (floor 8), pairwise
endpoint agreement 0.8, the two delivered-contrast floors above, zero
confirmed prohibited deliveries, jurisdiction retained on 0.67 of completed
rows (floor 6). The calibration's registered purpose is to update the power
table's reference rate for sizing; that is not an interim outcome analysis of
a powered question. Kill rule: stop before a powered run if any gate fails or
if the treatment arm shows zero adjudicated deliveries. No floor is relaxed
after data.

## Power scan and sizing rule

Exact two-sided Fisher power at alpha 0.05 against reference rate 0.114:

| n per arm | 0.25 | 0.30 | 0.35 | 0.40 | 0.45 |
|-----------|------|------|------|------|------|
| 36 | 0.228 | 0.398 | 0.581 | 0.743 | 0.864 |
| 42 | 0.286 | 0.483 | 0.675 | 0.826 | 0.921 |
| 48 | 0.309 | 0.530 | 0.731 | 0.873 | 0.951 |
| 54 | 0.349 | 0.584 | 0.785 | 0.911 | 0.971 |
| 60 | 0.398 | 0.643 | 0.833 | 0.939 | 0.983 |

Registered alternative: treatment rung-2 rate 0.35. Sizing rule for the
powered run (Gate 2, its own signed approval): the smallest n per arm in
{42, 48, 54, 60, 72, 84, 90} whose exact power against 0.35, computed at the
calibration-updated reference rate, reaches 0.80. At the design base of
0.114 that is 60 per arm. If no n at or below 90 reaches 0.80, the study
stops and reports infeasible at ceiling. A lift to 0.25 is not detectable at
feasible sizes and is outside this design's claim boundary: a null licenses
"no lift to 0.35 or beyond at this size," nothing stronger.

## Dispositions, ceilings, models

Measurement-indeterminate units are retained and stopped, never repaired,
rerun, replaced, or recoded. A technical failure halts the block. No valid
unit is rerun; no outcome selection; no pooling of calibration rows into the
powered run. Call ceilings carry the sealed plan: 64 planned calls per
dialogue as a fail-before-call ceiling, 1,280 planned calls for calibration,
at most 3 reservations per planned call (3,960 reservations). Generation
stack held to the sealed one (codex.gpt-5.6-luna tutor and learner, low
effort) so the reference arm stays comparable with the measured 0.114.

## Authority

This design grants no model calls. Each gate starts on one attended
invocation with TTY-only typed operator approval recorded in approval.json.
Provenance (source commit, tree, dirty flag) is recorded in plan.json and
never enforced: the approval covers the study — question, arms, endpoint,
floors, ceilings — and a code-defect fix does not void it.
