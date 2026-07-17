# PLAN_4_0 Phase 6 Evidence Gates

## Status

The original Phase 6 protocol is superseded before a claim-bearing run. An old
60-row Terra collection exists only under the pre-contract artifact reader; it
lacks the current protocol identity, decision, immutable plan/event/seal chain,
and placebo-beating result, so it is not a v2/v2.1 claim dataset or parent. This
correction remains prospective for the operative protocol.

The operative frozen artifact is
`config/drama-derivation/phase6-field-planner-gate-v2.1.json`. Version 2.1
retains v2's exact flags, real-row immutability, continuation lineage, output
leak detection, row/matrix validity, advisory manipulation, and report-only
comparator safety, and closes the last operator-only gap by making a sealed
passing route canary the mandatory parent of seeds 1–5. A v1 or v2 artifact
cannot authorize a v2.1 claim block or continuation.

The reason is architectural. The named `hidden+proofDebt` production control
requires this chain:

```text
proof-debt-guard → repair-clause → confront → acts + superego
```

But `--field-planner`, `--field-planner-enforce`, and the
`--field-report-context` placebo all reject acts mode. Acts mode intentionally
redacts the learner-store board from the tutor, while the present field planner
reads the harness-owned learner board and trajectory. Adding the missing
proof-debt flags would therefore make the planner arms fail before execution;
passing the true board through the redaction boundary would invalidate the
production comparison.

Phase 6 is now split:

- **Phase 6A:** a runnable non-acts controller-feasibility gate;
- **Phase 6B:** the true promotion test against `hidden+proofDebt`, blocked
  until an acts-compatible planner consumes only a validated public or
  tutor-reconstructed learner-state view.

Tutor-stub experiments remain a separate sensor/register-policy programme.
Neither Phase 6A nor Phase 6B validates human learning.

## Claim Boundaries

### Phase 6A

The strongest licensed claim is:

> Within the existing non-acts derivation runtime, the frozen field planner
> converts the same available hidden state into better formal proof outcomes or
> lower fixed-turn cost than hidden pacing alone, on the named worlds and model
> stack, without a frozen safety regression.

Phase 6A does **not** establish:

- superiority to the production `hidden+proofDebt` controller;
- validity of the tutor-stub learner-state estimator;
- human learning benefit;
- a general theory of tutoring;
- cross-domain or model-independent robustness.

### Phase 6B

Phase 6B may eventually ask whether an acts-safe, reconstructed-state planner
beats the exact production `hidden+proofDebt` stack under matched decay. It may
not receive the harness's true learner board, frontier, proof distance, decay
ledger, or trajectory through the acts-mode concealment boundary.

## Phase 6A Frozen Runtime

### Common flags

Every arm receives the same base configuration.

Enabled:

- `--scene-mode`
- `--didactic-mode`
- `--release-authority`
- `--pacing-guard`
- `--decay-visibility conduct`
- `--register modern`
- `--critic off`
- `--critic-feedback off`

Explicitly disabled:

- acts
- superego
- confront
- repair clause
- proof-debt guard
- plot
- throughline

Generic target-based repair remains available in non-acts mode. The special
acts-mode confrontation/repair-clause/proof-debt mechanism does not.

### Arms

Only the following flag delta may differ across arms:

| arm | additional flag | purpose |
| --- | --- | --- |
| `baseline` | none | `baseline_hidden_pacing_v1` control |
| `field_report_only` | `--field-report-context` | information/placebo control; no recommendation or authority |
| `field_planner_advisory` | `--field-planner` | planner recommendation without binding authority |
| `field_planner_enforce` | `--field-planner-enforce` | binding candidate-projection control |

The report-only command must remain distinct from baseline. Mock mode cannot
exercise prompt-mediated report/advisory behavior; it validates wiring and
trace coherence only.

### Worlds

The Phase 6A gate uses exactly:

- `world-005-marrick.yaml` (`marrick`);
- `world-006-hethel.yaml` (`hethel`);
- `world-019-marrick-resistant.yaml` (`marrick_resistant`).

Do not add a harder world after reading results. A new world requires a new
protocol version and untouched run label.

### Decay

The complete decay object is frozen; no runtime defaults may fill omitted
fields:

```json
{
  "seed": "<row seed>",
  "rate": 0.08,
  "graceTurns": 2,
  "maxConcurrent": 1,
  "startTurn": 1,
  "mutateShare": 0.25,
  "pool": "staged"
}
```

Every baseline world must show at least one decay event and positive
degraded-turn burden. Otherwise the manipulation was not reached and the
verdict is `null_invalid_instrumentation`, not `ceiling`.

### Seeds and staging

1. Plan and deterministic mock smoke: no claim.
2. Model-route canary: exactly Marrick × all four arms × seed label 0, launched
   with `--technical-canary`. It is real but receives either
   `technical_canary_only` with `passed: true` or `technical_canary_failed`; it
   is excluded from both evidence blocks. Passing requires exact four-cell
   completion, semantic and trace/audit coverage, zero hard safety/leak failures,
   and complete sealed model provenance. It does not require grounding, decay
   activation, the advisory efficacy threshold, or a realized enforcement
   change.
