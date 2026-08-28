# Registration — frame-refuser with a satisfiable condition (revision 1)

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
can show. The tutor holds the premise ledger, so entering an exhibit into
the public record is a move the tutor can actually make.

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
