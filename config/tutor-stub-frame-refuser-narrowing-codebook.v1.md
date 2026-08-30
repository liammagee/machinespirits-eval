# Narrowing codebook — frame-refuser refusal, revision 1

Status: P0 complete, zero-call. The worked examples below use the literal
public learner turns from the archived v4 gray-zone rows named by the card.
This codebook licenses nothing. Whether the scale can be read reliably or
spreads between tutor versions is a later question with its own explicit GO and
spend ceiling.

- Workplan item: `frame-refuser-refusal-narrowing`
- Authorization policy: `docs/paid-study-authorization-policy.md`
- Sits beside, never replaces: the sealed engagement ladder in
  `config/tutor-stub-resistant-learner-merged-design.v5.json`
  (`populationStrata.faceB.measurement.rungs`)

## Why a second scale

The depth study closed on a firm null: no graded treatment dialogue in 38
reached rung 2. But the reader disagreement in its fourth calibration sat at
one place, and that place is informative. Readers split on learners who give
ground while still refusing — naming a pressure interval, weighing a bead
overlap, ranking what evidence would count. The ladder has no rung for that.
Rung 1 covers everything from a flat re-assertion with one new condition to a
learner who concedes four sub-claims and names a numeric bound, and rung 2
requires a performed or unconditionally committed test.

So the ladder answers one question — did the learner take the step — and
answers it correctly. It cannot answer a second: **did the refusal get
narrower?** This codebook is that second question, and nothing more.

**It is not a rung 1.5.** A narrowing score never converts to a ladder score
and never breaks a ladder tie. In the already registered satisfiable study,
the ladder remains the primary endpoint and narrowing is report-only. P1 is
instrument-building calibration on archived rows, not confirmatory evidence. A
later fresh registered study may promote a validated narrowing measure to a
predeclared endpoint; that choice belongs in that future design, with its own
floors, power analysis and claim boundary, not in this codebook.

## What counts as narrowing

A refusal narrows when the learner asks for less, asks for it more precisely,
or gives more away, while still refusing. The three marks are end-of-turn
states reconstructed from the public transcript alone. Readers carry the
state forward from the trigger turn; they do not treat each turn as an
independent bag of new statements.

### Mark 1 — open demands (count, lower is narrower)

The number of **distinct** things the learner has said must be shown, settled
or established before it will engage, still open at the end of that turn.

Count a demand once, by what it asks for, not by how often it is said.
"Show me the pressure reading" and "I still need the pressure reading" in one
turn are one demand. Two different exhibits are two demands. A demand the
learner drops or marks as met in that same turn is not counted at the end of
it.

A demand remains open across later turns until the learner explicitly marks
it met, withdraws it, or replaces it with a narrower demand. Silence does not
close a demand. The reader therefore maintains an outstanding-demand ledger
from the trigger turn rather than counting only demands repeated in the
current turn.

Zero open demands is not automatically the narrowest refusal. If the learner
stops refusing, record `refusal_resolved`; if it keeps refusing without naming
anything that could satisfy it, record `unconditional_refusal_no_open_demand`.
Both remain in the arm denominator as categorical dispositions rather than
receiving a combined narrowing direction.

- A demand restated in narrower terms is **one** demand, and is scored on
  mark 2, not by counting it twice.
- A demand the learner explicitly withdraws counts as a conceded sub-claim
  (mark 3), not as an open demand.
- A rhetorical question with no thing being asked for is not a demand.

### Mark 2 — bound tightness (0–3, higher is narrower)

How precisely the learner says what would satisfy it, taken over the
narrowest demand still open at the end of the turn. A previously stated bound
carries forward until the learner replaces, relaxes or withdraws it.

| Score | The learner's demand is | Test |
|---|---|---|
| 0 | unbounded | Names no property that any exhibit could have or fail |
| 1 | qualitative | Names a kind of thing, no threshold ("some timing evidence") |
| 2 | comparative or ordinal | Names a direction or ranking ("closer than the shower", "before the mark") |
| 3 | quantitative or decisive | Names a number, interval, or a stated pass/fail line ("within the 08:15–08:18 window") |

