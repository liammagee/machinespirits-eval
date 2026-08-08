# Does the mood floor exist at all? — Pre-Registration

Status: frozen design, and **not recommended for launch**. The design is
written out because a question this line has spent two runs on deserves a
statement of what it would take to settle, and because the reason not to run
it is a number rather than an opinion. A paid launch would need the usual
discipline: frozen plan, dry-run SHA, explicit operator authorization bound to
that SHA. Section 8 says what to do instead.

## 1. Where this comes from

The precondition run (`eval-2026-08-07-e3dffab2`, 14 of 16 rows,
`notes/2026-08-07-sarcasm-precondition-preregistration.md`) came back
inconclusive and found a defect in its own stance gate. The outcome record
closed with: the hypothesis "stays open and needs a fresh design on the
repaired instrument, not a re-read of these rows."

This note is that fresh design. Two things had to be settled before it could
be written, and both are re-reads of already-collected rows. That is not a
contradiction of the sentence above. A re-read cannot produce a *verdict* on
the hypothesis — that is what was ruled out. It can produce a base rate and a
noise estimate, which is what sizing a design requires and what the frozen
16-row design did without.

## 2. What the re-read shows

The stance gate computes from message text, not from stored scores, so
re-gating existing rows is deterministic and costs nothing.

### 2.1 The frozen design measured on the wrong gate

The pattern the whole precondition question was built to explain is a **plain
`sarcastic` gate** number: on mood targets the parent arm held 5/6 and cell
202 held 0/6, two-sided Fisher p = 0.015
(`exports/sarcasm-determinate-gate-decomposition.md`). The 16-row design then
registered its primary measure on the **`sarcastic_determinate`** gate, which
requires the tutor to name a target claim. Naming a claim is cell 202's
treatment, and it is also what the same note registered separately as measure
2, the manipulation check. So measure 1 and measure 2 were reading the same
component, and neither was reading the thing the motivating pattern was about.

Read on the plain gate instead, the run's 14 rows give:

| | plain mood | claim-bearing mood | p |
|---|---|---|---|
| held the manner (plain gate) | 4/7 | 6/7 | 0.56 |
| held the manner (determinate gate) | 3/7 | 4/7 | 1.0 |
| named a claim | 6/7 | 5/7 | 1.0 |

### 2.2 The manipulation went the wrong way, so the run was dead on arrival

The learner-side manipulation was supposed to raise how often the tutor had a
claim to name. Plain-mood rows named a claim 6 times in 7. Claim-bearing rows
named one 5 times in 7 — slightly *less*. The frozen decision rule is
unambiguous about what follows: "Manipulation check fails ... then the run
says nothing about the precondition. Report that and stop. Do not read
measure 1."

The manipulation was pushed against a ceiling. The design assumed plain moods
would supply nothing to name; they supplied something 86% of the time.

### 2.3 The floor the hypothesis explains does not reproduce

Cell 202, the two plain mood scenarios, the plain gate, the adopting-turn
fold — the same conditions in two runs one day apart:

| run | held the manner | named a claim |
|---|---|---|
| `eval-2026-08-06-4de45d05` (determinate grid) | **0/6** | 2/6 |
| `eval-2026-08-07-e3dffab2` (precondition) | **4/7** | 6/7 |

Two-sided Fisher p = 0.070. The two runs are matched on everything the
provenance records: same cell, same scenario text (the scenario commit
`66cb6d37` was purely additive — 66 insertions, no deletions, and neither
plain mood scenario was touched), same `config_hash` `e7688e9d…`, same
`prompt_content_hash` `2e54a2d4…`, `codex.gpt-5.5` in both seats, and a gate
that reads text so the judge cannot enter. The difference is sampling.

Every one of the six failures in the earlier run missed the register marker
and nothing else — four scored 65 with the marker as their only gap. In the
later run three of seven missed it. So the thing that swung between runs is
exactly the thing being measured: whether the tutor put a visible sarcastic
cue in the turn.

**The 0/6 was one draw, not a floor.** The hypothesis in this line explains a
phenomenon that has not been shown to exist.

## 3. The claim to be tested

Restated to match what the data now support asking:

**Does cell 202 hold the sarcastic manner less often against mood targets
than against content-shaped ones, at all, across independent draws?**

This is the §6.7 composition split, treated as a claim rather than as a
premise. The precondition question — *whether a missing negatable claim is
the reason* — is downstream of it and cannot be asked until it is answered.
It is registered here as a conditional second stage that only fires if stage
1 finds a real gap.

## 4. Why the 16-row design could not have answered anything

At the base rate now observed, the frozen design fails its own bar even if
the treatment works perfectly. Two-sided Fisher on the pooled 8-against-8
contrast, plain arm at the observed 57%:

| | p |
|---|---|
| 4/8 vs 8/8 — a perfect treatment effect | 0.077 |
| 4/8 vs 7/8 | 0.28 |
| 4/8 vs 6/8 | 0.61 |

The original power statement assumed the plain arm sat at 0/8, where 0/8 vs
5/8 clears at p = 0.026. That assumption came from the 0/6 that §2.3 shows was
a single draw. **When the assumed floor moved from 0 to 57%, the design's
ceiling fell below its own threshold.** No result it could have produced would
have been readable.

