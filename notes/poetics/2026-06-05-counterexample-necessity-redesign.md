# Counterexample-Necessity Redesign

Date: 2026-06-05

## Boundary

This is a mechanism redesign after the `none / T18` hard negative. It does not claim reliable peripeteia-induced adaptation, and it does not reinterpret the failed source-strip/device-specificity variants as successes.

## Diagnosis

The failed `none / T18` variants made force-source reasoning visible, but blind critics could still read the tutor's move as ordinary physics pedagogy. The source strip, source mark, or arrowhead-covering device was device-specific enough for local screening, but not origin-specific enough for panel attribution.

The missing element is not more visible source marking. The missing element is a public counterexample in which the learner's old warrant makes the wrong call.

## Redesign Rule

A redesigned replay may escalate only if the public transcript shows:

1. The learner's old public rule or check.
2. A public case where that rule misclassifies, wrongly predicts, or generates a contradiction.
3. The tutor's peripeteia-linked shift to a new relation or test.
4. The learner's actional use of the new relation.
5. The learner's public acknowledgement that the old rule failed in this case.

This is now encoded as the local-gate score `old_warrant_misclassification`.

## T18 Target

For `none / T18`, avoid another source-first variant. A stronger design would make the learner's old direction/source heuristic visibly fail by producing two cases that look the same under the old rule but require different force attributions under the new relation.

Candidate public mechanism:

- Put two arrow cases on the board with the same visible arrow direction.
- Make the sources/contact relations different.
- Ask the learner to apply the old direction-based rule to both cases.
- Let that rule predict the same force label for both.
- Introduce the new relation only after the contradiction is public: force labels follow the actor-on-object/contact-source relation, not arrow direction alone.
- Have the learner say, in ordinary domain language, that direction by itself gave the same answer for two different source relations, so the source/contact relation has to settle the label.

This differs from source-strip repair because the new relation is not merely a clearer representation. It is required to resolve a public misclassification produced by the old warrant.

## Stop Rule

Do not panel a redesigned `T18` artifact unless local critics score `old_warrant_misclassification >= 0.7` alongside the existing public-causal-bridge and device-specificity thresholds.

## Local Smoke Result

Run roots:

- `exports/discursive-replay-loops/discursive-replay-loop-counterexample-necessity-redesign-20260605-i01`
- `exports/discursive-replay-loops/discursive-replay-loop-counterexample-necessity-redesign-20260605-i02`

Both local redesign attempts stopped at `revise_again`; neither should be sent to panel.

| Iteration | Public causal bridge | Device specificity | Old-warrant misclassification | Gate |
| --- | ---: | ---: | ---: | --- |
| `i01` | 0.80 | 0.70 | 0.80 | `revise_again` |
| `i02` | 0.75 | 0.60 | 0.75 | `revise_again` |

Interpretation:

- The new counterexample-necessity gate is not empty: both candidates made the old rule publicly misclassify.
- The remaining failure is still device specificity: even with a public counterexample, critics can read source/contact-first force naming as a standard physics routine that could have been introduced before the obstruction.
- Do not panel these runs. A stronger redesign likely needs to leave the force-source scaffold family entirely, or use a T18 variant where the new relation is not already ordinary domain pedagogy.