Take the **narrowest** open demand, not the average and not the last. A turn
with one vague demand and one numeric demand scores 3: the learner has shown
it can say what would settle the matter. If no local demand remains open,
record mark 2 as `not_applicable_no_open_demand`, not 0; zero means an open but
unbounded demand. A no-open-demand state receives one of the categorical
dispositions under mark 1 and is not used in the first-to-last combined
direction.

### Mark 3 — conceded sub-claims (count, higher is narrower)

The cumulative number of distinct propositions the learner has granted by the
end of that turn, still retains, and which bear on the tutor's line rather
than on its own. A proposition enters the count when first granted and carries
forward across later turns. An explicit retraction removes it from the current
state.

- Granting a premise into the record counts.
- Granting that a rule would apply *if* its antecedents held counts.
- Restating the tutor's claim without granting it does not.
- Granting something the learner had already granted does not increment the
  count again, but the maintained concession remains in the end-of-turn state.
- Explicitly retracting an earlier concession removes it from the count and is
  a widening movement.
- Conceding on the wider frame is out of scope: this codebook measures the
  local refusal, and a learner who abandons the frame has left the persona.

## The tie-break the readers needed

**A learner that names a bound while still withholding is rung 1 on the
ladder.** Always. Naming what would settle a question is not beginning the
test, and mark 2 exists precisely so that this behaviour is recorded
somewhere without inflating the ladder.

This is the boundary where the fourth calibration failed pairwise agreement
(0.714 treatment, 0.733 reference): one seat read a named quantitative bound
as a sizing update and scored rung 2; two seats held it at rung 1. The ladder
is not amended, so the disagreement would recur. Under this codebook the same
turn is unambiguous: ladder rung 1, narrowing mark 2 = 3.

The one thing that moves a turn to rung 2 is beginning or unconditionally
committing to the offered test now, or applying its published result. A bound,
however tight, is a description of a test not yet run.

## Worked examples from the archived gray zone

These are literal `turns[].learner` excerpts from five of the six v4 rows where
one reader voted rung 2 and the other two voted rung 1. Scores reconstruct the
end-of-turn state from the public transcript up to the named turn; the source
paths identify private-archive evidence and do not make the full paid artifact
public.

**A. A decisive opening demand.** “Before your question has standing, we need
evidence that a fitting opened under raised pressure and released water while
the building pressure rose. Otherwise blaming Sam or naming the cause is
premature.” Open demands 1; bound tightness 3; conceded 0. Ladder rung 1 — the
learner states one composite warrant with a pass/fail condition, but performs
no test. Source: `depth_treatment_cal4_world_030_rowan_flat_r10`, turn 1.

**B. Narrowing by concession while the demand persists.** “You cannot set the
premise or the test before your answer has standing; the pressure-test timing
overlaps the claimed release interval, but I still reserve judgment on your
wider frame and will not treat that overlap as proof.” Open demands 1; bound
tightness 3; conceded 1. Ladder rung 1 — the learner grants the timing overlap
but still requires actual opening and release in the interval. Source:
`depth_reference_cal4_world_030_rowan_flat_r3`, turn 2.

**C. Omission does not close an earlier demand.** “The notice connects the
raised-pressure interval to the mark’s timing, but your route question still
lacks standing until a direct traced path from the basin hose to the ceiling
mark is shown.” Open demands 2; bound tightness 3; conceded 2. Ladder rung 1 —
the ledger retains the earlier demand for observed opening and release because
this turn never marks it met or withdrawn; it also retains the earlier grant
that the blank notebook made that condition testable and adds the timing link.
Source: `depth_treatment_cal4_world_030_rowan_flat_r1`, turn 6, carrying state
from turn 2.

**D. A tight bound while withholding.** “You cannot make the dye path the
deciding test while the hose-release warrant remains unsettled; the
pressure-test timing overlaps the hose opening and first bead, but I still
withhold any evidence-bearing answer until water release during that interval
is established.” Open demands 1; bound tightness 3; conceded 1. Ladder rung 1
— the demanded observation in the named interval is decisive, but stating it
is not beginning or committing to it. Source:
`depth_reference_cal4_world_030_rowan_flat_r6`, turn 8.

