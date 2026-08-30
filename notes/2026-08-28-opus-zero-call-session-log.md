# Session log — two zero-call designs, 2026-08-28 (Opus)

For Fable to review. Written at the end of the session it describes.

**Model calls made: 0.** No run, no build, no paid API call, no cell or
scenario changed, no stored result touched. Two design artifacts and two card
rewrites.

## What was asked

The operator picked two of the four active claude-owned cards and asked for
them in one session: the memory-controller design rewrite and the
satisfiable-condition frame-refuser design plus registration. The edged-register
card is being done in another session and was not touched. The third candidate
— the refusal-narrowing codebook — was deliberately not started; its worked
examples need archived transcripts that live in the private archive repo,
which this remote checkout cannot see.

## 1. Frame-refuser with a satisfiable condition

Card `frame-refuser-satisfiable-condition`, P0 and P1 both zero-call.

- `config/tutor-stub-frame-refuser-satisfiable-design.v1.json`
- `notes/2026-08-28-frame-refuser-satisfiable-registration.md`

**The finding is the part worth reviewing.** The card inherited a reading from
the depth-study closeout: the persona "demands proof the world may not
contain". Reading the mint code says something stronger.
`services/tutorStubRivalLearnerDag.js` has two open-node builders.
`premiseOpenNodes()` serves the bored learner (study code B1) and maps the
authored proof path's premise ids to nodes whose task text is the premise
surface. `warrantOpenNodes()` serves the frame-refuser (R1) and maps the
path's **rule** ids to nodes whose task text is the rule gloss.

So the frame-refuser demands that a *rule* be satisfied. A rule's satisfaction
is its consequent, and a consequent is a derived fact. No world premise
witnesses a rule consequent — that is what makes it a rule. The demand is
undischargeable **by construction, in every world**, not by accident of one
world's premise set.

Minting both R1 worlds at the v4 seed confirms it, and the registration note
quotes the demands verbatim. Rowan Flat opens on `R1_release`, whose consequent
`releasedWaterDuring(basinFeedHose, incidentWindow)` the world never witnesses:
it holds `p_split` and `p_pressure` separately and nothing conjoining them.
That is exactly the closeout's phrase "water observed leaving the hose during
the exact pressure interval". Marrick opens on `R1_blank` with the same shape.
Both worlds carry a single authored proof path, so the sha256 ranking picks it
every time — the demand does not vary by dialogue at all.

**The design change is one registered thing:** mint the open nodes from the
authored path's premises, which are exhibits a tutor can enter into the record.
Everything else is held byte-identical for comparability with the measured
0.114 base rate — reference arm, ladder rungs, three-seat panel and its 0.8
floor, sealed model stack, the v4 quote-echo exemption, the v4 attrition
budget.

**Points a reviewer should press on.**

1. *Is the outcome written into the brief?* The card warns about this and it is
   the sharpest risk. My answer is in the design under
   `outcomeNotWrittenIntoTheBrief`: the brief says what the persona demands and
   that it refuses until met, and says nothing about what to do once the
   exhibit is public — and applying a performed test is the rung-2 behaviour.
   The one mandated bridge step is the predecessor's, word for word, and fires
   on the same typed condition in both arms. But I state a residual risk rather
   than claim there is none: a learner told to demand a showable thing may be
   readier to use it once shown. That *is* the hypothesis. Judge whether the
   two-arm isolation is enough.
2. *The ladder is deliberately not amended.* v4 failed pairwise agreement at
   one boundary — a learner naming a quantitative bound while still
   withholding, which Sol grades rung 2 and both Claude seats hold at rung 1.
   Amending the ladder would break comparability with the 0.114 base, so I left
   it and carried the risk openly with a stated disposition. A reviewer might
   reasonably prefer the opposite trade. It is a judgement call, not a fact.