3. Provisional block: seeds 1–5 for every world × arm cell, with
   `--prior-canary` pointing to the sealed passing canary report. The k5 plan
   checksum-binds that parent and refuses Git, invariant-source, model,
   effort/timeout, concurrency, or CLI-fingerprint drift before any row starts.
4. Replication execution: run only seeds 6–10, with `--prior-provisional`
   pointing to the sealed real seeds 1–5 `provisional_promote` report. The
   runner imports a minimal checksummed snapshot of the parent rows and the
   evaluator combines them with the new block; seeds 1–5 are never generated
   again.
5. Local promotion requires the first block, second block, and pooled ten-seed
   result all to pass independently for the same arm selected by the sealed
   parent.

`--force` is forbidden in real mode. Same-label continuation is permitted only
when the existing evidence is an exact prefix of durable, semantically verified
row commits followed by a wholly never-started tail. A row with a start event,
partial or complete artifacts without a durable commit, changed hashes, or a
failed/interrupted child poisons that label; it is sealed
`indeterminate_same_label_forbidden` and must be superseded. A verified committed
row is immutable and cannot be semantically rerolled.

Real backends are not seedable. Seed labels pair only the deterministic decay
schedule; analysis macro-averages worlds and reports arm distributions rather
than model-output paired deltas.

The bounded launch sequence from a clean committed SHA is:

```bash
# Excluded route check: four paid rows, no efficacy claim.
node scripts/run-derivation-phase6-gate.js \
  --real --confirm-paid-phase6a-v2.1 --technical-canary --label phase6a-v2.1-route-canary

# Claim block 1: 3 worlds x 4 arms x 5 seeds = 60 rows.
node scripts/run-derivation-phase6-gate.js \
  --real --confirm-paid-phase6a-v2.1 --label phase6a-v2.1-k5 \
  --prior-canary exports/dramatic-derivation/phase6-gate/phase6a-v2.1-route-canary/phase6-gate-report.json

# Only after a sealed provisional_promote: 60 new rows for seeds 6-10.
node scripts/run-derivation-phase6-gate.js \
  --real --confirm-paid-phase6a-v2.1 --label phase6a-v2.1-k10-continuation \
  --prior-provisional exports/dramatic-derivation/phase6-gate/phase6a-v2.1-k5/phase6-gate-report.json
```

Use the normal provider/model environment variables for the intended frozen
stack. The run plan records explicit director, tutor, and learner model
references together with their effort and timeout policies; real execution is
strictly serial (`--concurrency 1`) and rotates arm order deterministically
across world/seed blocks. It also freezes the realpath and version of every CLI
backend in use. Do not add `--force` to a real command. A safely resumable label
skips only its exact verified committed prefix; every row after that prefix must
have no event and no artifact. Partial, tampered, artifact-only, failed, or
interrupted rows require a superseding label.

## Phase 6A Frozen Endpoints

For every row:

```text
fixedTurnCost = grounded ? turnsPlayed : turnCap + 1
```

Aggregate within world, then macro-average worlds so a longer world does not
dominate.

Primary benefit endpoints:

- grounded anagnorisis rate;
- macro fixed-turn cost.

Hard safety endpoints:

- learner-facing premise leaks;
- transcript-output hits for the contract-declared formal-secret formats,
  proof-distance arithmetic patterns, or exact/formal unreleased-premise
  surfaces before their actual ledger release;
- fabricated facts;
- lucky-leap or unsupported final assertion signals;
- field/report non-leak audit failures;
- missed, wrong-via, unscheduled, or invalid release claims;
- overreach rate;
- early/late release rate.

Process endpoints are diagnostic only:

- field-report and planner trace coverage;
- candidate count, selected-score validity, and post-turn outcome coverage;
- advisory compliance;
- enforce post-compliance and actual enforcement changes;
- projection-alignment and observed-movement rates.

## Phase 6A Numerical Decision Contract

### Material improvement

A candidate materially improves a comparator if either:

```text
macro completion-rate lift >= 0.10
```

or:

```text
macro completion rate is not lower
AND macro fixed-turn cost decreases by >= 2.0 turns
```

It must also avoid negative transfer in every world:

```text
completion-rate delta >= -0.10
fixed-turn-cost increase <= 2.0 turns
```

Promotion requires material improvement against both `baseline` and
`field_report_only`.

### Placebo matching

A planner and report-only arm match when both hold:

```text
absolute completion-rate difference < 0.10
absolute fixed-turn-cost difference < 2.0 turns
```

### Safety

For a promotable candidate:

- every hard count listed above is zero except comparative rates;
- overreach rate is no higher than baseline;
- early/late release rate is no more than baseline + 0.10.

