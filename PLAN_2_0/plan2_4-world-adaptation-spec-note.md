# Plan 2.4: World-Specific Adaptation Specs

Date: 2026-06-19
Status: design note for a possible Plan 2.4 follow-up path

## Question

Could a new scenario or world first generate its own adaptive measures as a
rubric-like preliminary step, then use those measures inside the dialogue
controller?

## Current Branch Position

The current Plan 2.1 branch does not need this to finish its evidence slice.
Its adaptation mechanism is already explicit at a useful level of abstraction:

- learner-state hypotheses;
- bounded pedagogical action families;
- intervention contracts;
- proof/release/ownership gating;
- realization checks;
- outcome observation;
- ledger-driven policy updates;
- strict-shift, pair-specificity, belief-calibration, outcome-closure, and
  quality analyses.

That is sufficient for the present bounded claim: simulated trap and held-out
suite evidence of adaptive strategy shifting with tentative quality gains.

## Useful Follow-Up Form

For broader generalization, a preliminary world-specific adaptation spec could
be useful. It should be treated as a precompiled contract, not as a live judge
rubric.

A safe `world_adaptation_spec` would be generated before dialogue begins and
then locked for the run. It would define:

- world-specific learner-state evidence;
- permitted pedagogical action families;
- expected transitions for each action;
- success and failure evidence;
- forbidden shortcuts, leaks, or over-helping moves;
- domain-specific outcome observability requirements.

The controller could then use this spec as additional constraints and
affordances while preserving the existing closed-loop architecture.

## Boundary Conditions

This should not become a circular evaluator.

Avoid:

- letting the tutor see hidden expected labels as answer keys;
- generating a flexible rubric and optimizing against it live;
- using the same generated rubric both to steer behavior and to prove success;
- replacing independent quality or outcome analysis with self-authored criteria.

Use it instead as a versioned, logged, pre-dialogue world contract whose effects
can be tested against held-out scenarios and independent judges.

## Proposed Future Test

If Plan 2.1 clears Opus, a next branch could compare:

1. generic closed-loop controller;
2. generic controller plus locked `world_adaptation_spec`;
3. negative control with scrambled or mismatched world spec.

The target evidence would be improved pair specificity and quality on new
worlds without degrading previously passed trap suites.
