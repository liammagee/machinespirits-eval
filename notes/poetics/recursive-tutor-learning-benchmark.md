# Recursive Tutor-Learning Adaptation Benchmark

Date: 2026-06-05

Status: A18 design and zero-API implementation slice.

## Purpose

The benchmark treats the tutor as the learner. The simulated learner is the
environment that teaches the tutor which strategy survives resistance.

The measured unit is not a single transcript that looks responsive. The unit is
a family-level before/after contrast:

1. The tutor tries a strategy on a training seed.
2. The learner resists or produces shallow uptake.
3. A structured failure record names what broke.
4. The tutor writes a bounded strategy revision.
5. The revised policy is tested on a held-out sibling.

A positive result means only that the apparatus shows observable tutor policy
revision under simulated learner resistance. It does not establish human
learning, deployed tutoring, hidden-interior measurement, or real causal
learning from one transcript.

## Why This Differs From The Recent Negatives

Section 6.10 closed the hidden-interior separability path. The timing-pair pilot
then showed that pooled public timing attribution can be a coherence artifact:
the clean subset had no detected timing effect, while the positive pooled effect
lived where displacement damaged coherence.

A18 therefore avoids asking a blind critic to infer origin from one transcript.
It instead asks whether a recorded strategy lesson improves a held-out sibling
case compared with an unrevised baseline.

## Scenario-Family Schema

Each family must define:

- `family_id`: stable id.
- `obstruction_type`: the resistance grammar.
- `local_rule`: private artificial relation the tutor must discover and teach.
- `training_seed`: the first case where the tutor can fail and learn.
- `heldout_siblings`: sibling cases with the same obstruction grammar but new
  surface material.
- `success_criterion`: public uptake required on the held-out sibling.
- `forbidden_shortcuts`: true-rule phrases that must not appear in public setup
  or baseline tutor attempts.

The local relation should be artificial enough that ordinary curricular drift is
a weak explanation. A familiar school distinction is not a good seed unless the
scenario adds a local apparatus-specific rule that generic pedagogy would not
already solve.

## Attempt Chain

The intended artifact chain is:

```text
training_seed public transcript
  -> attempt1 local failure record
  -> bounded strategy revision ledger
  -> heldout sibling baseline transcript
  -> heldout sibling revised-policy transcript
  -> local gate
  -> panel only if locally clean
```

The first implementation slice materializes the fixture and next commands. It
does not spend API calls.

## Failure Taxonomy

Use one primary failure label:

- `missed_obstruction`: tutor did not notice the learner's resistance.
- `wrong_strategy_family`: tutor chose a tactic unrelated to the obstruction.
- `overhelped`: tutor supplied the target relation rather than making it public.
- `underconstrained`: tutor gave a generic prompt with no decisive public test.
- `learner_polish_without_uptake`: learner sounded reflective without using the
  new test.
- `coherence_artifact`: a manipulation made the transcript less coherent and
  explained the apparent result.
- `organic_drift`: the learner could plausibly have reached the reframe without
  the tutor's move.
- `no_headroom`: the baseline already succeeds or the revised arm has no room to
  improve.
- `success`: the failure record should not be used as a training negative.

## Strategy Revision Ledger

A revision must be finite and evidence-bound:

- `diagnostic_trigger`: public learner signal that creates the need to revise.
- `avoid_move`: plausible continuation the tutor should not repeat.
- `preferred_move`: revised tactic.
- `material_constraint`: public device/test/representation required.
- `uptake_test`: what counts as learner use rather than reflective polish.
- `transfer_warning`: when this lesson should not be transferred.
- `expiry_condition`: when to retire the lesson.

The revision may update a policy ledger or director plan. It may not rewrite the
held-out sibling answer, copy private truth into public speech, or smuggle the
target reframe into the setup.

## Local Gate

Before any panel, a family must pass all local checks:

- Static leakage check passes on training and held-out public setup.
- Baseline is weak or fails on the named obstruction.
- Revised policy improves on the held-out sibling.
- Public uptake is tied to the revised strategy.
- No coherence-confound warning.
- No organic-drift warning.

The panel question, if reached, is:

> Did the revised tutor strategy address the learner resistance in a way the
> unrevised baseline did not?

Do not pool across families until at least two families survive the local gate.

## Current Commands

Validate and materialize the zero-API pilot fixture:

```bash
npm run poetics:recursive-tutor-learning -- --dry-run
```

Materialize into a chosen output directory:

```bash
npm run poetics:recursive-tutor-learning -- \
  --out-dir exports/recursive-tutor-learning/a18-pilot-local \
  --force
```

The harness writes per-family training and held-out transcript stubs, a static
validation report, and replay commands that can later call the existing
discursive replay checker with the recursive tutor-learning gate enabled.

