# Phase 6 Learner-Entitlement Replay Gate

Date: 2026-06-16

## Purpose

This increment consolidates scattered conduct-policy signals into a small
deterministic public learner-entitlement object. The goal is not to revive
hidden/visible selector work or add a situation taxonomy. The conduct layer
should read one public object that says what the learner is currently entitled
to do, what the tutor may publically press, and what must stay withheld.

## Implementation

- Added `deriveEntitlementState(...)` with schema
  `dramatic-derivation.learner-entitlement.v0`.
- The object consolidates public signals for:
  - proof debt;
  - current release authorization;
  - visible uptake/echo;
  - final assertion availability;
  - recent conduct-policy/diagnostic history;
  - diagnostic exhaustion;
  - valid-alternative candidates;
  - uncertainty.
- Conduct policy now consumes `learnerEntitlement` for normal runtime decisions.
- Existing move families are preserved.
- No raw proof path, secret, D arithmetic, corruption ledger, or hidden board
  state is included in the entitlement object.

## Validation

Focused tests:

```bash
node --test tests/dramaticDerivationLearnerEntitlement.test.js tests/dramaticDerivationConductPolicy.test.js tests/dramaticDerivationReplay.test.js
```

Result: 38/38 passing.

Full tests:

```bash
npm test
```

Result: 3717 passing, 1 skipped, 0 failing.

## Replay Command

```bash
DERIVATION_PROVIDER=codex \
DERIVATION_LEARNER_PROVIDER=claude \
DERIVATION_LEARNER_MODEL=sonnet \
DERIVATION_CLI_TIMEOUT_MS=900000 \
DERIVATION_LLM=real \
DERIVATION_TRACE=0 \
node scripts/run-derivation-episode.js \
  --from exports/dramatic-derivation/loop/hethel-phase5g-a20-fresh-selective-v4-r1 \
  --turn 4 \
  --window 12 \
  --real \
  --conduct-policy on \
  --conduct-progress-policy on \
  --conduct-policy-enforce on \
  --label phase6-hethel-entitlement-replay-from-t4 \
  --out exports/dramatic-derivation/episodes
```

## Result

| Field | Value |
|---|---|
| Source | `hethel-phase5g-a20-fresh-selective-v4-r1` |
| Episode | `phase6-hethel-entitlement-replay-from-t4` |
| Prefix integrity | ok, no mismatches |
| Verdict | `cap_reached` |
| Window | t4--t15 |
| D curve | `5->5->5->4->4->4->4->4->3->3->3->3->2->2->2` |
| Grounded | no |
| Release deviations | none before window end |
| Conduct compliance | 12/12 passed |
| Enforcement | applied 9/12 turns; post-failures 0 |

Release timing:

| Premise | Planned | Actual | Status |
|---|---:|---:|---|
| `p_point` | t4 | t4 | on cue |
| `p_surface` | t9 | t9 | on cue |
| `p_mark` | t13 | t13 | on cue |
| `p_brand` | t17 | unreached | blocked at t15 as early optional |
| `p_carter` | t20 | unreached | unreached |

Conduct move families:

| Family | Count |
|---|---:|
| `release_next_evidence` | 2 |
| `consolidate_subproof` | 5 |
| `repair_dependency` | 1 |
| `ask_diagnostic` | 4 |

Reason codes:

| Reason | Count |
|---|---:|
| `progress_pressure_release` | 2 |
| `progress_pressure_consolidate` | 4 |
| `dependency_repair_needed` | 1 |
| `visible_hidden_conflict` | 4 |
| `early_release_not_current_authorized` | 1 |

## Interpretation

The entitlement layer is useful infrastructure. It makes the conduct decision
surface explicit, public, and inspectable. In replay it also improves on the
safe-now negative screen: the previous t9 aporia is avoided, `p_surface` is
released and adopted on cue, and `p_mark` is later adopted.

It still does not clear the replay gate. The episode exits the bounded window at
D=2, so the policy remains a partial repair rather than a promotable arm. The
t15 early `p_brand` release is correctly blocked, but the proof still does not
ground within the window.

## Decision

No non-Hethel no-harm replay was run. The Hethel gate did not clear.

No fresh paid retest should be launched from this policy state.

The next useful design question is narrower than another selector or taxonomy:
can the entitlement object support a public progress decision that distinguishes
"learner already owns enough local support to move on" from "the tutor is
repeating consolidation against already-owned support"? That should be a new
pre-declared variant if pursued.

## Caveats

- This is prefix-controlled replay evidence, not held-out evidence.
- Selector-v4 shadowing is inherited from the source failure prefix and is not
  promoted as an evaluated selector arm.
- The replay used a live LLM suffix; do not overfit by repeated reruns.