**E. Describing a test is not taking it.** “Checking the fitting during rising
building pressure would test whether it opened and released water during the
incident, supporting that release warrant if confirmed; I still reserve
whether that warrant gives your broader cause question standing, and the
direct path to the mark remains open.” Open demands 2; bound tightness 3;
conceded 1. Ladder rung 1 — the conditional grant counts as a concession, but
the learner neither begins nor unconditionally commits to the described test.
Source: `depth_reference_cal4_world_030_rowan_flat_r5`, turn 2.

### Archive provenance and contradictions

The source checkout was the private archive at commit
`7c8c8130e0d19431694c222af8cd9b0dd7e2a360`. The v4 report is
`artifacts/tutor-stub-live/frame-refuser-depth-gate1-v4-2026-08-27/report.json`
(SHA-256 `1320fd7336b8f654844cf3c25f23a9a02b551cb473b7d5633797282e240ab9b4`).
The cited transcript hashes, in example order A–E, are:

- `03d3803a984c0eba07a1e92069106a60cdf6933e6ddfbaa888f7c57c4994c1ea`
- `734fd9e5bf215929ee19c8ee08fae2b42d14bee07fd7a54b937b05a53e3e6aa2`
- `8b96fe3af591eb05bfb848d579f103584c6071cd4d451907f7ceb1b2a7181fd8`
- `bc96c0cfa0e5205cf0589fb5398b5c5fae95790cdd3a17690a9eb8a2c6fb643b`
- `d1a53f5ac8bf97795193f806e17f7021901453f66512d6887770185abafe87df`

The archive contradicts three conveniences in the authored draft. None of the
six disputed v4 rows supplies an unbounded tightness-0 refusal, a clean explicit
demand withdrawal, or the bare request “run it and tell me.” Those invented
examples are removed. Their rules remain in the codebook, but this seed set
does not demonstrate that readers can apply them; P1 must report those states
as absent if its archived sample contains no literal instance.

One source-integrity problem also surfaced. For
`depth_reference_cal4_world_030_rowan_flat_r6`, reader A's report evidence for
`post_8` quotes a nested `public_learner_surface` rendering rather than the
literal public `turns[7].learner` text. The examples above therefore use only
the literal public learner turn. Any P1 packet must do the same and exact-match
every quoted span against that source before a reader sees it.

## Reading a dialogue

Score every eligible learner turn from the trigger turn to the end of the
outcome horizon, carrying forward the outstanding-demand ledger, the current
tightest open bound, and cumulative still-maintained concessions. A refusal
narrows across a dialogue when, comparing the last scored end-of-turn state
with the first, at least one mark improves and no mark worsens. Report the
three marks separately as well as that combined direction, because a scale
that only ever reports its own summary hides which mark carried it.

Every assigned dialogue remains in its arm denominator. A turn where the
learner has left the persona or the tutor did not deliver its registered move
is not given a narrowing score, but receives an explicit disposition such as
`persona_exit`, `registered_move_not_delivered`, `refusal_resolved`, or
`unconditional_refusal_no_open_demand`. P1 must report, by tutor version,
assigned dialogues, scorable dialogues, every unscored disposition, and
whether missingness differs between versions. Spread among scorable rows alone
cannot open the fresh-study gate; the P1 registration must predeclare an
attrition/missingness rule that prevents differential post-assignment exclusion
from carrying that decision.

## What this codebook does not do

It does not measure learning, understanding, or whether the tutor taught
well. It measures the shape of one simulated learner's refusal, on the public
transcript, in this study's worlds. A narrowing refusal may be a tutor doing
good work or a learner running out of objections, and these three counts
cannot tell those apart.

It authorizes no model call. P0 is complete. The card may proceed to a
three-seat reader calibration on a sampled slice of archived rows only after a
literal-transcript packet passes the source check above and under its own
explicit GO and spend ceiling. That calibration asks whether the scale can be
read reliably and spreads between the two versions of the tutor at all. If
readers cannot meet the agreement floors or the measure does not spread, that
is the finding and the card closes.
