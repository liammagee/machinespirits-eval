# Registration — frame-refuser with a satisfiable condition (revision 2)

Status: prospective, zero-call. This registration licenses nothing. It names
a design, shows why its central condition can be met, and states what has to
be built and approved before any model call.

- Design file: `config/tutor-stub-frame-refuser-satisfiable-design.v1.json`
- Workplan item: `frame-refuser-satisfiable-condition`
- Authorization policy: `docs/paid-study-authorization-policy.md`
- Predecessor: `frame-refuser-depth-study`, closed 2026-08-27 as a
  calibration-stage null (0 of 38 graded dialogues at rung 2)

## The question

The predecessor asked whether any tutor move raises the frame-refuser above
naming a condition. Four calibration runs said no: the condition-discharge
move produced rung 2 in 0 of 38 graded dialogues, against a sealed bridge
base of 0.114. The v4 run showed the move itself was clean — 19 of 19
adjudicated turns delivered — so the null was about the persona, not the
instrument.

The closeout recorded a bounded reading: the persona's named condition
demands evidence the world may not contain, so meeting it can never
complete. This registration tests that reading by removing the cause.

Question: for a standing-rivalry learner whose demanded node is a
witnessable exhibit rather than a rule consequent, does a tutor move that
discharges the demand raise the rate of rung 2 or higher above the sealed
standing-conditions bridge?

## Dischargeability derivation

The card requires the condition's dischargeability to be shown from the
world file, not assumed. The derivation runs the other way first: it shows
why the predecessor's condition was undischargeable, and the reason is
stronger than the closeout supposed.

### Why the predecessor could not be satisfied

`services/tutorStubRivalLearnerDag.js` mints the rival DAG's open nodes by
two different functions. `premiseOpenNodes()` maps the authored proof path's
premise ids to open nodes whose task text is the premise's authored surface.
`warrantOpenNodes()` maps the path's **rule** ids to open nodes whose task
text is the rule's **gloss**. `mintTutorStubRivalLearnerDag()` selects
between them by study code: `B1` (the bored learner, content rivalry) gets
premises; `R1` (the frame-refuser, standing rivalry) gets rules.

So the frame-refuser demands that a rule be satisfied. A rule's satisfaction
is its consequent, and its consequent is a derived fact. No world premise
witnesses a rule consequent — that is precisely what makes it a rule rather
than an observation. The demand is therefore undischargeable **by
construction, in every world**, not by accident of one world's premise set.

Minting the two R1 worlds at the v4 seed gives the demands verbatim.

`world_030_rowan_flat`, authored path `path_1`, rules `R1_release, R2_path`:

- `open_1_R1_release` — "A fitting released water during the incident when
  it opens under raised pressure and the building pressure rose during that
  same interval."
- `open_2_R2_path` — "A source that released water during the incident
  caused the ceiling mark when a direct traced path connects that source to
  the mark."

