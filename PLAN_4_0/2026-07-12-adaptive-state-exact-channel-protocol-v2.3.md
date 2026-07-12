# Adaptive-state exact-channel protocol v2.3

**Date frozen:** 2026-07-12

**Status:** implemented; clean-SHA successor Stage 0 passed and sealed without model calls

**Parent outcome:** v2.2 stopped at 70/72, with a repeated Ravensmark × derive × Codex failure

**Claim status:** engineering and instrument design only

## Decision

Split the benchmark into two non-interchangeable lanes.

1. The **claim-bearing exact lane** receives a harness-owned, current public
   semantic event. It renders the exact fact deterministically and verifies the
   exact atom programmatically. It uses no language-model realizer and no
   language-model analyzer.
2. The **descriptive language-transfer lane** may later ask Codex and Claude to
   paraphrase the same event and may measure analyzer recovery and naturalness.
   It cannot change rows, labels, exclusions, sensor selection, or the validity
   verdict.

This is the smallest design that answers the scientific question without
requiring every possible world, learner, model, or phrasing. The claim-bearing
critical path remains three proof geometries, two genuinely different latent
transition kernels, two exact surface templates, six fixed tutor actions, and
the existing representation ladder and controls.

## What changed in the instrument

The v2.2 failure exposed a missing contract. The kernel event contained the
exact fact `pressedSealFor(gatePass, elian)`, but its public envelope said only
that a further intermediate inference was supported. The language model was
therefore asked to reconstruct a fact that had been withheld from it. An event
ID in the sidecar could still claim `derive`, even when the learner text merely
repeated `heldBy(duskSeal, elian)`. A family-level analyzer could then over-credit
an incomplete paraphrase.

In v2.3, every object-level `adopt`, `derive`, or premise-`retract` event carries:

```json
{
  "schema": "machinespirits.adaptive-state-public-semantic-event.v2.3",
  "operation": "derive",
  "fact": ["pressedSealFor", "gatePass", "elian"],
  "canonical_atom": "[\"pressedSealFor\",\"gatePass\",\"elian\"]",
  "object_level_claim": true
}
```

The payload describes only the already-realized current public event. It does
not include a future state, next target, oracle distribution, answer key, or
private reasoning. A claim-bearing rendering must contain the byte-exact
`FACT ["pressedSealFor","gatePass","elian"]` marker, preserve the exact
harness event-ID sidecar, and keep the event ID out of the learner text.

This deliberately separates two questions:

- **Does the stored DAG/trajectory/field state predict the next harness event
  when the current public event is observed exactly?** This is the sensor test.
- **Can a particular language model express and recover that event in ordinary
  prose?** This is a language-transfer test, reported separately.

## Frozen critical path

```text
latent transition sampled
  -> current public semantic event projected exactly
  -> deterministic fact-preserving learner turn
  -> exact semantic-fidelity assertion
  -> deterministic public-state update
  -> no-state / DAG / trajectory / field prediction heads
  -> harness-owned next-event and proof-trajectory labels
```

The exact lane stops if any of these occur:

- a scored transition lacks its exact current fact when an object-level claim
  exists;
- the rendered fact differs from the public semantic payload;
- the event operation and semantic payload differ;
- the sidecar event IDs differ from the harness IDs;
- learner text contains an event ID;
- a future target, future state, oracle, or answer key enters the public input;
- a crossed cell is missing, replay differs, or the existing oracle/control
  sensitivity checks fail.

## Stages and permitted execution

### S0 exact-channel contract — zero calls

Run the existing 24-dialogue, 144-scored-transition matrix with both exact
surface templates. Every realized learner turn persists a semantic-fidelity
record. Passing S0 proves only that the instrument is internally exact,
replayable, leak-free, and sensitive enough to proceed.

### S1 canonical sensor pilot — zero calls

Analyze the representation ladder on exact public observations. This is
non-confirmatory. Its job is to determine whether there is enough predictive
signal and control sensitivity to justify the bounded confirmation. It cannot
select or optimize a tutor policy.

