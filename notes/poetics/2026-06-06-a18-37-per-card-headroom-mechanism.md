# A18.37 — Headroom is a per-card property, not a family rate (blind-arbiter fanout)

Date: 2026-06-06

Claim boundary: `simulated_teacher_as_learner_not_human_learning`.

## What changed from the A18.36 plan

The A18.36 note closed by promising an A18.37 fanout that "runs the remaining 11
families to test whether convergence generalizes or `relational_betweenness` is a
singleton." That plan is **superseded**. Running all 11 families would have been
ablation creep; worse, it would have rested cross-family claims on the *overlay*
correctness channel, which A18.37 shows is **bidirectionally lexically fragile**
(it produced both a false-negative — A18.36 — and a false-positive, below).

A18.37 instead did two things: (1) introduced an **architecture-independent
arbiter** and applied it uniformly; (2) used the resulting clean reads to locate
the actual mechanism. The mechanism turns out to be **per-card**, which makes a
"family convergence rate" the wrong unit of analysis.

## The arbiter: blind-option adjudication

`scripts/blind-option-adjudication.js` (+ `tests/blindOptionAdjudication.test.js`).
A critic reads only the held-out continuation and reports, in free text, which
option the learner finally commits to and on what basis
(`named_relation | surface_colour | proximity | clean_path | other | unclear`).
The target/decoy aliases are **held out from the critic**; a downstream mechanical
step maps the free-text option to target/decoy. Paraphrase-robust by construction
(it never substring-matches the continuation), so it is immune to the lexical
fragility that bit the overlay in both directions. Three critics per arm.

Verdict per card: `policy_memory_option_advantage` (S1 commits to target, S0 does
not) · `no_option_headroom` (both commit to target) · `control_option_advantage`
· `neither_correct`.

**Arbiter soundness (audited).** Two ways the panel could cheat, both closed:
(1) *No answer-key leakage* — the target/decoy aliases are held out of the critic
prompt, which states "you do not know the answer key… you must not guess one";
the verdict is computed downstream from the critic's free-text `committed_option`,
not by the critic. (2) *No `named_relation` bias inflating S1* — the verdict
depends only on *which option* the learner commits to (pinned by an exact
`committing_quote`), never on the `reasoning_basis` label. Clinching evidence: on
distal sib1 the critic labelled **both** arms `named_relation` rather than
reflexively awarding S1 the "structural" label — an unbiased reader giving the
same basis to the same reasoning.

Decision recorded: **do not** keep tuning the overlay marker matcher (over-tuning
trap). The blind panel is the convergence arbiter; the overlay's two-directional
failure is documented as an instrument finding, not patched into agreement.

## The eight cards, all on one channel

Two waves, four families, eight held-out siblings — all adjudicated on the one
blind channel. The first wave (pre-existing-landmark relations) and the survivor
wave (constructed-device relations that passed attempt-1 elicitation) are reported
together because the *mechanism* is the same across both.

| family | sibling | S0 (no policy) | S1 (policy memory) | blind verdict |
|---|---|---|---|---|
| relational_betweenness | sib1 blue_right | "slot one" — colour 3/3 | "slot six" — span 3/3 | `policy_memory_option_advantage` |
| relational_betweenness | sib2 gold_middle | "slot three" — clean_path 3/3 | "slot seven" — span 3/3 | `policy_memory_option_advantage` |
| distal_correspondence | sib1 blue_upper | "upper lane" — relation 3/3 | "upper lane" — relation 3/3 | `no_option_headroom` |
| distal_correspondence | sib2 gold_middle | "left lane" — colour 3/3 | "middle lane" — relation 3/3 | `policy_memory_option_advantage` |
| second_in_constructed_order | blue_lower | "inner-left tray" — other 3/3 *(target)* | "inner-left tray" — relation 3/3 | `no_option_headroom` *(leak)* |
| second_in_constructed_order | gold_lower | "upper tray" — other 3/3 *(decoy)* | "lower tray" — relation 3/3 | `policy_memory_option_advantage` |
| constructed_midpoint | plum_posts | "east-post kelo" — colour 3/3 *(decoy)* | "clean-rail kelo" — relation 3/3 | `policy_memory_option_advantage` |
| constructed_midpoint | teal_pegs | "open-track naro" — clean_path 3/3 *(target)* | "open-track naro" — relation 3/3 | `no_option_headroom` *(leak)* |

**Tally: 5 headroom / 3 no-headroom of 8 cards; every elicited family converges on
≥1 sibling** (relbet 2/2, distal 1/2, second_in_order 1/2, constructed_midpoint
1/2). Three families *split* across their two siblings — same family, same
registered policy, opposite verdicts. The split is itself the cleanest possible
evidence that "does the policy help?" is **not a family property** but a per-card
one. relational_betweenness's both-sibs headroom here also replaces A18.36's
overlay-only reading with the trusted channel — same conclusion, better evidence.

