# Adaptive Warrant Baseline — Remaining Next Steps

**Date:** 10 August 2026
**Status:** sequence complete through its stop rule; n=10 not launched
**Workplan item:** `adaptive-warrant-baseline-study`

## Frozen evidence boundary

The valid pilot root is:

`.tutor-stub-auto-eval/adaptive-warrant-baseline-pilot-v2-live-2026-08-10/`

The blinded corpus contains 18 decision points and is frozen at SHA-256
`c8f470ba6fd199c62564ac4ead5973d492c0efc7b5e81b6e184aa01459d42ea3`.
Neither annotator may inspect the private key, study results, gate/shadow
decisions, condition identities, the other annotator's labels, or any later
tutor/learner turn before submitting all labels.

Both annotators use the same decision-time rubric:

- `yes`: evidence available when the current learner turn arrived warrants a
  change in pedagogical strategy/repair policy rather than another hold;
- `no`: holding the strategy in force remains pedagogically defensible;
- `uncertain`: reasonable readers could disagree on whether the evidence is
  sufficient;
- distinguish strategy revision from a surface wording/register improvement;
- use only the public transcript prefix, current learner turn, learner-record
  counts, and strategy in force. Flat record growth alone is not failure when
  the learner is productively testing a claim.

The annotators are isolated runs of the same model family. This is independent
blind replication, not cross-model validation; that limitation must accompany
the agreement result.

## Ordered sequence and gates

1. **Freeze two independent annotations.** Each reader labels all 18 cases and
   gives a short evidence note. Validate completeness and the allowed label
   vocabulary before unblinding.
2. **Score consensus.** Use the prebuilt scorer. Hard `yes`/`no` agreement is
   scored; disagreement or either `uncertain` label is reported but excluded.
   Persist precision, recall, accuracy, raw agreement, the confusion counts,
   and source hashes.
3. **Audit errors and diligent-control firings.** Unblind only after both files
   are frozen. Separate classifier/warrant errors from reasonable uncertainty,
   policy-choice errors, realization failures, and downstream model variance.
4. **Choose repair versus design revision.** Do not tune thresholds on ambiguous
   cases merely to improve the score. If a legible rule defect appears, treat
   this corpus as burned, implement the smallest principled repair, rerun all
   earlier gold regressions, and create fresh validation before scaling. If the
   main problem is generation variance, revise the comparison design rather
   than the warrant policy.
5. **Decide on n=10.** Scale only if decision quality is defensible, diligent
   false positives are bounded, live/shadow parity stays complete, and the
   design can distinguish intervention effects from the inert observe arm's
   frontier-model draw variance.
6. **Close the evidence record.** Update the baseline design, living log,
   architecture phase table, workplan item, and study report. Any empirical
   claim intended for reuse must enter the canonical Paper 2.0 first; automated
   learner evidence cannot support a human-learning claim.

## Stopping rule used

The sequence stops before n=10 if independent annotation reveals a decision-
quality defect, if diligent false positives remain material, or if the
comparison still cannot separate a gate effect from ordinary model-draw
variance. A stopped scale-up is a valid outcome, not an incomplete study.

## Execution result

Both primary annotation files were frozen before the private key was read.
The two same-family but context-isolated readers labelled all 18 cases with
raw agreement 0.833. Fifteen hard yes/no consensus cases were scored and three
were excluded as uncertain. The pre-repair gate produced 0 true positives,
9 true negatives, 4 false positives, and 2 false negatives: precision 0,
recall 0, and accuracy 0.600.

The error audit found three separable defects rather than one tunable cutoff:

- old no-growth trouble could remain live after later learner-record growth;
- the engaged-analytic mask could suppress a real unmet-evidence stall; and
- a permission-framed turn could trigger challenge even when it made a
  defensible bounded claim or requested an appropriate next exhibit.

A bounded candidate repair discharged old flat-record evidence on growth,
required sustained deference, and let recurring interactional trouble defeat
the analytic mask only after prior record growth. It preserved the earlier
held-out checks and retrospectively reached 15/15 on the now-burned primary
sample. That result was treated as calibration only.

## Fresh holdout and stop decision

A second 18-case decision sample was frozen from decision points not present in
the primary sample. The first attempted freeze was rejected before labels were
accepted because an explicit overlap check found three shared cases. The
corrected corpus has zero overlap and SHA-256
`e8d2df91d3ab6c73191f7f8417f53b99645bab340af272379411671f4409ad9e`.

Two replacement blind readers labelled the corrected holdout with raw agreement
0.889. Sixteen hard-consensus cases were scored and two were uncertain. The
candidate repair produced 0 true positives, 13 true negatives, 1 false
positive, and 2 false negatives: precision 0, recall 0, accuracy 0.813. The
pre-repair rule on the same cases had precision 0.333, recall 0.500, and the
same 0.813 accuracy. The candidate therefore did not generalize and was
rejected; its runtime changes were reverted.

The fresh misses expose a missing representation, not another obvious numeric
threshold:

- a successful `challenge_resistance` turn should license an exit from that
  repair family even when the proof record does not grow immediately;
- repeated requests for a specific missing exhibit or comparison need an
  explicit expected-uptake/deadline state rather than a generic analytic mask;
- historical uptake/repetition trouble must not outweigh a currently
  productive learner move without a typed unresolved commitment.

The n=10 scale-up is therefore stopped. Decision quality is not defensible, and
the inert observe arm also moved against baseline: paired observe-minus-off
record growth was +0.6 for low-agency, +0.4 for diligent, and +0.8 for
affective-resistant learners, compared with active-minus-off values of 0.0,
-0.2, and +0.2. A larger version of the same paired-seed design would not
separate gate effects from frontier-model draw variance.

## Remaining architecture work

The next implementation should add a typed action-family contract with both an
expected learner response and a termination condition. It must represent
successful repair exits and unresolved evidence requests directly, then be
evaluated on newly generated, independently annotated decisions. Only after
that decision gate passes should downstream effects be tested with frozen-prefix
counterfactual replay or replicated draws that estimate model variance. The
existing `off|observe|active` gate remains experimental and off by default.

These are internal automated-learner calibration results, not a paper claim or
evidence of human learning.
