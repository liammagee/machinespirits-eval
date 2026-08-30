# Frame-refuser depth study — registration, revision 5 (zero-call)

Date: 2026-08-29. Workplan item: `frame-refuser-depth-study`.
Design file: `config/tutor-stub-frame-refuser-depth-design.v5.json` (revision 5).
Supersedes: `notes/2026-08-27-frame-refuser-depth-registration-v4.md`
(revision 4), which stays in the repo as provenance, as do revisions 1-3.
Status: prospective design. This note authorizes no model call.

## Why a revision 5 exists — full disclosure

The revision-4 Gate 1 calibration ran on 2026-08-27 and **failed its own
gates before any powered run**. The complete failed run is archived at
`../machinespirits-eval-private/artifacts/tutor-stub-live/frame-refuser-depth-gate1-v4-2026-08-27`
and none of its rows are reused, pooled, recoded, or resampled here. The
run accounted for all 48 units: 29 complete (14 treatment, 15 reference),
19 retained typed failures, 0 technical failures, 1,266 of 9,504
reservations spent. The revision-4 resize did its job on the generation
side — 29 completed against 14 in revision 3, clearing the floors of 8 —
and this time every failure is instrument-side. Three things failed:

1. **Null-evidence contract violation (sonnet seat; gate
   `eligible_vote_rate`).** The sealed `claude-code.sonnet-5` seat attached
   supporting `evidence_quotes` arrays to no-votes, where the registered
   evidence contract demands JSON null. The checker voided every such vote
   as `evidence_invalid`: 29 of 29 `whole_frame_compliance` votes in both
   arms and 4 of 14 treatment `delivered_test_bounded_distinction` votes.
   The votes themselves were stated — the seat judged and then formatted
   against the contract, exactly the class of slip the sealed echo-slip
   tolerance already recognizes for the case-id echo. Fix, in merged
   registration v6 (all in the registration, none in the checker's
   standards): the evidence instruction now states outright that null
   means the JSON literal null and that a no-vote carrying any quotes
   array is discarded; the per-field output schema restates the rule at
   the exact place the seat structures its answer; and a registered
   **evidence-null slip tolerance** grants one byte-identical re-ask when
   that slip is the only field defect, with a second failure leaving the
   field ineligible. No prompt content changes on retry; the tolerance is
   recorded on the seat record like the echo-slip flag.
2. **Rung-boundary splits (sol seat; gate
   `pairwise_exact_endpoint_agreement`, 0.714-0.800 against the 0.8
   floor).** The endpoint split on 9 of 29 completed rows. Six splits were
   single-seat deviations by `codex.gpt-5.6-sol`, bidirectional (both
   above and below the majority — a vague boundary, not a calibration
   offset), and seven of the nine sat in `world_030_rowan_flat`. Every
   seat pair involving sol landed at 0.714, 0.714, 0.733, or 0.800, while
   the sonnet-opus pairs read 0.857 and 0.933. Fix: registration v6 adds
   three worked examples anchoring the disputed boundaries — a
   1-versus-2 example (different exhibit applied, decisive event still
   unproved) and a 0-versus-1 example (new missing-result requirement
   layered on an already-public condition) drawn from the archived split
   rows, plus one committed-voice rung-2 anchor. The rungs, rung anchors,
   echo guard, and endpoint definition do not move.
3. **Quoted-formula bridge reads (gate `treatment_bridge_read_rate`, 2 of
   14 against the 0.1 bound).** Both bridge reads came from treatment
   turns that quoted the learner's standing formula back at it — turns
   the delivery adjudicator passed under revision 4's own-voice
   carve-out, which was itself the fix for the revision-3 quote-echo
   trap. The carve-out solved that trap and re-opened the revision-2
   door: the blind outcome panel reads the turn without attribution, so a
   quoted standing formula is a standing formula on the page. Fix: the
   revision-5 treatment instruction bans the formula **wherever it
   appears in the turn** — the tutor's own voice, quotation marks, or
   words attributed to the learner — and the adjudication question fails
   delivery on any appearance, while the required restatement must name
   the condition's content without reproducing the learner's sentence.
   The learner's condition itself stays quotable in substance: the tutor
   refers to "the condition you have named" or restates it in its own
   words, which the one passing revision-3 exhaustion draft already
   showed is deliverable.

No gate constant, floor, ceiling, sizing rule, or disposition moves in
this revision. The three fixes are: one registration amendment (v6) for
the two reader defects, and one instruction-plus-question rewrite for the
delivery defect.

Registration v6 discloses its own diff: rungs, rung anchors, echo guard,
endpoint definition, consensus, judges, visibility, dispositions, and the
calibration decision policy are byte-identical to v5 (the decision-policy
canonical sha is unchanged in the frozen registry row); what moves is the
evidence-contract prompt instruction, the new evidence-null slip
tolerance, the per-field schema restatement, and the three face-B worked
examples. The runtime registry additionally pins the v6 evidence
instruction text itself, so the amendment's core surface is fail-closed
against drift.

