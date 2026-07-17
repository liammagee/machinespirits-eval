# First-draft blind transcript review

Date: 2026-07-16  
Status: model-free review complete; micro-plan redesign not warranted by this sample

## Question

Were recent first-draft failures genuinely worse tutor replies, or were we
optimizing an increasingly strict evaluator whose repairs could make the
visible exchange worse?

## Method

The local review builder read all 91 saved V18-V22 tutor turns without making a
model call. It retained the current learner line and up to two preceding public
learner/tutor exchanges. It excluded every original candidate that failed the
evidence-leak boundary, then sampled with seed `20260716`:

- six paired cases, each containing one rejected-but-public-safe original and
  its delivered repair in shuffled A/B order;
- eight accepted originals as calibration;
- 20 candidate replies in total across V18, V19, V20, V21, and V22.

Campaign, audit verdict, source class, repair source, and failure labels were
absent from the blind corpus and HTML. One Codex review pass rated only
naturalness, learner responsiveness, dramatic effect, clarity, and usefulness
on a 1-5 scale. The sealed key was consulted only after all ratings were
written. This is an exploratory single-reviewer audit, not a human preference
study.

Unsafe candidates were never included in the visible review corpus. The full
inventory counted them but stored no unsafe text in the blind artifact.

## Result

| Source revealed after rating | n | Overall | Naturalness | Learner response | Dramatic effect | Clarity | Usefulness |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Accepted original | 8 | 4.55 | 4.13 | 4.88 | 4.38 | 4.63 | 4.75 |
| Rejected original | 6 | 4.27 | 4.17 | 4.83 | 3.17 | 4.50 | 4.67 |
| Delivered repair | 6 | 3.67 | 3.17 | 4.50 | 2.50 | 4.00 | 4.17 |

All six rejected originals were blindly preferred to their delivered repairs.
The mean paired delivered-minus-original difference was `-0.60` points. No
repair outscored its original.

The result does not say character realization is unimportant. Accepted
originals had the strongest dramatic-effect score (`4.38`), while rejected
originals were weaker on that dimension (`3.17`). It says the current repair
strategy did not restore that quality: repaired replies scored lower still
(`2.50`) and lost the most ground in naturalness.

The six paired rejection reasons were:

- selected actorial part not visible: two;
- selected performance tactic not visible: one;
- learner uptake not recognized: one;
- clarification invitation absent: one;
- explicit close not recognized: one.

Several rejected originals visibly answered the learner and read more cleanly
than their repairs. The closure case even contained `the incident record is
closed`; the clarification repair added boilerplate that made the response
longer; and the actorial repairs inserted stock phrases such as `I hold the
public evidence before us` without increasing dramatic effect.

## All-turn inventory

Across the 91 V18-V22 tutor turns:

- 51 originals were accepted;
- 37 rejected originals remained public-safe and were eligible for quality
  review;
- three unsafe originals were excluded from the review corpus;
- final delivery used 18 policy repairs, nine actorial-part repairs, five plain
  recoveries, four composition repairs, and four deterministic fallbacks.

Among the 37 public-safe rejected originals, the most common candidate-level
families were selected-part/tactic realization (23 candidates) and learner
response structure (14). Public clue-delivery integrity was implicated in only
three. Eighteen candidates failed only trajectory-realization checks, and 34 of
37 had no public-delivery-integrity failure at all. These are overlapping
shadow counts, not counterfactual pass declarations.

This distinction is now reported in shadow form only. Runtime delivery gates
have **not** been relaxed or reclassified, and none of the failed V18-V22
matrices has been relabelled as a pass.

## Decision on steps 4 and 5

The evidence supports evaluator/recovery over-constraint more strongly than a
need for another larger speaking prompt. The condition for the proposed
micro-plan redesign was therefore not met: missing character tactics did not
make the sampled originals worse than their repairs. Implementing another
uptake/action/tactic/handoff planning layer now would likely add more armature
before we know which obligations should be per-turn requirements.

For future evaluation, preserve as non-negotiable hard boundaries:

- private or future evidence leakage;
- unsupported evidence and source-perspective drift;
- duplicate or missing clue delivery;
- questions that require unstaged information;
- terminal continuation after required closure.

Evaluate these primarily across the trajectory rather than as automatic
per-turn repair triggers:

- exact selected actorial part;
- exact performance tactic;
- full six-axis configuration realization;
- a clarification invitation on every qualifying answer-seeking turn.

Learner uptake remains a core quality requirement, but the `Write:` examples
show its recognizer needs semantic validation before it can justify rewriting
a useful direct answer.

Before changing runtime delivery policy, obtain at least one independent human
rating pass through the generated HTML and compare agreement. If the human
review agrees, predeclare a new shadow-to-advisory gate change and validate it
on saved traces before any live campaign. Do not launch V23 from the current
evidence.

## Reproduction

Build the sealed review corpus:

```bash
node scripts/build-tutor-stub-first-draft-blind-review.js \
  --trace-root /Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-generalization-v18-live \
  --trace-root /Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-generalization-v19-live \
  --trace-root /Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-generalization-v20-live \
  --trace-root /Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-generalization-v21-live \
  --trace-root /Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-generalization-v22-live \
  --out-dir exports/tutor-stub-first-draft-blind-review \
  --seed 20260716 --pairs 6 --calibrations 8
```

Compile exported ratings after blind review:

```bash
node scripts/build-tutor-stub-first-draft-blind-review.js \
  --out-dir exports/tutor-stub-first-draft-blind-review \
  --ratings exports/tutor-stub-first-draft-blind-review/ratings.json
```

The interactive review surface is
`exports/tutor-stub-first-draft-blind-review/review.html`. The machine-readable
inventory and compiled report live beside it.

## Verification

- `npm run lint`: passed.
- `node --test tests/tutorStubFirstDraftBlindReview.test.js`: four passed.
- Full `npm test`: 5,938 passed, zero failed, one skipped.
- Additional model/API calls: zero.
