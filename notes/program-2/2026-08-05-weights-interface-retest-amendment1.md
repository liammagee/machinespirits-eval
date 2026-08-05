# Program 2 weights × interface retest — Amendment 1

- Date: 2026-08-05
- Status: prospective apparatus repair before any replacement external call
- Workplan item: `program-2-weights-interface-retest`

## The stopped pilot remains immutable

The certified pilot at source commit
`c495232728efb95e671df241432306d88876f4bd` stopped after two of eight jobs.
Its plan, certificate, launch state, partial analysis, and traces remain under
`exports/program2-weights-interface-retest-pilot/` and are never resumed,
overwritten, rescored into the replacement, or pooled with it. The result is an
apparatus failure with no treatment estimate.

Two independent faults require a prospective amendment:

1. Turn 22 was the authored public-release boundary, not a fair learner-uptake
   boundary. The last clue entered the tutor's turn 22 response after the
   learner state sampled at that turn.
2. Both sealed rows had zero eligible committee moments. Natural
   `warrant_skip` candidates either lost the frozen detector priority or were
   removed by the final handoff contract. The cue-blind gate therefore passed
   vacuously.

## A1.1 Separate release and uptake horizons

The public-release horizon remains turn 22. The fixed learner-uptake horizon
moves to turn 23. A zero-model resummary of both sealed successful traces under
the unchanged fixed-horizon summarizer gives coverage 1.000 and complete hard
safety evidence at turn 23:

| Stopped-pilot row | Coverage@22 | Coverage@23 | Safety@23 |
|---|---:|---:|---|
| `affective_resistant/untuned_v1` | 0.833 | 1.000 | pass |
| `affective_resistant/trained_v1` | 0.667 | 1.000 | pass |

The launch certificate therefore proves structural release reachability at
turn 22, while row completion and coverage are evaluated at turn 23. It does
not treat authored availability as learner adoption.

## A1.2 Controlled, handoff-compatible exposure

The replacement adds one command-bound protocol shared by all four factorial
cells: `first_admissible_warrant_v1`.

Between turns 15 and 21, the first turn meeting every condition below becomes
the scheduled warrant exposure:

1. the committee arm is active;
2. the protocol has not already fired in the dialogue;
3. no public premise is due on the turn; and
4. the already-compiled final handoff contract permits a question.

At that point only, the protocol assigns `warrant_skip`. It may transparently
displace a naturally assigned `stagnant_repeat`; the frozen detector output and
the displaced trigger remain in the trace. If the handoff forbids a question
or a clue is due, the protocol waits rather than weakening either contract.
After one activation it cannot fire again.

This is a controlled exposure, not a claim about the natural prevalence of
warrant skips. W1 now uses only the first pass of the scheduled moment in each
dialogue. Later natural detector moments are descriptive secondary evidence
and cannot substitute for the scheduled exposure.

The runtime records the protocol in the CLI recipe, run-start trace metadata,
point-of-action activation, compliance row, and committee moment. The
committee moment carries `opportunitySource: first_admissible_warrant_v1`.
Interactive and all non-retest defaults remain off.

## A1.3 Non-vacuous gates and revised estimand support

Every sealed replacement row must contain at least one scheduled opportunity.
The excluded eight-row pilot requires:

- all 8 rows sealed in two complete four-cell blocks;
- 2 opportunities per condition and 1 per profile/condition;
- at least 1 scheduled opportunity in every row; and
- the existing coverage, hard-safety, cue-blind, provenance, trace-integrity,
  attrition, retry, and resource gates.

Because W1 is now one standardized first exposure per dialogue, the 48-row
cohort completion minima become 10 opportunities per condition and 5 per
profile/condition, alongside at least one scheduled exposure in every sealed
row. The original 60/20 opportunistic-density thresholds no longer describe
this estimand and are superseded. The 5,000 dialogue-blocked bootstrap, seeds,
factorial contrasts, effect decision rules, and no-pooling rule remain frozen.

## A1.4 New bindings and authority boundary

The replacement schemas are v2. Fresh ignored roots are:

- pilot: `exports/program2-weights-interface-retest-pilot-a1/`
- cohort: `exports/program2-weights-interface-retest-a1/`

The old pilot authorization does not carry forward. Local implementation,
tests, plan generation, source-bound local Ollama smoke, and zero-model
certificate preparation are permitted. Any replacement external pilot needs a
new clean source commit, fresh plan and certificate bindings, and fresh user
authorization naming its destinations and private payload scope. The cohort
remains unauthorized even if a later pilot passes.
