# Sarcasm as Determinate Negation — Design Pre-Registration

Status: design note only. No cell allocated, no code changed, no run
authorized. A paid run needs the same discipline as the parent grid: frozen
plan, dry-run SHA, explicit operator authorization bound to that SHA.

## Motivating result

The negative-register effect grid (`eval-2026-08-05-87fe3664`;
`docs/research/paper-full-2.0.md` §6.7, v3.0.266) found the three registers
fail differently. Irony survived the stance gate and converted (6/15
faithful, 5/6 positive) with the highest faithful execution (86.3). Staged
face-threat mostly dropped the act (4/15 faithful) and performed it worst
(34.8). Sarcasm held the act most often (8/15) and converted least (5/8,
with 0 positive on its faithful question-flood and rote-parroting rows).

The working diagnosis: the current sarcasm cue contract enforces the manner
(edge, exaggerated conviction) without requiring determinate content. The
register that compiles into propositional moves (irony, on the echoic
reading of Sperber and Wilson) survives and teaches; the register that is
pure interpersonal pressure decays; sarcasm sits between because its shape
is scriptable but its cargo is optional.

## Decision question

If every sarcastic tutor utterance must implicate one determinate negation
of a named learner claim — assert P* with visibly false conviction so the
learner can derive not-P, where P is a specific claim the learner made —
does (a) treatment fidelity survive at grid scale, and (b) conversion among
faithful rows improve, and (c) the learner actually recover the implicated
negation?

The theoretical frame is double negation with a determinate target: the
sarcastic assertion is false, its manner marks it as false, and the product
of the two negatives is a specific corrected claim. Hegel's term is
determinate negation — the negation must be OF something — and it names the
difference between sarcasm that teaches and sarcasm that only wounds. On
this reading the manner marker is the warrant for the derived content, so
manner is scored as content delivery, not tone.

## Frozen minimum design (to be instantiated before any authorization)

- One new cell (ID allocated per the registry discipline at implementation
  time; grep `config/tutor-agents.yaml` first), a variant of cell 197's
  sarcastic contract with one addition: each sarcastic utterance must name
  its target claim P (a claim the learner voiced in-dialogue) and implicate
  its negation. Utterances with edge but no determinate target fail the
  contract.
- Targets: the same five controlled resistance targets as the parent grid.
- Repeats: three per target. Planned rows: 1 × 5 × 3 = 15.
- Generation stack: `codex.gpt-5.5` both seats (parent-grid parity).
- Scoring: tutor-only rubric v2.2 (claude CLI, model ID `claude-sonnet-5`,
  stored label `claude-code/claude-sonnet-5`); register rubric + stance
  gate (`claude-code.sonnet-5`); both unchanged from the re-frozen parent
  plan.
- New measure, negation recovery: for each faithful sarcastic utterance
  with target claim P, does the learner subsequently voice not-P (or the
  corrected claim) in their own words? Implemented on the existing
  text-to-constant answer bridge (`services/answerSurface.js` pattern);
  deterministic where the world's claim set permits, judge-scored
  otherwise. Recovery is scored per utterance and aggregated per row.

## Estimands

Assigned-arm and faithful-arm, exactly as the parent grid, plus:

1. Fidelity rate under the tightened contract vs the parent sarcasm arm's
   8/15 (does requiring cargo cost fidelity?).
2. Faithful-row conversion vs the parent's 5/8 (exploratory comparison
   against the parent grid's rows; stated as cross-run and unpowered).
3. Negation-recovery rate among faithful rows, and its co-movement with
   positive local outcomes (the mechanism check: if recovery does not
   co-move with outcomes, the determinate-negation reading fails even if
   scores rise).

Noncompliance exclusions and invalid person-attack violations stay separate
throughout. The reporter must fail closed unless all 5 target cells hold 3
rows with all three measurements.

## Interpretation boundary

Fifteen rows, one register, one stack: exploratory system estimates only.
Any claim lands in `docs/research/paper-full-2.0.md` §6.7 first,
simulated-only and non-human-facing, before any spin-off. A null on (c) is
informative: it would say the manner-as-content reading does not cash out
behaviourally on this stack, and the parent grid's sarcasm result stands as
a manner-only effect.

No model-consuming work was done in preparing this note.
