# Typed performance contract and working screens

Date: 2026-07-16

Status: development gate passed; not held-out evidence

## Change under test

The speaking tutor now receives a public-only typed performance contract. For
dramatic counterpressure, the contract separates four functions:

1. identify the already-public pressure target;
2. place contrary public evidence against it;
3. perform the collision through the selected in-scene part;
4. return a concrete test or next move to the learner.

The prompt no longer requires one stock word such as `breaks`. It asks for the
dramatic relation and permits a natural clause to do more than one job. When a
clarification invitation is required, the prompt asks for a separate direct
permission statement instead of hiding permission inside another exercise.

## Calibration and recognition boundary

V21 Gazette turns 4 and 7 are frozen in
`tests/fixtures/tutor-stub-performance-calibration/gazette-answer-seeking-v21.json`.
Turn 4 is labelled a semantic false negative: the original sentence performs
all four functions. Turn 7 is labelled a genuine miss: the newly read evidence
is not made to press against the ready judgment.

A narrow, screen-only semantic adjudicator can correct an isolated
`dramatic_counterpressure` miss only when:

- every safety, clue-release, question-support, composition, repetition, and
  closure audit passes;
- all five non-actorial response axes pass;
- the selected host part is already visible; and
- the sole remaining issue is `missing_selected_performance_tactic`.

The adjudicator must quote exact public spans for all four obligations. The
harness derives offsets only when a quotation occurs exactly once; missing,
hallucinated, or ambiguous quotations fail closed. This adjudicator is not on
the live dialogue path because the runtime already delivers an isolated tactic
miss as an advisory. Adding it there would add latency without avoiding a
rewrite.

## Deterministic preflight

- 29/29 derivation worlds passed the quality gate.
- 155/155 focused tests passed in the final verification pass.
- Greyfen V19, Skyway V18, and Tallow V20 model-free corpora produced zero
  audit regressions and zero safety failures.
- The normal Marrick speaking-prompt privilege dry run passed.

## Working-screen results

Both cells reuse explicitly non-held-out development seeds and frozen public
prefixes. Each screen generates one original tutor candidate per turn and does
not run a learner, classifier, DAG update, repair, fallback, or continuation.

Iteration 1:

| Cell | Original acceptance | Safety | Repair / rewrite / fallback |
|---|---:|---:|---:|
| Greyfen / answer-seeking | 2/4 | 0 | 0 / 0 / 0 |
| Skyway / answer-seeking | 3/4 | 0 | 0 / 0 / 0 |

The only between-iteration change was in the speaking prompt: make the public
pressure and contrary clue visibly collide, and make clarification permission
direct.

Iteration 2:

| Cell | Deterministic originals | Semantic corrections | Final originals | Mean generation latency | Safety |
|---|---:|---:|---:|---:|---:|
| Greyfen / answer-seeking | 3/4 | 1 | 4/4 | 11,846 ms | 0 |
| Skyway / answer-seeking | 3/4 | 0 | 3/4 | 7,059 ms | 0 |

Greyfen's one isolated ambiguity was adjudicated by the saved Sol analysis
model. Its first semantic response was retained and reparsed after the harness
stopped asking the model to count UTF-16 offsets. No replacement tutor draw or
second judge call was made. The original judge call took 30,264 ms; that cost is
evaluation-only and does not affect dialogue latency.

Skyway turn 6 remained rejected for three genuine failures:
`opaque_clue_release`, `missing_exhibit_action`, and
`missing_selected_performance_tactic`. The semantic adjudicator was correctly
ineligible.

Artifacts:

- `/Users/lmagee/Dev/.tutor-stub-auto-eval/typed-performance-working/iteration-1/greyfen.json`
- `/Users/lmagee/Dev/.tutor-stub-auto-eval/typed-performance-working/iteration-1/skyway.json`
- `/Users/lmagee/Dev/.tutor-stub-auto-eval/typed-performance-working/iteration-2/greyfen-final.json`
- `/Users/lmagee/Dev/.tutor-stub-auto-eval/typed-performance-working/iteration-2/skyway-final.json`

## Claim boundary

The required 3/4 gate passed in both difficult development cells, with no
safety failure or fallback. Greyfen improved measurably between iterations, so
the two-consecutive-no-improvement stop did not fire. These are reused
development seeds, not held-out evidence; the result justifies moving to a
fresh predeclared matrix, not claiming broad generalization.
