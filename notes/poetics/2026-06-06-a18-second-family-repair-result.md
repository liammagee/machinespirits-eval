# A18.12 Second-Family Repair Result

Date: 2026-06-06

Status: mixed local result, no panel.

## Question

A18.11 failed as a second-family replication because one held-out notch sibling
let S0 survive without policy memory by inventing a different public notch
relation. A18.12 asked whether a repaired non-selector family could make the
selected repair less publicly self-solving while preserving multiple plausible
public repairs.

## Design Change

Added `bead_predecessor_priority` to
`config/recursive-tutor-learning/underdetermined-transfer-families.yaml`.

The selected repair is `predecessor_alias_test`: after ordinary comparison
produces competing visible cues, the tutor should construct a temporary
four-step bead-order strip and choose the token whose bead count is immediately
before the final mark's bead count in the local cycle.

The public setup still leaves competing visible repairs available:

- `color_match_test`
- `nearest_slot_test`
- `corridor_path_test`
- `majority_count_test`
- `predecessor_alias_test`

The first training attempt failed locally because the model treated the bead
rail as preprinted scene furniture rather than as a tutor-constructed repair
device. The fixture was tightened so the hidden design metadata requires the
tutor to build the temporary strip publicly after learner resistance and to
close with a teacher-as-learner update.

## Local Runs

Chain directory:

`exports/recursive-tutor-learning/a18.12-second-family-repair-local`

Training attempt:

- Initial attempt: `revise_again`
- Repaired attempt: `survivor`
- Policy fill: `bead_predecessor_priority` filled, other families skipped

Held-out ablations:

| Sibling | S0 no policy | S1 policy memory | Local verdict | Policy contrast | Distinctiveness |
| --- | --- | --- | --- | --- | --- |
| `bead_holdout_blue_upper` | `revise_again` | `survivor` | `policy_memory_local_advantage` | `policy_distinct` | `0.200` |
| `bead_holdout_gold_middle` | `survivor` | `survivor` | `no_local_headroom` | `policy_distinct` | `0.300` |

Reports:

- `exports/recursive-tutor-learning/a18.12-second-family-repair-local/a18.12-bead-blue-bounded-transfer/a18.12-second-underdetermined-transfer-family-repair-report.json`
- `exports/recursive-tutor-learning/a18.12-second-family-repair-local/a18.12-bead-gold-bounded-transfer/a18.12-second-underdetermined-transfer-family-repair-report.json`

## Interpretation

This is another family-level failure, not a panel candidate.

The blue sibling worked in the desired S0-hard pattern: without policy memory,
S0 failed on old-warrant misclassification, while S1 used the filled
bead-predecessor policy and survived.

The gold sibling blocked the claim. S0 survived without policy memory by
choosing an exact repeated badge-mark test: the final badge had three beads and
the right token had three beads, so S0 could present an accountable local repair
that resolved the learner's scorecard complaint. This was not the selected
policy, and the policy-contrast gate correctly marked the arms as distinct, but
the local adaptation gate still accepted S0 as a survivor.

That matters because it shows the remaining weakness is not only public
self-solving of the selected policy. A different plausible public repair can
satisfy the current recursive tutor-learning gate if it produces a coherent
diagnosis, tactic shift, and learner uptake. The gate currently measures
adaptive repair quality more than selected-policy correctness.

## Verdict

A18.12 does not give a second-family replication of A18.9. It reinforces the
need for an answer-accountability or selected-policy-correctness check before
we treat local headroom as evidence of policy-memory transfer.

No contrastive blind panel was run.

## Next Move

A18.13 should add a policy-correctness gate for underdetermined transfer
families: local survivor status should require that the continuation applies
the registered selected repair to the registered target, not merely that it
finds some coherent public repair that the learner accepts.
