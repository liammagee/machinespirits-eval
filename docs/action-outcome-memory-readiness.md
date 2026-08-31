# Action-outcome memory readiness

Workplan item: `adaptive-curriculum-memory-controller`.

This is a zero-call bridge from saved tutor-stub traces to the supplied-memory
interface in `docs/action-outcome-memory.md`. It reports structural joins,
measurement status, coverage, and deterministic changes in action choice. It
does not run a tutor, reconstruct missing observations, rescore historical
dialogues, update a database, or establish improved learning.

## Run

```sh
node scripts/action-outcome-memory-readiness.js \
  --input /absolute/path/readiness-input.json \
  --out /absolute/path/new-readiness-output
```

The input is ordinary analysis configuration, not a study registration or an
authorization artifact. Paths are relative to the input file. A minimal inventory
needs no condition definitions or policy thresholds:

```json
{
  "asOf": "2026-08-31T23:59:59.000Z",
  "sources": [
    {
      "path": "traces",
      "role": "memory",
      "contextKey": "explicit-compatible-instrument-and-population-context"
    }
  ]
}
```

Each source is a JSONL file or a directory recursively containing JSONL files.
Sources have an explicit `memory` or `evaluation` role and a `contextKey`.
Assign the same context only after checking compatible model/provider routes,
learner population, task class, condition definition, and outcome instrument.
The report exposes source metadata for that review; it does not certify a
caller-supplied context label as scientifically compatible. Keep mock traces
separate from real traces.

The output directory must not exist. Outputs are `readiness.json`, `README.md`,
`memory.json`, and `replay.json`. They include source locations, byte counts,
SHA-256 data provenance, event references, exclusions, and counts. They do not
copy public dialogue text or prompt snapshots. Source files are read-only.
Store these private analysis outputs outside tracked source paths.

Every JSONL line is parsed. Malformed tails, sequence/time errors, mixed run
identities, or files changing during the read quarantine the source. Identical
copies of one run count once. Conflicting copies of a run are all quarantined;
the tool never selects the most favorable copy. Resume/history-clear traces
are reported as requiring complete lineage; this first adapter does not stitch
them or invent earlier context.

## Evidence join and measurement

A record requires one pre-output `tutor_typed_action_decision`, its completed
delivery turn, one `tutor_typed_action_outcome_closed` on the next learner turn,
and the matching completed observation turn. Contract identity, action, turns,
event order, delivered task/support/family, and the exact public learner text
must agree. A displaced typed action receives no outcome credit. Missing or
ambiguous joins remain explicit exclusions.

The runtime now records two fields under the typed decision's
`decision_provenance`, while the controller can remain disabled:

- `selection_input`: the actual state belief, prior intervention ledger,
  selector mode, and scaffold/world constraints before this decision.
- `memory_observation`: the observed flag and exact pre-action stagnation,
  field-velocity, and DAG-velocity quantities.

These are trace provenance, not prompt content. They do not initialize a model
or change selection. Earlier traces without these fields remain earlier traces;
their absence is a data gap, not an invitation to infer the fields from a later
response or rerun an updated observer.

The existing outcome observer and response-configuration visibility audit are
pattern-based auxiliaries. An auxiliary success/failure alone exports as
`measurement_indeterminate`, with its original label retained separately.
Such a record stops the affected memory lookup; it is not a binary training
example and is not silently removed from the comparison.

Optionally, `reviewsFile` names a JSON array of already-completed human reviews:

```json
[
  {
    "runId": "the-saved-run-id",
    "contractId": "the-saved-contract-id",
    "method": "human",
    "reviewer": "human:coder-id",
    "source": "the-review-source-reference",
    "recordedAt": "2026-08-05T10:00:00.000Z",
    "tutorText": "the exact delivered public tutor text",
    "learnerText": "the exact next public learner text",
    "deliveredActionType": "minimal_hint",
    "outcome": "failure"
  }
]
```

The coder must independently assess delivered action and next-turn uptake;
this tool does not conduct that review. It accepts one human record per
run/contract and no new model judgment. Exact text binding prevents a review
from attaching to changed public data. Reviews unavailable at the analysis
cutoff are not used. Earlier-than-observation reviews, mismatched text/action,
and disagreement with either auxiliary remain indeterminate. Partial and
inconclusive outcomes remain categorical. Human confirmation is still uptake
measurement, not an independent learning endpoint.

## Configure offline comparisons

To produce conditioned records, add `conditions`, each with the same four
fields accepted by the controller: `id`, `stagnationAtLeast`,
`fieldVelocityAtMost`, and `dagVelocityAtMost`. The importer uses only saved
pre-action quantities. Missing observations, no matching definition, or
overlapping definitions do not become a guessed condition.

To compare choices, supply evaluation sources and a `replay` object containing:

- `policy`: the existing memory policy's explicit `enabled`, `scope`,
  `minObservations`, `minDialogues`, `successFloor`, `penalty`, `maxAgeMs`, and
  `minWorlds` for `held_out_world`.
- `staleAsOf`: the historical snapshot cutoff, before each replayed decision.
- `conditionPermutation`: an explicit bijection over declared condition IDs.

There are no scientific defaults. Tests use artificial values to verify code;
those values are not recommendations for a study.

Replay first reproduces the saved action and candidate utilities with the
recorded selector input. Mismatch, missing inputs, future/unresolved ledger
entries, or action-default support excludes the decision. It then compares
disabled, current, stale, and condition-scrambled memory while holding the
decision state, task, explicit support, register, and constraints fixed.
Mandatory diagnostic and prerequisite actions retain selector authority.

At every decision, only evidence whose observation and labeling were available
by that decision is admitted. The current dialogue is excluded. Held-out-world
pooling excludes **all declared evaluation worlds** from memory; exact-world
lookup instead permits earlier other dialogues from that same world. These
are different analyses and neither silently falls back to the other.

If the available conditions cannot support the supplied permutation, the
scrambled arm is `not_evaluable`, not a zero-effect control. An identity
permutation is also not a scramble control. An old snapshot does not itself
prove that conditions have changed; a meaningful stale-memory study still
needs that change. Report changed-choice frequencies and abstentions before
interpreting a comparison.

A replayed alternative has no observed learner continuation. Never credit it
with the outcome of the action that was actually delivered. This tool writes
no counterfactual outcomes, learning gains, or transfer scores.

## Current source-readiness finding

The 2026-08-31 inventory checked 36 local default trace files and the exact 120
final-selected traces from the register-confirmatory archives. Both archives
matched their existing sealed-data hashes before reading. Neither source set
contained typed-action decision or closed-outcome events. Six local files
also required resume/history-clear lineage; none of the selected archive files
were quarantined. This is an input-coverage finding, not a reanalysis of those
studies' outcomes, and it is not an exhaustive search of every project archive.

Consequently this slice has a real gap report and synthetic replay validation,
but no real-data memory comparison. The next data collection must prospectively
record typed actions, pre-action condition and selector inputs, actual delivery,
the next public learner response, and a valid measurement review. Independent
unassisted and transfer assessments remain separate work before any benefit
claim or model-backed study.