Known issue, disclosed and not fixed here (carried from the revision-3
and revision-4 notes): the shared analysis fallback can emit the literal
summary "Classifier returned non-JSON output." into the tutor's turn
contract. The generation path is shared with sealed studies, so it is not
edited inside this registration; the string is grep-able in transcripts
and any affected row will be reported.

## Question (unchanged)

In the sealed merged powered run (paper §6.28) the frame-refuser reached
rung 1 in 70 of 70 determinate dialogues but rung 2 in only 8 of 70 (0.114).
Does a tutor move that discharges the learner's named condition with
already-public evidence and re-offers the exact local test raise the rung-2
rate above the rate under the sealed standing-conditions bridge?

## Arms (treatment instruction amended in revision 5)

Both arms run the sealed face-B machinery unchanged: the
`frame_refuser-r1-rival-dag-v3` persona, the two worlds (Marrick, Rowan
Flat), the merged turn-gate trigger, the 8-post-trigger-turn horizon, the
plain register held fixed.

- **Treatment — condition discharge, committed voice, formula banned
  everywhere.** Restate the learner's named condition in one short clause
  in your own words — never repeat, quote, or attribute back the
  learner's condition-naming sentence; present exactly one named
  already-public exhibit bearing on it; re-offer the exact same local
  test in one sentence in committed voice — state readiness to run it now
  on the named exhibit. Banned by name: asking what would give the
  question standing; asking the learner what assay or test would
  establish the condition; private evidence; and any standing-precondition
  formula such as "before your question can have standing" **anywhere in
  the turn — own voice, quotation marks, or words attributed to the
  learner**.
- **Reference — standing-conditions bridge.** The sealed move, unchanged;
  its measured rung-2 rate of 0.114 is the anchor.

## Delivered-contrast floors (authoritative; constants unchanged)

Both floors read tutor text, never the assignment.

- **Treatment delivery rate ≥ 0.8** on adjudicated intervention turns, via
  the per-arm delivery adjudication on the generating path (one repair per
  episode; exhaustion is a typed non-delivery failure, never scored). The
  adjudication question now fails delivery on any appearance of a
  standing-precondition formula — the revision-4 own-voice carve-out is
  removed, because the blind outcome panel reads without attribution.
- **Treatment bridge-read bound ≤ 0.1** on completed treatment rows, read
  by the blind fidelity panel (modal
  `delivered_test_bounded_distinction` = yes counts against the bound).
- **Reference cleanliness is enforced, certified, and reported — not
  gated** (unchanged; rationale in the revision-2 note).

## Endpoint and readers (panel protocol amended to registration v6)

Primary: proportion of determinate completed dialogues per arm with
`final_graded_engagement_rung` = 2, two-sided exact conditional test at
alpha 0.05. Secondary: rung ≥ 1 rate as a saturation check. Ladder, echo
guard, endpoint definition, and the three-seat modal endpoint panel (Sol,
Sonnet, Opus; modal value across eligible medium/high-confidence votes;
0.8 pairwise floor) are unchanged. Endpoint seats see the public
transcript only. What changes is the panel's registered protocol source:
`config/tutor-stub-resistant-learner-merged-semantic-registration.v6.json`,
whose amendments over v5 are exactly the evidence-instruction sharpening,
the per-field schema restatement, the one-retry evidence-null slip
tolerance, and the three added face-B worked examples described above.
The depth arm projection carries this protocol source onto the sealed
face-B machinery; the parent design's own sealed pointer stays on v5 for
replay of the sealed runs.

## Calibration (Gate 1, needs its own typed approval)

48 dialogues: 24 per arm, 12 per world per arm, sha256-ranked balanced
allocation, master seed **2026083001** (fresh for revision 5 so no
revision-1, revision-2, revision-3, or revision-4 assignment is re-drawn;
case ids carry a `cal5` stem so no id collides with any archived run).
Authoritative gates (constants unchanged from revision 2):

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
powered run; no row from any failed calibration is reused. Ceilings are
unchanged from revision 4: 64 planned calls per dialogue
(fail-before-call), **3,072** planned calls for calibration (48 × 64), at
most 3 reservations per planned call plus the per-dialogue authorization
headroom of 6 (**9,504** reservations, 198 per dialogue — the same
per-dialogue ceiling as every prior revision). The evidence-null slip
retry spends from the same sealed reservation ceilings; it adds no new
call authority. Generation stack held to the sealed one
(codex.gpt-5.6-luna tutor and learner, low effort) so the reference arm
stays comparable with the measured 0.114.

## Authority

This design grants no model calls. Each gate starts on one attended
invocation with TTY-only typed operator approval recorded in approval.json
(calibration phrase: `APPROVE CALIBRATION 9504`). The launch preflight
refuses all four superseded design files, so no failed registration can be
rerun by accident. Provenance (source commit, tree, dirty flag) is recorded
in plan.json and never enforced: the approval covers the study — question,
arms, endpoint, floors, ceilings — and a code-defect fix does not void it.
No GO note, commit binding, source-file byte pin, approval schema version,
or re-signature cycle is used.