3. *The exhibit mint does not exist.* I did not write it. The design names it
   as required work and the plan-build preflight refuses unless open nodes
   carry `openNodeKind: "exhibit"` and resolve to authored-path premise ids —
   so running this design against today's code fails closed rather than
   silently reproducing the old demands.
   *Later the same day:* the mint landed as study code `R2` with the
   fail-closed demand selection rule and a regression test
   (`tests/tutorStubFrameRefuserSatisfiableMint.test.js`); the design's
   remaining implementation risk is renamed `plan_build_not_wired`. This
   entry stands as written for what the design session did and did not do.
4. *Demand selection.* Naming "the first premise" fails two ways, so the rule
   is: earliest authored-path premise not yet public at the trigger and
   scheduled inside the outcome horizon; refuse the world if none exists. I
   verified every authored-path premise and its release turn against both world
   files and tabulated them in the note. What I could **not** verify from
   reading alone is whether the runtime lets a tutor present a premise ahead of
   its scheduled turn — so the design avoids needing that, rather than assuming
   it.

## 2. Memory and curriculum controller

Card `adaptive-curriculum-memory-controller`, design rewrite only.

- `notes/2026-08-28-memory-controller-design-rewrite.md`

The 2026-08-27 instruction asked three questions. The note answers them and
drops the killed prerequisite (`tutor-stub-transition-reward-model`) from
`depends_on`: this design fits no ranker and needs no transition dataset.

- **What signal a cross-dialogue memory adds.** Nothing about the learner —
  §6.10 settled that the simulated learner's interior is surface-determined and
  §6.13.18 that the policy reconstructs its strategy from context every turn.
  The one quantity no single transcript can hold is the tutor's own historical
  hit rate per action family, per detected condition, per world. The
  intervention-outcome marks that landed the same day supply the raw material.
- **The shape.** A conditioned demotion at the moment the existing detector
  fires, not a memory screen read beforehand — nothing enters a prompt. Three
  arrivals at the §6.15/§6.16 boundary say a persisted advisory block does not
  change conduct however well authored; §6.16 licensed side-coaching delivered
  at the moment its condition holds, and §6.12.4 showed the candidate-selection
  seam is the load-bearing one.
- **Controls.** Stale memory is first, not a robustness note, because §6.15
  measured that action-shaped signals get uptake *even when stale* — compression
  detaches the imperative from its precondition, and a demotion is an
  imperative. Then a memory scramble modelled on `policy.state_scramble`, a
  contradictory-record arm, and a visible abstention floor.
- **Endpoint.** Outcome-only unassisted improvement and transfer on held-out
  worlds. Assisted closure is not admissible.

**The uncomfortable finding I kept in the open.** §6.12.4's closure-off arm
*preserved* strict shift: the intervention-outcome ledger already fails to
change action selection inside a dialogue. A cross-dialogue memory built on the
same outcomes inherits that burden. I did not soften it. It is why the design
is the narrowest testable shape and why the scramble margin is registered in
advance, and it is the strongest reason a reviewer might say this line should
not run at all. That would be a defensible read of the same evidence.

## Corrections I made to myself

Two citations were wrong in my first draft and the fix sharpened the design.

1. I wrote that the playbook probe found action-shaped memory "consumed
   wrongly". The paper says action-shaped signals get uptake *including when
   stale*. That is a different and more useful failure mode, and it promoted
   the stale-memory arm from a secondary control to the first one.
2. I cited §5.4 for the LLM-judge gullibility exposure, following §6.15's own
   internal reference. §5.4 is the turn-by-turn trajectory section; I could not
   confirm the gullibility content there, so I replaced it with a §6.15 quote I
   did verify.

## What a reviewer should check

- The mint reading. It is load-bearing for the whole frame-refuser design, and
  it rests on two functions and one dispatch line in
  `services/tutorStubRivalLearnerDag.js`. If `warrantOpenNodes()` is not what
  R1 actually uses at run time, the design's premise collapses.
- The release-turn table in the registration note, against both world files.
- Whether holding the ladder fixed is the right trade against the known reader
  disagreement.
- Whether the memory controller should be designed at all, given §6.12.4.

## Verification run

`npm run wp:source-check` (553 items), prettier on the new design JSON, and a
zero-call mint of both R1 worlds to read the open nodes. No test suite was
affected: nothing under `services/`, `scripts/` or `tests/` was changed.