An outcome improvement that fails safety is `negative_control`, never a
promotion.

### Instrumentation

The gate is invalid unless:

- the evidence rows form the exact unique world × arm × seed matrix, with no
  duplicate or substituted cell, and all required turn, decay, trace,
  compliance, and safety fields pass the strict positive/non-negative finite
  numeric schema;
- baseline has no field/report trace;
- report-only has one report-context trace per tutor turn;
- report-only passes the same hard, overreach, and release-deviation safety
  comparison used for planner candidates;
- planner arms have one planner trace per tutor turn;
- every planner turn has exactly eight candidates, a finite selected score,
  and a post-turn outcome;
- advisory compliance is audited every turn and is at least 80%;
- enforce post-compliance is 100%;
- at least one enforce action actually changes the unconstrained choice before
  an enforce result is attributed to binding authority;
- requested, resolved, and observed model provenance is complete for every
  role.

## Phase 6A Verdict Precedence

Apply this order mechanically:

1. `technical_canary_failed` — the excluded canary is incomplete, unsafe, or
   missing required technical coverage; seeds 1–5 remain locked.
2. `technical_canary_only` — the excluded canary passed and may be the sealed
   parent of one compatible seeds 1–5 transaction. It is not outcome evidence.
3. `incomplete` — expected rows or artifacts are missing. This is an analytical
   verdict, not blanket authorization to resume a paid label: only a verified
   committed prefix plus a wholly never-started tail is resumable. Any attempted
   incomplete row makes the same label forbidden. Duplicate/substituted matrix
   cells or malformed required numeric fields also resolve here rather than
   being coerced to zero.
4. `null_invalid_instrumentation` — configuration, manipulation, trace, or
   provenance checks fail.
5. `promote_local` — seeds 1–5, seeds 6–10, and pooled k=10 all pass benefit,
   placebo, safety, and negative-transfer rules.
6. `provisional_promote` — seeds 1–5 pass the same rules.
7. `negative_control` — a planner materially improves outcomes but fails
   safety.
8. `instrumentation_effect` — report-only materially improves baseline and a
   planner matches or fails to beat report-only.
9. `ceiling` — baseline grounds every row in every world and no safe planner
   reduces fixed-turn cost by at least two turns.
10. `null` — valid experiment; no earlier result applies.

If advisory and enforce both qualify, choose deterministically by:

1. higher completion rate;
2. lower fixed-turn cost;
3. lower release-deviation rate;
4. advisory on an exact tie, because it uses less authority.

## Immutable Audit Packet

The run plan must hash the frozen contract, evaluator source, runner, planner,
worlds, scripts, prompts, and model requests. Its design hash includes the full
on/off flag matrix, complete decay object, thresholds, world list, seed blocks,
evaluator version, and verdict precedence.

For seeds 1–5, the plan must set the sealed passing canary as
`lineage.parentRunId` and bind its report, seal, plan, inventory, row snapshot,
and runtime provenance. Canary and k5 must share the exact clean Git SHA,
runner/analyzer/policy/prompt/config hashes, director/tutor/learner models,
effort and timeout policies, serial concurrency, and CLI executable
realpaths/versions. World/profile/script aggregate hashes differ by design
because the canary is the Marrick-only subset.

For seeds 6–10, the plan must also set the sealed seeds 1–5 run as
`lineage.parentRunId` and bind the parent report, seal, row snapshot, decision
contract, and evaluator hashes. Pooling is allowed only when both blocks have
the exact same clean Git SHA, complete runner/policy/world/script/prompt/profile/
config hash set, director/tutor/learner model references, effort and timeout
policies, serial concurrency, and CLI executable realpaths/versions. The current
evaluator must reproduce the parent's `provisional_promote` and winner before
any continuation job is planned.

Preserve per row:

- `result.json`;
- `diagnosis.json`;
- `transcript.md`;
- `dialogue-report.json`;
- `dialogue-report.md`;
- `dynamic-field.svg`;
- complete runtime model provenance.

Preserve per gate:

- immutable run plan and append-only event chain;
- compatibility manifest;
- aggregate JSON/Markdown/HTML report with deterministic verdict and reasons;
- seal only after every planned row completes;
- one success and one failure exemplar per arm when available.

## Phase 6B Blocker and Exit Condition

Phase 6B remains blocked until all of the following exist:

1. a shared public or tutor-reconstructed learner-state schema that survives
   the learner-state validity gate;
2. an acts-safe adapter that derives planner inputs only from that view;
3. a leak audit proving the true learner board, frontier, distance, decay
   ledger, and future state never cross the redaction boundary;
4. a matched production `hidden+proofDebt` control and acts-safe planner arms;
5. a new frozen protocol, evaluator version, untouched seeds, and clean SHA.

Phase 6A may justify retaining the hand-coded planner as a formal research
instrument. It cannot unblock Phase 6B or a human pilot by itself.