Before inspecting the S0 prediction results, the pilot was frozen as a
directional screen with the inherited fixed multinomial head and all three
existing held-out lanes: world, latent-generator, and exact-renderer transfer.
For both co-primary targets, each candidate must beat no-state by at least
`0.05` log-loss and `0.02` Brier with paired-cluster bootstrap
`P(improve) >= 0.80`, and must have a positive point delta against class-prior
and uniform. It must improve point estimates in at least two held-out worlds,
one held-out generator, and one held-out renderer, with no generator or
renderer level worse than the frozen `0.02` log-loss / `0.01` Brier margins.
Oracle ECE must be at most `0.10`; candidate ECE must be at most `0.25`.
Promotion from lean DAG to DAG trajectory and then field trajectory additionally
requires the same minimum deltas and probability floor over the preceding rung,
plus a positive point delta over its matched stale control. Bootstrap resamples
the frozen `latent_pair_id` clusters 5,000 times at seed `20260712` without
refitting.

A pass may emit only `authorize_v2_3_canonical_s2_implementation` and nominate
the richest passing representation as a confirmation candidate. It cannot name
a validated winner, open policy optimization, or launch S2. A failure emits
`do_not_run_canonical_s2`.

### S1 language transfer — optional paid, descriptive only

If separately authorized and prospectively frozen, Codex and Claude may
paraphrase exact public events. Report exact-fact fidelity, event-family
recovery, analyzer false positives, and naturalness. These rows cannot rescue
or invalidate the canonical sensor lane and cannot authorize S2.

### S2 canonical confirmation — zero calls

Use the existing frozen eight-seed maximum, paired clustering, world-transfer
primary lane, state-blind baselines, matched stale controls, oracle checks, and
simple-to-rich promotion hierarchy. Its strongest possible conclusion is:

> the selected learner-state representation predicts harness-owned next events
> across these three authored worlds and two latent kernels, conditional on an
> exact current-public-event channel.

It is not a population-world, natural-language, human-learning, efficacy, or
deployment claim.

## Phase 6 repair

Phase 6 is now explicitly downstream of the learner-state gate instead of
being merely adjacent to it.

- **Phase 6A engineering canaries** may continue to test runner integrity,
  release safety, proof reliability, and lineage. They remain non-efficacy
  engineering evidence.
- **Phase 6B policy comparison** remains blocked until S2 passes, names a
  non-null representation winner, and opens `optimize_policy` explicitly.
- A Phase 6B pass still does not authorize a shadow pilot. The shadow pilot
  additionally needs a live-observation parity bridge showing that deployed
  public-language analysis agrees with the exact channel at an independently
  frozen threshold.
- A human learner pilot additionally requires IRB approval, real consent, and
  validated item content.

Thus an exact-channel sensor result cannot be silently promoted into a claim
that the live tutor understands ordinary learner language.

## What remains blocked

Do not rerun v2.2, tune its prompt against Ravensmark, or reinterpret any v2.1
or v2.2 row. Do not run the old 339-call S1. Until a clean-SHA v2.3 S0 seals and
the canonical pilot and confirmation pass, the verdict remains `winner: null`
and `do_not_optimize_policy`. Phase 6B, a shadow pilot, efficacy claims, human-
learning claims, and deployment claims remain blocked.

## Implementation surface

- contract: `config/adaptive-state-instrument-v2.3.yaml`
- current public event projection:
  `services/adaptiveTutor/learnerKernels/worldAdapter.js`
- exact rendering and semantic-fidelity assertion:
  `services/adaptiveTutor/stateBenchmarkDeterministicRealizer.js`
- persisted zero-call fidelity evidence:
  `services/adaptiveTutor/stateBenchmarkStage0Executor.js`
- regression coverage: `tests/adaptiveStateFactPreservingChannel.test.js`

The successor is intentionally narrower than the abandoned language-model
crossing. That is a feature: it makes the causal question identifiable and
moves language robustness into its own test instead of letting it contaminate
the learner-state verdict.

