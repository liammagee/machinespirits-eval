---
id: tutor-instrumentation-free-running-marginal-matrix
title: "Tutor instrumentation: prospective free-running marginal matrix"
status: blocked
type: experiment
priority: P2
owner: codex
source: manual
created: 2026-08-29
updated: 2026-08-29
verification: "Blocked: no design registration or model calls in this card yet. Completion requires a prospective bounded design, learner-parity preflight, delivery accounting, fresh outcome data, and claim-audited reporting."
blocked_by: "A prospectively registered subset of instrumentation arms plus explicit GO for a bounded model-call/spend ceiling; the present comparison evidence is frozen replay or whole-stack free-running, not a fresh single-block outcome matrix"
claim_status: planned
depends_on:
  - tutor-instrumentation-ab-harness
  - tutor-instrumentation-showcase
  - adaptive-tutor-instrumentation-contrast-gallery
links:
  notes:
    - docs/tutor-instrumentation-ab.md
    - docs/tutor-instrumentation-showcase.md
---

# Prospective free-running instrumentation matrix

The frozen A/B harness identifies how one advisory block changes a candidate
reply under identical public context. The free-running showcase compares bare
against a whole instrumented stack. Neither establishes the marginal outcome
effect of one block once the learner can answer the changed tutor.

## Design requirement

Before any model call, register a deliberately small matrix selected from the
frozen contrasts rather than running every available block:

- a minimal due-evidence carrier;
- a state-contingent action/card arm;
- the first-draft contract or another deliberately over-specified control;
- bare and whole-stack comparators only where they identify a planned contrast.

Hold learner configuration, world, model, effort, turn caps, guards, and
delivery policy fixed. Report sensing, selected instruction, candidate text,
delivered text, immediate tutor conduct, learner response, legitimate closure,
and cold-baselined transfer as separate endpoints. Predeclare sample size,
power/sensitivity, attrition, delivery floors, spend ceiling, and the null
branch. No human-learning claim follows from simulated learners.

## Stop rule

Do not launch from this card. If the registered manipulation does not produce
distinct delivered tutor conduct, stop at the manipulation failure instead of
reading learner outcomes.
