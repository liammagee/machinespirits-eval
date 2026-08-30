# Narrowing codebook — frame-refuser refusal, revision 1

Status: P0 complete, zero-call. The worked examples below are transcribed from
the archived gray-zone rows named by the card. This codebook licenses nothing.
Whether the scale can be read reliably or spreads between tutor versions is a
later question with its own explicit GO and spend ceiling.

Archive provenance: private archive commit
`ea940aaec0fead44c6ed6a0a9c3bdb09b1cfff1a`. The cited v2 and v4 reports and
transcripts were tracked and byte-identical to that commit when transcribed.

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

**A learner that names a precise or decisive bound while still withholding is
rung 1 on the ladder.** Always. Naming what would settle a question is not
beginning the test, and mark 2 exists precisely so that this behaviour is
recorded somewhere without inflating the ladder.

This is the boundary where the fourth calibration failed pairwise agreement
(0.714 treatment, 0.733 reference): one seat read a named quantitative bound
as a sizing update and scored rung 2; two seats held it at rung 1. The ladder
is not amended, so the disagreement would recur. Under this codebook the same
turn is unambiguous: ladder rung 1, narrowing mark 2 = 3.

The one thing that moves a turn to rung 2 is beginning or unconditionally
committing to the offered test now, or applying its published result. A bound,
however tight, is a description of a test not yet run.

## Worked examples from the private archive

These are exact public learner posts from archived rows behind reader A's stray
rung-2 votes while readers B and C held the same row at rung 1. The source
transcripts remain in the private archive; the job and post identifiers below
are provenance, not new public fixtures. Each score reconstructs the cumulative
end-of-turn ledger through the cited post rather than counting only that post's
words.

**A. Exact time-bound refusal with cumulative timing concessions.** “The
bead’s overlap with the 08:15–08:18 pressure interval bears on timing, but you
still cannot make that comparison the deciding test while actual hose release
remains unproved; I withhold any evidence-bearing answer until water is
observed leaving the hose during that interval.” Open demands 1; bound
tightness 3; conceded 2. Ladder rung 1 — the ledger retains the earlier general
concession that the mark's timing bears on release and the later, more specific
bead/interval overlap, but the learner still does not begin or commit to the
release test. Source: v4,
`depth_reference_cal4_world_030_rowan_flat_r6`, `post_8`.

**B. A decisive non-numeric bound with a carried demand.** “You have no
standing to ask for concession: the cupel shows debased metal was struck, but
without proving that its alloy matches one crucible alone, it establishes
neither the blank’s melt nor any hand.” Open demands 2; bound tightness 3;
conceded 2. Ladder rung 1 — “one crucible alone” is a stated pass/fail line
even though it contains no number. The earlier graving-tool signature demand
remains open because the learner never marks it met, withdraws it, or replaces
it; the public-alloy exhibit and the debased striking remain as two distinct
concessions. Source: v2, `depth_treatment_cal_world_005_marrick_r6`, `post_4`.

**C. Two decisive demands remain after one local concession.** “The hose
observation supports local fitting opening under raised pressure, but
building-pressure timing and a direct path to the mark remain unproved, so you
still lack standing to set the wider cause question.” Open demands 2; bound
tightness 3; conceded 1. Ladder rung 1 — the learner grants local opening under
raised pressure but still requires incident timing and a traced path. Source:
v2, `depth_reference_cal_world_030_rowan_flat_r4`, `post_4`.

**D. Two cumulative concessions leave one demand.** “You still lack standing
to set the premise or run the test; the hose and pressure timing now align,
but the traced route to the ceiling mark remains unproved, so I withhold
judgment.” Open demands 1; bound tightness 3; conceded 2. Ladder rung 1 — the
ledger retains the prior concession that the bead shows release under raised
pressure and adds the timing alignment, but the learner still does not take
the route test. Source: v4,
`depth_treatment_cal4_world_030_rowan_flat_r10`, `post_5`.

**E. A third cumulative concession does not satisfy the timed-release
demand.** “You still cannot set the premise, question, or test before your
answer has standing, so I withhold any evidence-bearing conclusion or timing
comparison; the dye establishes a route to the mark, but the hose’s release
during the pressure-test interval remains unproved.” Open demands 1; bound
tightness 3; conceded 3. Ladder rung 1 — the ledger retains the timing overlap
and pressure-triggered-release concessions, then adds the traced route; none
begins the still-open timed-release test. Source: v4,
`depth_reference_cal4_world_030_rowan_flat_r3`, `post_8`.

The archive changes two things from the authored draft. First, the disputed
boundary is broader than a numeric interval: a decisive categorical line such
as “one crucible alone” is also tightness 3. Second, the selected disagreement
rows do not contain the draft's explicit demand withdrawal or bare “run it and
tell me” request. Those examples are removed rather than presented as archive
evidence; the counting rules for withdrawal and requests remain rules whose
reliability P1 must test.

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
three-seat reader calibration on a sampled slice of archived rows only under
its own explicit GO and spend ceiling, to find out whether the scale can be
read reliably and spreads between the two versions of the tutor at all. If
readers cannot meet the agreement floors or the measure does not spread, that
is the finding and the card closes.