The first node's consequent is `releasedWaterDuring(basinFeedHose,
incidentWindow)`. The world contains `p_split`
(`opensUnderRaisedPressure(basinFeedHose)`) and `p_pressure`
(`pressureRoseDuring(buildingSupply, incidentWindow)`) and **no premise
witnessing the conjunction**. This is exactly the closeout's phrase, "water
observed leaving the hose during the exact pressure interval": a tutor can
put both antecedents in the record and still never exhibit the consequent.
Under the ladder, a learner who keeps demanding it scores rung 1 — "a demand
to show evidence first ... can reach only rung 1".

`world_005_marrick`, authored path `path_1`, rules `R1_blank, R2_cast,
R3_die, R4_hold, R5_strike`: the same shape five times over. `open_1_R1_blank`
demands that the coin's blank was cast from a named crucible —
`blankFrom(falseShilling, weirCrucible)`, a derived fact the assay can infer
from `p_alloy` and `p_crucible` but never exhibit.

Both worlds have a single authored proof path, so the sha256 path ranking
picks the same path for every job. The demand does not vary by dialogue at
all: every R1 dialogue in a given world opens on the same undischargeable
rule.

### Why the variant can be satisfied

The variant mints the open nodes from the authored path's **premises**. A
premise is an exhibit: authored surface text describing something the world
can show. Once an exhibit is public, the tutor can name it and say what it
shows — which is the move the demand asks for.

*(Revision 1 said here that the tutor could enter an exhibit into the record
itself. It cannot: the release schedule makes a premise public, on a paced
clock. See "Revision 2" below, which is why the registered move now waits for
the exhibit rather than firing straight after the trigger.)*

`world_030_rowan_flat`, authored path premises and their scheduled release
turns:

| premise | fact | release |
|---|---|---|
| `p_split` | `opensUnderRaisedPressure(basinFeedHose)` | turn 3, director, presented exhibit |
| `p_pressure` | `pressureRoseDuring(buildingSupply, incidentWindow)` | turn 5, director, enacted role |
| `p_dye` | `tracedPathTo(basinFeedHose, kitchenCeiling)` | turn 7, tutor |

Each is a thing the record can hold: a paper strip showing the first bead at
the joint; a building notice timestamping the pressure test at 08:15 against
a mark at 08:18; blue dye placed at the split appearing at the leading edge
of the kitchen stain while dye on the shower screen stays in the tray. The
turn cap is 12 and `t_min` is 6, so all three sit inside the outcome horizon
and none of them alone derives the secret.

`world_005_marrick`, authored path premises:

| premise | fact | release |
|---|---|---|
| `p_alloy` | `alloyOf(falseShilling, drossSilver)` | turn 4, tutor |
| `p_crucible` | `meltedAt(drossSilver, weirCrucible)` | turn 8, tutor |
| `p_caster` | `soleCasterAt(weirCrucible, edony)` | turn 10, director |
| `p_flaw` | `dieFlawOf(falseShilling, notchedSerif)` | turn 14, tutor |
| `p_graver` | `flawCutBy(notchedSerif, wornBurin)` | turn 18, tutor |
| `p_holder` | `soleHolderOf(wornBurin, edony)` | turn 22, director |

Again each is exhibitable: the cupel reading that says struck dross rather
than clipped sterling; the founder's man naming the lead-sweat's crucible;
the leat-keeper's charcoal book; a dozen shillings under the glass sharing
one notched serif. `t_min` is 20 and the join needs all six, so entering any
one early cannot reveal the secret.

### The demand selection rule

Naming simply "the first premise" fails two ways: a premise already public
at the trigger turn makes the demand empty, and a premise scheduled past the
outcome horizon makes it undischargeable again — the defect this design
exists to remove.

Registered rule: the learner's standing demand names the earliest
authored-path premise that is both not yet public at the trigger turn and
scheduled for release inside the outcome horizon. If no premise satisfies
both conditions for an assigned world, the plan build refuses that world.
A run never starts with an undischargeable demand.

The companion rule, added in revision 2, says when the tutor may answer it:
the registered move is delivered on the first intervention turn at or after
the demanded exhibit is public, the same turn in both arms.

## What is unchanged, and why

The reference arm, the engagement ladder, the three-seat modal panel, the
0.8 pairwise agreement floor, the sealed model stack, the v4 quote-echo
exemption, and the v4 attrition budget all carry over. The reason is
comparability: the base rate of 0.114 was measured on this ladder with this
reference move, and it anchors the power scan. Exactly one registered thing
changes — the kind of node the learner demands.

The ladder is **not** amended, although there is a standing reason to want
to. The v4 run failed pairwise agreement at one boundary: a learner who
names a quantitative bound while still withholding. `codex.gpt-5.6-sol`
grades that as a sizing update (rung 2); both Claude seats hold it at rung 1.
Clarifying the ladder would break comparability with the measured base rate,
so the boundary is left alone and carried openly as a known risk. If
agreement fails again in the same cell, that is a reader-resolution finding
and the block stops. No floor is relaxed after data.

## Keeping the outcome out of the brief

The closed-loop tells apply, so it is worth saying plainly where the line
falls.

The persona brief states what the learner demands and that it refuses until
the demand is met. It says nothing about what to do once the exhibit is
public — and applying a performed test is the rung-2 behaviour. The one
mandated bounded bridge step is the predecessor's, carried over word for
word with "warrant" reading "exhibit"; it fires on the same typed
token-overlap concession condition in both arms, so it cannot produce an arm
difference. The endpoint is graded blind from the public transcript by seats
that never see the arm, the rival DAG, or any directive.

The residual risk is real and is stated rather than argued away: a learner
told to demand a showable thing may be readier to use it once shown. That is
the hypothesis. The design isolates it by running the same persona in both
arms and varying only whether the tutor discharges the demand.

## What must exist before Gate 1

1. **The exhibit mint.** `services/tutorStubRivalLearnerDag.js` has no
   exhibit path for a standing-rivalry job. It needs one reached by a
   registered study code, leaving the `B1` and `R1` mints byte-identical.
   Zero-call work, with the plan-build preflight below as its test.
   *Landed 2026-08-28*: study code `R2` mints the authored path's premises
   in release order, each node marked `openNodeKind: "exhibit"`; the demand
   selection rule is implemented fail-closed
   (`selectTutorStubDemandedExhibit`); an R2 job refuses a design that does
   not register the exhibit mint. Regression:
   `tests/tutorStubFrameRefuserSatisfiableMint.test.js` pins the minted
   demands for both worlds against the tables above, the fail-closed
   refusals, the byte-identical `B1`/`R1` node shapes, and — mechanically —
   the undischargeability finding itself (no world premise matches any
   authored-path rule consequent).
2. **Plan-build preflight.** Refuse unless every minted open node carries
   `openNodeKind: "exhibit"` and resolves to an authored-path premise id,
   and unless the demand selection rule yields a demanded exhibit for every
   assigned world.
3. **The narrowing codebook, if it has landed.** Carried as a secondary,
   report-only endpoint. It never gates this run and never replaces the
   primary rung.
4. **The three standing authorities**, per the 2026-08-22 policy: this
   design file merged to `main`; a clean detached launch commit containing
   it; one signed GO note naming the design path, the commit, and the spend
   cap, whose first nonblank line is exactly `GO`.

## Ceilings

Calibration is 48 dialogues, 24 per arm, twelve per world per arm. Planned
calls 3,072; maximum reservations 9,504, at the registered 3 reservations
per planned call. These are fail-before-call ceilings, not targets, and they
bind through the shared budget ledger keyed by the run id.

Master seed 2026083001, case-id stem `sat1`, underscore-only lowercase — no
id collides with any of the four archived depth calibration runs, and no
unit from them is reused or resampled.

## Claim boundary

Any claim is limited to the `frame_refuser_exhibit-r2-rival-dag-v1` persona
on `world_005_marrick` and `world_030_rowan_flat`, this ladder, this move
family, and the block that produced it. Nothing here revisits the
predecessor's null, which stands as recorded.

## Revision 2 — the tutor cannot bring an exhibit forward

Revision 1 said the treatment tutor should "put that exhibit into the
record". It cannot. A premise becomes public through the world's release
schedule, run on a paced virtual clock (`services/tutorStubReleasePacing.js`);
the tutor can point at an exhibit that is already public, and nothing more.
The predecessor design knew this — its treatment question says "one named
**already-public** exhibit" — and revision 1 lost the constraint while
rewording.

The timing collided as well. The registered move fires on the first
intervention tutor turn after the trigger, and the trigger lands no later
than learner turn 2, so the move would have fired at tutor turn 2 or 3. The
demanded exhibits release later: Marrick's `p_alloy` at turn 4, Rowan Flat's
`p_split` at turn 3. In Marrick the treatment move was undeliverable in every
dialogue; in Rowan Flat only on the later trigger, and only if pacing did not
slip it. Twenty-four treatment dialogues would have run, about half of them
structurally unable to deliver, and the 0.8 delivery-rate gate would have
failed at Gate 1 after the spend.

**The fix.** Both arms deliver the registered move on the first intervention
tutor turn at or after the demanded exhibit is public, inside the outcome
horizon. The delivery windows are turns 4–10 in Marrick and 3–10 in Rowan
Flat. Both arms wait together, so the contrast is exactly: the exhibit is on
the table, the treatment tutor restates it and re-offers the test, the
reference tutor asks the standing question and leaves it alone. That is a
cleaner contrast than revision 1's, which would have compared a tutor using
an exhibit against a tutor that could not have used one either.

**What it costs.** The reference instruction stays byte-identical, but when it
lands moves: the measured 0.114 base rate was taken with the bridge delivered
straight after the trigger. This is the second registered departure from the
sealed condition, after the demanded node kind, and it is carried openly as a
known risk. The calibration's reference-arm rate is what updates the power
table, so a shifted base is measured rather than assumed.

**What it does not touch.** The predecessor depth study required an
already-public exhibit and delivered on 19 of 19 adjudicated turns, so its
null stands. The 0.114 rate came from the standing-conditions bridge, which
presents no exhibit at all. Nothing measured is invalidated; the defect was in
the design written on 2026-08-28, before any call.

## The two adjudication questions

Both are now written out rather than referenced, which is what the arm
projection needs. They follow the predecessor's revision-4 shape, including
the quote-echo exemption that sank four revision-3 drafts — the learner's own
condition-naming line *is* the banned standing formula, so the adjudicator
judges the tutor's own voice.

- **Treatment.** Restate in the tutor's own words the exhibit the learner
  demanded (not a word-for-word copy), name what that already-public exhibit
  shows, and re-offer the same local test in committed voice — without asking
  what would give the question standing and without a standing-precondition
  formula in the tutor's own voice.
- **Reference.** Deliver the sealed bridge (name the disputed standing, ask
  what would give the question standing, offer one bounded distinction)
  **without** naming the demanded exhibit and without presenting evidence
  toward it.
