# Program 2 weights × interface retest — pre-registration

Date: 2026-08-05
Status: Amendment 1 excluded pilot stopped after 2/8 sealed rows; cohort prohibited

## Why a new test is required

The historical committee-floor ablation is under-informative because the
question-only interface discarded cue-bearing material and the fallback path
repaired the two weight conditions differently. The first weights × interface
successor then sealed 45/48 dialogues, but its registered all-row coverage gate
was impossible: Marrick releases only four of six proof-path premises by turn
16. Those traces remain diagnostic and are not pooled into this retest.

This retest preserves the scientifically useful 2 × 2 design while moving the
fixed evaluation horizon to turn 22, when all six authored Marrick proof-path
premises are structurally available. The threshold remains 0.8; the world and
release schedule are not changed.

## Question and design

Does the trained same-lineage mini produce a stronger semantic warrant move on
its first pass than the untuned floor, and does a cue-preserving deterministic
interface transmit that skill more faithfully than the historical
question-only interface?

The cohort contains 48 dialogues:

- one world: `world_005_marrick`;
- two learner profiles: `proof_skipper` and `affective_resistant`;
- two weights: `program2-sft-instruct-v2` and
  `program2-floor-instruct-q8`;
- two deterministic interfaces: question-only `v1` and cue-preserving,
  non-generative `v2`; and
- six matched repeats per profile and cell.

Each `<profile>:r<repeat>` is a four-cell block. Jobs are shuffled with seed
20260805. The fixed primary horizon is turn 22 and the safety ceiling remains
40 turns.

## Frozen treatment and enforcement seams

The weight condition changes only the local Ollama mini artifact. The
interface condition changes only deterministic extraction:

- `v1` retains every valid question sentence in source order;
- `v2` selects a cue-bearing question when present, otherwise carries an
  existing cue-bearing statement immediately before the first question, and
  otherwise selects the first question.

Neither interface generates, paraphrases, or resamples text. After extraction,
the composer and fallback path are cue-blind. They may inspect only non-empty
output, verbatim span containment, exactly one question, public-evidence
safety, and new-premise safety. A failed composition returns the original
greedy mini reply. There are zero mini resamples and at most one composer call
per opportunity.

All other seams remain common: speaking tutor, learner/support models,
prompts, point-of-action detector, register policy, world, release speed,
context and token limits, downstream response guards, and run seed.

## Outcomes

The primary outcome, W1, is blinded semantic warrant validity in the raw mini
turn at each `warrant_skip` opportunity. Two independent condition-blind
judges receive public history and candidate text, but no condition, model,
interface, source, or fallback labels. Disagreements require condition-blind
human adjudication.

W1 is the trained-minus-untuned validity rate, averaged with equal interface
weight. The 95% interval uses 5,000 dialogue-blocked bootstrap draws with seed
20260806. Training contribution is detected only when the lower bound exceeds
zero. Practical equivalence requires the entire interval inside [-0.10, 0.10];
otherwise the result is indeterminate.

Secondary outcomes separate raw cue rate, deterministic transmission,
composition/fallback burden, final compliance, final semantic validity,
latency, model calls, and attrition. They cannot substitute for W1.

## Pilot, completion, and stop rules

Before the cohort, an excluded eight-dialogue exact-pipeline pilot runs one
complete four-cell block per profile. A source-, plan-, world-, gate-, and
evidence-hash-bound launch certificate must establish:

1. structural coverage reachability at turn 22;
2. both local model artifacts and all treatment commands are correctly bound;
3. all eight pilot rows seal, cover every profile/cell, pass coverage and hard
   safety, and retain cue-blind ledgers;
4. projected opportunity counts preserve a 1.25 reserve over the cohort
   minima; and
5. hard job, retry, provider-call, and reserved-output-token caps.

A confirmatory cohort reading additionally requires at least 10/12 sealed
dialogues per cell, eight complete four-cell blocks, four complete blocks per
profile, 60 opportunities per cell, 20 per profile/cell, weight-pair attrition
differences no greater than one within each interface, and passing coverage,
safety, provenance, trace-integrity, and cue-blind gates.

The live futility check runs before the first external call and after every
terminal job. It may stop only for an irreversible completion, safety,
provenance, cue-blind, attempt-budget, or resource failure. It never inspects
treatment-effect estimates.

## Authorization boundary

This document licenses implementation, local unit tests, zero-model planning,
static reachability checks, and local Ollama provenance/preflight. It does not
authorize sending repository prompts, private learner briefs, private DAG
state, or dialogue transcripts to external model providers. The excluded
pilot and any later cohort require a fresh explicit authorization naming the
external destinations and payload scope.

## Amendment 1 — separate uptake from release and require real exposure

The first certified excluded pilot stopped after two of eight jobs and remains
immutable under `exports/program2-weights-interface-retest-pilot/`. It produced
no treatment estimate. Its traces showed that turn 22 was the public-release
boundary rather than a fair learner-uptake boundary, and that neither sealed
row contained an eligible committee moment.

Amendment 1 supersedes the conflicting horizon, opportunity-density, schema,
and export-root clauses above:

- public-release reachability remains fixed at turn 22;
- learner coverage and safety are evaluated at turn 23;
- every dialogue carries the command-bound
  `first_admissible_warrant_v1` protocol, which schedules exactly one warrant
  exposure on the first no-release turn in turns 15–21 whose compiled handoff
  permits a question;
- W1 uses only that scheduled first-pass moment; natural later opportunities
  are secondary;
- every sealed row must contain at least one scheduled moment, with pilot
  minima of 2 opportunities per condition and 1 per profile/condition;
- the cohort minima become 10 per condition and 5 per profile/condition,
  matching one standardized primary exposure per sealed dialogue;
- replacement plan and bundle schemas are v2; and
- replacement roots are
  `exports/program2-weights-interface-retest-pilot-a1/` and
  `exports/program2-weights-interface-retest-a1/`.

The protocol never overrides a question-forbidden handoff or a due clue. It is
off by default outside this retest and records any displaced natural trigger.
The full frozen amendment and stopped-pilot evidence are linked from
`notes/program-2/2026-08-05-weights-interface-retest-amendment1.md` and
`notes/program-2/2026-08-05-weights-interface-retest-pilot-stop.md`.

The prior external authorization is exhausted by the stopped pilot and does
not authorize this replacement. A new clean commit, local smoke, plan,
certificate, and explicit authorization are required before any external call.
