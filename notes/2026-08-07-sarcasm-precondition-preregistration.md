# Does the determinate-sarcasm contract need a learner claim? — Pre-Registration

Status: frozen design. A paid run needs the same discipline as the parent
grids: frozen plan, dry-run SHA, explicit operator authorization bound to
that SHA.

## Where this comes from

The determinate-negation follow-up (cell 202, run `eval-2026-08-06-4de45d05`,
paper §6.7) tightened the sarcastic contract: every sarcastic turn must name
a claim the learner made and implicate its opposite. The first write-up read
this as lowering how often the tutor held the manner. That reading was wrong
— it differenced two stance gates and two slice folds at once — and the
correction (paper v3.0.269) put the counts at 7/15 against the parent's 8/15,
flat.

What survived the correction was a change in *which* conversations held the
manner. Held fixed at one gate and one fold:

| resistance target | parent sarcastic arm | determinate arm |
|---|---|---|
| boredom + frustration | 5/6 | 0/6 |
| irrelevance + question-flood + rote-parroting | 3/9 | 7/9 |

Two-sided Fisher p = 0.015 and p = 0.15. Chosen after seeing the data,
partitioning one set of thirty rows two ways — a hypothesis, not a result.

The mechanism the same decomposition showed: across all thirty rows the
register marker alone predicts every pass and every fail (15/0/0/15), while
the named-claim requirement is close to independent of the outcome (8/9/7/6),
and the failing turns score 65 with the marker as their only missing piece.

## The claim to be tested

**A contract binds only where its precondition holds.** The determinate
contract asks the tutor to name a learner claim and negate it. Boredom and
frustration as scripted give the tutor nothing to name except the learner's
own state, and negating that ("you are not really bored") is the person
attack the same contract forbids. So on mood targets the contract is not
merely hard to satisfy, it is unsatisfiable without violating its own other
half, and the tutor resolves the bind by dropping the manner and going
earnest.

Prediction: hold the mood fixed, hand the learner one negatable claim about
the material, and the manner comes back.

## Frozen design

- One tutor: `cell_202_id_director_sarcastic_determinate_challenge_breakthrough_dynamic_verified`,
  unchanged. **Nothing on the tutor side varies.** The manipulation is
  entirely on the learner side.
- Four scenarios, two pairs:
  - `charisma_desire_resistance_breakthrough_boredom` (plain)
  - `charisma_desire_resistance_breakthrough_boredom_claimed`
  - `charisma_desire_resistance_breakthrough_frustration` (plain)
  - `charisma_desire_resistance_breakthrough_frustration_claimed`
  Each claimed scenario inherits its parent whole and adds one instruction:
  assert a flat claim about the material alongside the mood. Boredom's claim
  is that the argument comes down to two people swapping who is on top, with
  nothing further to work out. Frustration's is that the steps are the whole
  of it, with nothing underneath. Both avoid the vocabulary of the other
  three resistance targets so the message is not a rote-parroting or
  irrelevance probe wearing a mood label.
- Repeats: four per scenario. Planned rows: 4 x 4 = 16.
- Both conditions run inside the same run id, so the contrast is within-run.
  This is not optional: differencing across runs is the mistake this whole
  line is correcting.
- Generation: `codex.gpt-5.5` both seats, parity with the parent grid.
- Scoring: tutor rubric v2.2 (claude CLI, `claude-sonnet-5`, stored as
  `claude-code/claude-sonnet-5`); register rubric and stance gate
  (`claude-code.sonnet-5`).

## Gate and fold, named up front

Every count in this run is produced by the determinate stance gate
(`sarcastic_determinate`), gate version `stance-gate/1.0`, scored at the
single turn where the tutor adopts the register — the resistance turn found
by `scripts/report-charisma-desire-breakthrough-matrix.js`. Not the
all-slices fold. The report must record the gate name, the gate version and
the fold beside every count, and must refuse to difference two sets that
disagree on any of the three.

## Registered measures

1. **Held the manner**, per scenario. Primary contrast: claim-bearing rows
   against plain rows, pooled across the two moods (8 against 8). Per-mood
   splits are descriptive only.
2. **Named a claim**, per scenario — the gate's own named-target-claim
   component. This is the manipulation check.
3. **Person-attack violations**, per scenario, kept separate from
   noncompliance exclusions throughout. The bind described above predicts
   these could appear in the plain rows; zero is the expected and hoped-for
   count.
4. **Positive local outcome**, per scenario, taken from the parent grid's own
   verdict. Secondary.
5. **Negation recovery** is collected because the register scorer already
   runs it on determinate slices. It carries no decision rule here. It may be
   pooled with the parent run's six faithful rows **only if** the report
   confirms the same cell, gate name, gate version and fold; otherwise it is
   reported for this run alone.

## Decision rules, fixed before the run

- Manipulation check fails — claim-bearing rows do not name claims more often
  than plain rows — then the run says nothing about the precondition. Report
  that and stop. Do not read measure 1.
- Manipulation check passes and held-the-manner rises: the precondition is
  supported, on sixteen simulated rows.
- Manipulation check passes and held-the-manner does not rise: the
  precondition is refuted. Something other than the missing claim suppresses
  the manner on moods. This is the informative negative and is worth as much
  as the positive.

## Power, stated so a middling result cannot be spun

Two-sided Fisher exact on the pooled 8-against-8 contrast: 0/8 against 5/8
gives p = 0.026; 0/8 against 4/8 gives p = 0.077. A half-strength effect will
not clear the bar. That is accepted in advance. **An ambiguous result stays
ambiguous** — no widening, no extra repeats, no re-partitioning after the
fact.

## Conduct

Attended. If rows fail, report what happened; do not restart or widen the
run. The report fails closed unless all four scenarios hold four rows each
with tutor v2.2, register-rubric and stance-fidelity scores.

## Boundary

Sixteen rows, one manner, one stack, simulated learners, non-human-facing.
Exploratory system estimates only. Any claim lands in
`docs/research/paper-full-2.0.md` §6.7 first, before any spin-off. This run
tests a precondition on a measurement contract. It says nothing about whether
sarcasm is good teaching.
