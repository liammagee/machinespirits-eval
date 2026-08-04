# Grounding-validator silent-drop audit

**Date:** 2026-08-04
**Workplan item:** `measure-silent-drop-rate-in-the-grounding-validator`
**Method:** existing traces plus deterministic mock verification; zero paid/model calls

## Outcome

The card was aimed at the wrong component. `cell_113_a13_C4_validator` runs the
A13 post-policy `tutorValidator`; it has no evidence ledger and emits no
`hypothesis_id` verdicts. The evidence-ledger `groundingValidator` whose unknown
ids were silently dropped is enabled in cells 127/128. Its paired
strategy-shift comparison is cell 127 (validator on) against cell 126 (validator
off), not cell 113 against cell 112.

The exact historical silent-drop rate is **not identifiable**. The completed
cell-127/128 traces store end-of-turn hypothesis and evidence snapshots, but not
the validator's raw `{hypothesis_id, new_status, reasoning}` proposals. An
unknown-id proposal disappears before persistence, and the snapshot also
collapses the updater and validator intermediate states. Absence of recorded
drops is therefore not evidence of a 0% drop rate.

## Retrospective structural audit

The audit covered all completed evidence-bound Stage-5 dialogues in the local
canonical evaluation store:

- cell 127: 33 dialogues, 66 original/counterfactual branches;
- cell 128: 34 dialogues, 68 branches;
- total: 67 dialogues, 134 branches, no missing trace files.

Across those branches there are 493 observed terminal events: 268 hypotheses
first appear in a persisted turn already `validated` or `contradicted`, and 225
change to one of those states after a previously observed status. All 493 have
non-empty status-relevant evidence
references, and every referenced id exists in the validated evidence ledger at
that turn. Of those, 492/493 (99.8%) also satisfy the validator prompt's status
threshold. The exception is a cell-127 counterfactual transition to `validated`
at confidence 0.7 with six supporting and two contradicting ledger references;
it violates the promotion rule's requirement of no contradicting evidence.

This 99.8% figure is a snapshot-consistency rate across both first appearances
and within-trace transitions. It is not a reasoning-citation
rate, a validator-only transition rate, or a silent-drop rate.

## Outcome context

The corrected paired strategy-shift analysis reproduces the canonical §6.9.7
result:

| Arm | N | `strategy_shift_correctness` |
|---|---:|---:|
| cell 126, updater only | 33 | 14/33 = 42.4% |
| cell 127, updater + grounding validator | 33 | 18/33 = 54.5% |

The validator-enabled arm is +12.1 percentage points on the binary instrument.
As already reported in §6.9.7, this does not survive the graded channel (3.84
versus 3.85, +0.01). The trace audit narrows only the mechanism attribution:
the arm-level contrast is real, but the historical snapshots cannot say which
layer emitted each individual terminal status.

For completeness, the card-as-written cell-112/cell-113 comparison is 30.4%
(7/23) versus 41.7% (10/24). It is not a grounding-validator ablation: cell 112
is the A13 ego/superego arm, while cell 113 adds external state-policy machinery
and the unrelated post-policy validator.

## Prospective repair

The graph now appends two audit event types without changing its policy:

- `grounding_validator_call_audit` records every validator call, including
  zero-decision and no-tentative calls;
- `grounding_validator_decision_audit` records every proposal, whether it was
  applied or dropped, its drop reason, cited ledger ids, missing/off-hypothesis
  citations, threshold check, and structural-grounding verdict.

`scripts/analyze-grounding-validator-silent-drops.js` reports exact proposal and
drop rates when those events exist. On legacy traces it fails closed with a null
silent-drop rate and separately reports the observable snapshot audit.

A deterministic cell-127 mock smoke completed eight dialogues / sixteen
branches. The analyzer observed 66 validator calls and 31 decisions: 31/31 were
applied and structurally grounded, with 0/31 dropped. This validates the new
instrumentation only; it is not an estimate of real-model behaviour. The audit
also exposed and repaired a mock-fixture drift: the mock had counted duplicate
evidence ids toward the three-distinct-support promotion threshold.

## Reproduction

```bash
node scripts/analyze-grounding-validator-silent-drops.js \
  --db /Users/lmagee/.machinespirits-data/evaluations.db \
  --logs /Users/lmagee/.machinespirits-data/logs \
  --out /tmp/grounding-validator-silent-drop-audit.json
```

```bash
EVAL_DB_PATH=/Users/lmagee/.machinespirits-data/evaluations.db \
EVAL_LOGS_DIR=/Users/lmagee/.machinespirits-data/logs \
node scripts/analyze-strategy-shift.js \
  --run-id eval-2026-05-16-3be510e0,eval-2026-05-16-d568e315,eval-2026-05-16-7618e763,eval-2026-05-16-20df7c6d,eval-2026-05-16-65dc376a,eval-2026-05-16-d65a0e9a,eval-2026-05-16-3b7e7640,eval-2026-05-16-c1da04e7,eval-2026-05-17-a4a74b0b
```