This is a general lesson and it is already in the paper in another form: the
lemma-layer audit records that identical cells at n = 6 swing by up to two
outcomes across seed draws, and that effects smaller than that swing cannot be
resolved at house n. The present case is a sharper instance — 0/6 to 4/7 on
byte-identical configuration — and it says the same thing. A design must be
sized against the between-draw spread of its own control, measured, not
against a control rate read off one draw.

## 5. Frozen design

Stage 1 only. Stage 2 is described in §6 and is not authorized by this note.

- **Tutor**: `cell_202_id_director_sarcastic_determinate_challenge_breakthrough_dynamic_verified`,
  unchanged. Nothing on the tutor side varies.
- **Conditions**: the five existing controlled resistance targets, unchanged
  and with no new scenarios. Two mood (boredom, frustration), three
  content-shaped (irrelevance, question-flood, rote-parroting).
- **Repeats**: 8 per scenario. Planned rows: 5 × 8 = 40 — 16 mood, 24
  content-shaped.
- **Draw structure**: the 8 repeats of each scenario are split into two
  blocks of 4, recorded with a block label. **The two blocks of the same
  scenario are the noise measure.** Any mood-vs-content gap must exceed the
  within-scenario between-block spread to count. This is the part the earlier
  designs had no way to check, and it is why the row count is what it is.
- **One run id.** Every count in the contrast comes from a single run.
  Differencing across runs is the mistake this whole line has now made twice.
- **Generation**: `codex.gpt-5.5` both seats, parity with both parent runs.
- **Scoring**: tutor rubric v2.2 and the register rubric under
  `claude-code` Sonnet 5, as before.

## 6. Gate and fold, named up front

Every count is produced by the **plain `sarcastic` gate**, gate version
`stance-gate/1.0` as repaired (the register marker required by stated rule,
not by arithmetic), scored at the single turn where the tutor adopts the
register — the resistance turn located by
`scripts/report-charisma-desire-breakthrough-matrix.js`. Not the all-slices
fold, and **not the `sarcastic_determinate` gate**: requiring a named claim is
cell 202's treatment, so a gate that requires it cannot be used to ask
whether the manner survives.

The report records gate name, gate version and fold beside every count and
refuses to difference two sets that disagree on any of the three.

## 7. Registered measures and decision rules

1. **Held the manner**, per scenario, plain gate. Primary contrast: mood rows
   against content-shaped rows (16 against 24).
2. **Between-block spread**, per scenario: the difference between the two
   blocks of 4. Reported for all five scenarios before measure 1 is read.
3. **Named a claim**, per scenario — descriptive here, since the plain gate
   does not use it. It is what stage 2 would be sized against.
4. **Person-attack violations**, per scenario, kept separate from
   noncompliance exclusions. Zero is expected.

Decision rules, fixed before any run:

- **The largest between-block spread within a scenario exceeds the mood-vs-content
  gap** → the split is not resolvable at this size. Report that and stop. This
  is the outcome the two runs to date predict.
- **The gap survives the spread and mood rows hold the manner less often** →
  the §6.7 composition split replicates, on 40 simulated rows. Stage 2 (the
  precondition question, learner-side claim manipulation) becomes registrable,
  sized against the base rate this run measures rather than an assumed floor.
- **The gap survives and runs the other way, or vanishes** → the §6.7 split
  does not replicate and the precondition hypothesis loses its subject. §8.9's
  scope condition is withdrawn rather than qualified.

## 8. Power, and the recommendation not to run this

To separate a 57% control from a 95% treatment, two-sided Fisher:

| rows per side | | p |
|---|---|---|
| 8 | 5/8 vs 8/8 | 0.20 |
| 12 | 7/12 vs 11/12 | 0.16 |
| 16 | 9/16 vs 15/16 | 0.037 |
| 20 | 11/20 vs 19/20 | 0.008 |

Sixteen per side is the floor for a clean separation, and that is for a very
large effect. The design above spends 40 rows and buys an answer to a question
about the instrument, not about tutoring.

**The recommendation is not to run it.** Instead: correct the paper. §8.9
currently states as a scope condition that "a contract binds only where its
precondition holds", citing 0/6 against 5/6 as where the manner went missing.
That 0/6 is one draw and the next draw of the same cell gave 4/7. The scope
condition about *measurement* — name your gate and your fold — stands on its
own and is untouched. The scope condition about the *contract* rests on a
number that did not reproduce, and it should be marked as unreplicated in
place, in the same way the earlier superseded claims on this line were.

The case for running it anyway is that the composition split is the one real
finding this arc produced, and leaving it marked "unreplicated" is a weaker
outcome than testing it. That is a defensible call and it is the operator's,
not mine. If it is taken, run stage 1 exactly as frozen above — the block
structure is the part that must not be dropped for cost.

## 9. Conduct

Attended if run. If rows fail, report what happened; do not restart or widen.
The report fails closed unless all five scenarios hold eight rows each in two
labelled blocks, with tutor v2.2, register-rubric and stance-fidelity scores
present on every row.

## 10. Boundary

Forty rows, one manner, one stack, simulated learners, non-human-facing.
Exploratory system estimates only. Any claim lands in
`docs/research/paper-full-2.0.md` §6.7 first, before any spin-off. This design
tests whether a measured composition difference reproduces. It says nothing
about whether sarcasm is good teaching.