**The survivor wave was pre-registered card-by-card and held 4/4.** Before the
blind panel ran, each survivor's verdict was predicted from a direct reading of
its continuations (`scripts/a18.37-survivor-headroom.js` header): blue_lower
no-headroom (leaky lane), gold_lower headroom (overlay false-negative), plum_posts
headroom (overlay false-negative), teal_pegs no-headroom (leaky track). The
architecture-independent arbiter returned exactly those four. So the per-card
mechanism is **predictive, not merely descriptive** — and it reaches *constructed*
(built-device) relations, not only the pre-existing-landmark spans of the first
wave. The two predicted overlay false-negatives (gold_lower, plum_posts) are now
confirmed on the trusted channel: the overlay scored "no headroom for both" on all
four survivors, and the blind panel overturns it on exactly the two where S0 takes
a decoy.

## Two routes to no-headroom, separated by the basis label

The three no-headroom cards reach that verdict by two distinct mechanisms, and the
arbiter's `reasoning_basis` field — assigned blind, with the answer key held out —
separates them cleanly:

- **Self-solve route** (distal sib1 blue_upper): S0 *rediscovers the registered
  relation unaided*, so both arms reach the target. Tell: **S0 basis =
  `named_relation`** (3/3) — the fresh tutor genuinely named the relation.
- **Leak route** (blue_lower, teal_pegs): S0 takes a *surface shortcut that
  coincides with the target* on a cue-leaky card (the lane cue *is* the runner-up
  tray; the open-track cue *is* the midpoint). Tell: **S0 basis = `other` /
  `clean_path`** (a surface pick), even though S1 reaches the same option via
  `named_relation`.

That the same blind label that pins *which option* the learner commits to also
distinguishes *why* a no-headroom card got there — without ever seeing the
target/decoy aliases — is a second, independent check that the panel is reading
the continuation rather than guessing an answer key.

## The instrument finding the arbiter exposed

