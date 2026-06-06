# A18.33 Fold-Anchor Local Result

Date: 2026-06-06

Status: local negative; no panel candidate.

## Family

Config:

`config/recursive-tutor-learning/a18.32-fresh-family-cue-pass.yaml`

Family:

`fold_anchor_priority`

Chain:

`exports/recursive-tutor-learning/a18.32-fresh-family-local`

Primary local report artifacts:

- `exports/recursive-tutor-learning/a18.32-fresh-family-local/fold_anchor_priority/a18.33-fold-holdout-blue-local/a18.33-cue-pass-family-local-report.json`
- `exports/recursive-tutor-learning/a18.32-fresh-family-local/fold_anchor_priority/a18.33-fold-holdout-gold-local/a18.33-cue-pass-family-local-report.json`

Both report artifacts are export outputs and may be gitignored; this note is the
durable repo-local result summary.

## Attempt 1

Attempt-1 replay used Claude as generator and `agy` as checker.

Result:

- `survivor: 1`

Policy fill:

- `filled: 1`

## Held-Out Local Screens

| Sibling | S0 | S1 | Raw local verdict | Effective local verdict | Policy contrast | Distinctiveness | Policy correctness |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `fold_holdout_blue_upper` | survivor | survivor | `no_local_headroom` | `no_local_survivor` | `not_policy_distinct` | `0.112` | `no_correct_policy_application` |
| `fold_holdout_gold_middle` | survivor | survivor | `no_local_headroom` | `no_local_survivor` | `policy_distinct` | `0.223` | `no_correct_policy_application` |

No panel was run.

## Diagnosis

The A18.31 cue-map preflight successfully blocked the two known failure classes
from A18.26/A18.29, but A18.33 exposes a third class:

`selector_like_public_governance_self_solving`

The folded nub was intended to be medium-visible: public enough for S1 to use
after policy transfer, but not so obvious that S0 would discover it. In practice,
S0 read it as a governance/pointer cue without needing policy memory.

## Evidence

`fold_holdout_blue_upper`, S1:

> "The fold is clipped beside the upper tray--so upper is the eligible tray"

This is semantically close to the intended policy, but the registered markers
were too narrow (`anchor fold`, `fold anchor`, `frame anchor`, `authority fold`,
`anchor-marked tray`), so the correctness overlay marked it as missing a
selected-repair marker.

However, broadening the marker list would not rescue the family because S0 also
solved through the same public relation:

`fold_holdout_gold_middle`, S0:

> "It's marking which tray to pick. The middle ralo gets the badge"

The decisive failure is therefore no headroom, not only marker mismatch.

## Interpretation

This is a useful failure because it tests the new preflight gate and finds a
false negative. The gate can distinguish prior positives from the inverse and
direct-visible-source failures, but it still lets through a selector-like cue
whose public "marker beside tray" geometry is too easy for S0 to construe as a
pointer.

Claim boundary:

- This is not evidence of reliable adaptation.
- This is not a marker-only evaluator miss.
- It is evidence that the apparatus learned a new local failure class: visible
  adjacent selector/governance markers can be self-solving before policy memory
  has any chance to contribute.

## Next Move

Do not panel `fold_anchor_priority`.

Add a new cue-risk class for selector-like public governance markers where:

- the selected cue is a visible marker adjacent to the correct target;
- no constructed device is required;
- the old check is ordinary cue tallying;
- the candidate is not already a prior empirical positive control.

Future cue-map passes should require either a constructed public device, a
non-adjacent cue relation, or an explicit accepted-positive status.