## Execution outcome

Commit `346e472a` implemented and validated the v2.3 channel before the
successor run. Clean run
`adaptive-state-v2-s0-exact-channel-346e472a-v23` then completed and sealed:

- 24/24 dialogues and 144/144 scored transitions;
- 168/168 realized learner turns passed all five semantic-fidelity checks;
- zero model calls;
- exact deterministic replay;
- zero leakage, donor, stale-control, or paired-target-drift failures;
- both primary-target oracle checks beat no-state, training-fold class-prior,
  and uniform baselines on log loss and Brier score;
- no target degeneracy and all fixed-head folds converged.

Dataset SHA-256 is
`e781beb4f51f876020d4e41dbd00606d8fffbfeb13db9daeb99224d71da78e61`;
report SHA-256 is
`e939ff171a0d2b2e85217a13cc6c7671de912b2d49134f126b37d80e1236023f`.
The seal verifies 10 artifacts, two chained events, and no warnings.

The inherited v2.1 report vocabulary says
`advance_to_s1_technical_pilot`. Under the prospectively frozen v2.3 contract,
that legacy string authorizes only `s1_canonical_sensor_pilot`, which is
zero-call and non-confirmatory. It does not reopen the old paid 339-call S1 or
the language-model observation channel.

The S0 pass proves that the successor instrument is exact, public-only,
replayable, structurally complete, and sensitive enough to analyze. It is not
a learner-state validity result. `winner: null` and `do_not_optimize_policy`
remain operative until a bounded canonical confirmation says otherwise.

## Canonical pilot implementation checkpoint

The zero-call pilot runner, frozen gate, sealed-artifact report, and synthetic
pass/stop tests were implemented without fitting the heads to the S0 data.
The implementation was committed and pushed at `e68b5ee0`. Its first execution
attempt stopped before creating a run, reading the dataset, or fitting a head
because the generic run-plan validator rejected an explicitly empty optional
model allowlist. Commit `bd8f47ec` removed that invalid field and made dry-run
construct and validate the full evidence plan; a clean-tree dry run then passed.

## Canonical pilot outcome

Sealed run `adaptive-state-v2-s1-canonical-pilot-bd8f47ec-v23` analyzed the
unchanged S0 exact-channel dataset with zero model calls:

- 24 dialogues, 144 scored transitions, and 12 independent latent clusters;
- 84/84 fixed heads converged;
- the oracle instrument and both oracle calibration gates passed;
- lean DAG was worse than no-state on both co-primary targets: log-loss deltas
  `-0.5212` and `-0.5013`, and Brier deltas `-0.0485` and `-0.0674`;
- lean DAG improved both targets only in Hethel, not in Marrick or Ravensmark,
  and improved under neither held-out latent generator;
- exact-renderer transfer was positive for both deterministic surfaces, but it
  could not rescue the failed world- and generator-transfer gates;
- DAG trajectory and field trajectory were still worse than no-state and did
  not provide the frozen incremental or matched-stale evidence.

The prospective decision is therefore `do_not_run_canonical_s2`, with
`confirmation_candidate: null`, `validated_winner: null`, and policy
optimization blocked. Prediction content SHA-256 is
`fd28a83c357df94584356480818c673cf67b4b54c9589ef71b1e670adc2ce3c3`;
report content SHA-256 is
`a9f01ae60173e4e9eaa20141e8e83c8b8400c137acbe9f9ffe7c3f8a60d4673a`.
The seal verifies seven artifacts and two chained events.

This result is stronger than the earlier v1 proxy stop because it tests the
canonical policy-invariant representation ladder on the exact public-event
channel. It is still bounded to three authored worlds, two synthetic latent
kernels, two exact renderers, and the frozen fixed head. It does not show that
learner state is impossible to estimate, that ordinary language is invalid, or
that humans cannot benefit. It shows that this state representation and head do
not justify confirmation or policy optimization on the present critical path.