The overlay (A18.36's relaxed matcher) was fixed on the *target* dimension but not
the *marker* dimension. On distal sib1 it manufactured a `policy_memory_
correctness_advantage` because S1 wrote "far corner marker" verbatim while S0
paraphrased the *same* relation as "rust header matches the rust corner" — a
**marker-dimension false-positive**. The blind panel reads both as the same
named relation (both → target) and returns `no_option_headroom`. So the overlay
fails in *both* directions (A18.36 false-negative on targets; this false-positive
on markers); only the architecture-independent channel is safe to aggregate over.

The survivor wave confirms the false-negative direction on fresh cards: the
overlay scored "no headroom for both" on all four constructed-device survivors,
but the blind panel finds genuine headroom on two of them (gold_lower, plum_posts)
— S0 commits to a *decoy* (upper tray; "the kelo beside the east post, plum like
the badge"), S1 to the *target*, a separation the overlay's marker matcher missed
because S0 and S1 phrase their picks differently. Two confirmed survivor
false-negatives plus the first-wave false-positive: the overlay is unsafe in both
directions on built relations too.

## The mechanism: teacher-side relation rediscovery, gated by where the shortcut lands

Reading the eight continuations directly (not just the verdicts) locates the cause.
Headroom appears **exactly when the fresh, no-policy S0 tutor fails to
spontaneously re-derive the registered relation _and_ rationalises a surface
shortcut that lands on a _decoy_.** Both conditions are necessary; the survivor
wave is what shows the second one is not automatic.

Headroom (S0 → decoy, S1 → target):
- distal sib2 (3 lanes): S0 did *not* rediscover the correspondence — it
  rationalised "the badge names its own criterion" (gold → left decoy) → headroom.
- relational_betweenness (both): S0 rationalised colour (sib1) / reachability
  (sib2) and never named the tag-and-stud span → headroom.
- second_in_order gold_lower: S0 took "highest load = capacity" (→ upper decoy);
  S1 named the runner-up of the built load order (→ lower target) → headroom.
- constructed_midpoint plum_posts: S0 took the colour cue ("the kelo beside the
  east post, plum like the badge" → decoy); S1 named the between-posts midpoint
  (→ clean-rail target) → headroom.

No headroom, route 1 — *self-solve* (S0 → target via the relation):
- distal sib1 (2 lanes): S0 *did* rediscover the corner-correspondence relation
  unaided ("Could 'support' depend on a lane header echoing the card's corner
  key?") → both arms reach the target → no headroom.

No headroom, route 2 — *leak* (S0 → target via a surface shortcut that coincides):
- second_in_order blue_lower: the lane cue ("inner-left") *is* the runner-up tray,
  so S0's surface pick lands on the target without naming the order relation → no
  headroom.
- constructed_midpoint teal_pegs: the open-track cue *is* the between-pegs midpoint,
  so S0's clean-path pick lands on the target → no headroom.

The operative variable is the *joint* geometry: a card yields headroom only if the
relation is non-forced enough that a fresh tutor takes a shortcut, **and** that
shortcut is steered onto a decoy rather than coinciding with the answer. When the
relation is forced (few lanes, salient correspondence) S0 self-solves; when a
surface cue happens to coincide with the target the card *leaks*; in both cases the
registered policy adds nothing the fresh tutor did not already reach. On the
remaining cards the policy's value is in **stabilising the teacher's
relation-selection** — supplying the specific relation an earlier tutor already
derived in training. This sits precisely on the claim boundary: the effect is a
property of the *simulated teacher's* rediscovery reliability and the *card's*
cue-geometry, not of learner capacity or real learning.

## Resolved — the per-card verdict is structural, not a teacher coin-flip

With n=1 S0 per card, the per-card verdict could be **structural** (stable across
reruns) or a **stochastic teacher coin-flip** (a single draw from a noisy
process). `scripts/a18.37-s0-stability.js` reran the identical
`a18.8_s0_hard_bounded_transfer` ablation k=3 within the distal family —
sib1 (no-headroom) vs sib2 (headroom) — and blind-adjudicated every S0/S1. The
result is the cleanest separation the design admits:

| sibling | interpretation | S0 self-solve rate | headroom rate |
|---|---|---|---|
| distal sib1 (blue_upper) | `stable_no_headroom` | 3/3 (1.0) | 0/3 |
| distal sib2 (gold_middle) | `stable_headroom` | 0/3 (0.0) | 3/3 |

Same family, same registered policy, **opposite verdicts at deterministic
extremes with zero within-card variance.** On sib1 the fresh S0 tutor
rediscovered the corner-correspondence relation on all three reruns ("upper
lane", target, named_relation each time); on sib2 it took the colour shortcut on
all three ("left lane"/decoy twice, an unclear non-commit once — never the
target), while S1 reached "middle lane"/target every time. A coin-flip would put
both cards near 50/50; instead each is pinned to an extreme. The per-card
predictor is therefore **structural card-geometry, not noise** — a positive
answer to "is the convergence real," not a *verifiable signal of its absence*.
Tally: `…/a18.37-stability/distal_holdout_{blue_upper,gold_middle}.stability.json`.

## Resolved — the predictor is bounded by the elicitation gate (exclusion_filter)

`exclusion_filter` (`constructed_exclusion`, `requires_constructed_device: true` —
a *built* knockout pass, unlike relational_betweenness's pre-existing landmark
span) was the pre-registered new relation *type*. The per-card rule predicted
headroom on both sibs; but the family **never reaches the headroom test**,
because it fails attempt-1 elicitation. The training-seed gate returns
`revise_again` with every dimension passing except one:
`old_warrant_misclassification = 0.6 < 0.7` (the sole blocking warning). The
gate's own free text says why: *"Old rule produces three-way tie rather than a
clear wrong prediction. Learner reports 'three strong clues pulling three
different ways' — this is indeterminacy/contradiction rather than
misclassification of a specific case."*

This is the **informative** branch of the pre-registered prediction. It does not
bound the headroom predictor; it bounds the **elicitation gate that feeds it.**
Convergence is a two-stage property: a relation only reaches the headroom test if
its old-rule violation is a *confident wrong answer* (a misclassification the
tutor can name and correct), not a *tie* (indeterminacy the tutor can only flag).
The constructed arithmetic/elimination devices (count_ladder, running_sum,
elimination_bracket, exclusion_filter) deadlock into ties and fail here; the
relational, ordinal, and midpoint devices misclassify and survive. So the unit of
"does policy transfer" is defined only over elicitation survivors — exactly why
`summarize-a18-convergence-rate.js` reports elicitation and headroom as two
separate rates. Artifact:
`…/a18.35-exclusion-filter-local/…/training-seed.full/gate.json`.

## What this does and does not establish

- DOES: with one trusted channel, policy memory produces an architecture-
  independent advantage on **5 of 8 fresh held-out cards across four families**
  (relbet ×2, distal sib2, second_in_order gold_lower, constructed_midpoint
  plum_posts); every elicited family converges on ≥1 sibling, and three families
  split across siblings — so headroom is a per-card, not a per-family, property.
- DOES: show the per-card variance is **not** noise — the distal family's two
  cards are rerun-stable at opposite extremes (`stable_no_headroom` 3/3 vs
  `stable_headroom` 0/3 self-solve), so the per-card verdict is structural
  card-geometry.
- DOES: confirm the mechanism is **predictive** — the four constructed-device
  survivors were each pre-registered card-by-card from a direct continuation read
  (leak vs decoy) and the blind arbiter returned all four as predicted (4/4),
  including the two overlay false-negatives (gold_lower, plum_posts). The
  leak-vs-non-leak rule reaches *built* relations, not only pre-existing-landmark
  spans.
- DOES: locate the elicitation boundary — `exclusion_filter` fails attempt-1 on
  `old_warrant_misclassification` (a three-way tie, not a wrong answer),
  confirming that the headroom predictor is defined only over elicitation
  survivors and that constructed *arithmetic/elimination* devices deadlock before
  the test.
- DOES NOT: show human learning, deployed tutoring, model-weight learning, or a
  main-harness rate effect. The claim boundary is
  `simulated_teacher_as_learner_not_human_learning`.
