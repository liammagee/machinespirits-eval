# Frame-refuser depth study — registration, revision 3 (zero-call)

Date: 2026-08-27. Workplan item: `frame-refuser-depth-study`.
Design file: `config/tutor-stub-frame-refuser-depth-design.v3.json` (revision 3).
Supersedes: `notes/2026-08-27-frame-refuser-depth-registration-v2.md`
(revision 2), which stays in the repo as provenance, as does revision 1.
Status: prospective design. This note authorizes no model call.

## Why a revision 3 exists — full disclosure

The revision-2 Gate 1 calibration ran on 2026-08-27 and **failed its own
gates before any powered run**. The complete failed run is archived at
`../machinespirits-eval-private/artifacts/tutor-stub-live/frame-refuser-depth-gate1-v2-2026-08-27`
and none of its rows are reused, pooled, or resampled here. Every revision-2
plumbing fix held: underscore case ids restored Sol's echo (11 of 11
completed dialogues determinate in both arms), the resizing made every floor
reachable (11 completed plus 7 retained typed failures per arm), and the
reference arm passed every gate (0.909/0.909/1.0 pairwise, delivery
certified per row). What failed is the treatment instruction itself:

1. **Standing-formula wrapper defect (gate
   `treatment_bridge_read_bound`, 3/11 > 0.1).** The revision-2 instruction
   said what to include (condition, exhibit, re-offer) and banned asking
   what would give the question standing, but it did not fix the voice of
   the re-offer. The tutor delivered all three components and wrapped them
   in the reference move's standing formula — turns opening "Before your
   question can have standing…" and one ending "what assay shall test
   that?", the banned question in different words. The delivery seat
   certified 16/16 (components present); the blind fidelity panel read 3 of
   11 completed treatment turns as the sealed bounded-distinction bridge.
   Both readings are defensible — the turns are hybrids — and the gate did
   its registered job: it caught the v7 arm-convergence class before a
   powered run. Fix: the revision-3 instruction requires the re-offer **in
   committed voice** ("say that you are ready to run it now on the named
   exhibit") and bans the standing-precondition formula by name, alongside
   the existing bans. The treatment adjudication question is extended the
   same way, so delivery certification and the blind panel now read the
   same boundary.
2. **Pairwise endpoint near-miss (one seat pair 0.727 vs the 0.8 floor;
   the other pairs 0.818 and 0.909).** The disagreements sat partly on the
   hybrid turns above — one reader took a wrapped re-offer as movement, the
   other did not. No floor changes: removing the hybrid surface is the fix,
   and the reference arm (no hybrids) passed the same floor at
   0.909/0.909/1.0.

Known issue, disclosed and not fixed here: the shared analysis fallback can
emit the literal summary "Classifier returned non-JSON output." into the
tutor's turn contract, and in one revision-2 job the tutor spoke it in the
public turn. The generation path is shared with sealed studies, so it is not
edited inside this registration; the string is grep-able in transcripts and
any affected powered-run row will be reported.

The one-line summary of the failed run: the instrument worked, the
registered treatment instruction under-specified the voice of the re-offer,
and the tutor found the one surface that satisfied the delivery seat while
reading as the reference move to the blind panel.

## Question (unchanged)

In the sealed merged powered run (paper §6.28) the frame-refuser reached
rung 1 in 70 of 70 determinate dialogues but rung 2 in only 8 of 70 (0.114).
Does a tutor move that discharges the learner's named condition with
already-public evidence and re-offers the exact local test raise the rung-2
rate above the rate under the sealed standing-conditions bridge?

## Arms (treatment instruction rewritten in revision 3)

Both arms run the sealed face-B machinery unchanged: the
`frame_refuser-r1-rival-dag-v3` persona, the two worlds (Marrick, Rowan
Flat), the merged turn-gate trigger, the 8-post-trigger-turn horizon, the
plain register held fixed.

- **Treatment — condition discharge, committed voice.** Restate the
  learner's named condition in one short clause; present exactly one named
  already-public exhibit bearing on it; re-offer the exact same local test
  in one sentence **in committed voice — state readiness to run it now on
  the named exhibit**. Banned by name: asking what would give the question
  standing; any standing-precondition formula such as "before your question
  can have standing"; asking the learner what assay or test would establish
  the condition; private evidence.
- **Reference — standing-conditions bridge.** The sealed move, unchanged;
  its measured rung-2 rate of 0.114 is the anchor.

## Delivered-contrast floors (authoritative; unchanged from revision 2)

Both floors read tutor text, never the assignment.

- **Treatment delivery rate ≥ 0.8** on adjudicated intervention turns, via
  the per-arm delivery adjudication on the generating path (one repair per
  episode; exhaustion is a typed non-delivery failure, never scored). The
  adjudication question now carries the committed-voice and
  standing-formula clauses.
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

36 dialogues: 18 per arm, 9 per world per arm, sha256-ranked balanced
allocation, master seed **2026082801** (fresh for revision 3 so no
revision-1 or revision-2 assignment is re-drawn; case ids carry a `cal3`
stem so no id collides with either archived run). Authoritative gates
(constants unchanged from revision 2):

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
powered run; no row from either failed calibration is reused. Ceilings:
64 planned calls per dialogue (fail-before-call), **2,304** planned calls
for calibration (36 × 64), at most 3 reservations per planned call
(**7,128** reservations). Generation stack held to the sealed one
(codex.gpt-5.6-luna tutor and learner, low effort) so the reference arm
stays comparable with the measured 0.114.

## Authority

This design grants no model calls. Each gate starts on one attended
invocation with TTY-only typed operator approval recorded in approval.json
(calibration phrase: `APPROVE CALIBRATION 7128`, unchanged — the ceilings
did not move). The launch preflight refuses both superseded design files, so
neither failed registration can be rerun by accident. Provenance (source
commit, tree, dirty flag) is recorded in plan.json and never enforced: the
approval covers the study — question, arms, endpoint, floors, ceilings —
and a code-defect fix does not void it. No GO note, commit binding,
source-file byte pin, approval schema version, or re-signature cycle is
used.
