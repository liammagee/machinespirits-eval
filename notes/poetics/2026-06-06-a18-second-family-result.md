# A18.11 Second Under-Determined Transfer-Family Result

Date: 2026-06-06

## Claim Boundary

This is a simulated counterfactual replay screen. It is not evidence of human
learning, model-weight learning, or a deployed adaptive tutor. It tests whether
the A18.9/A18.10 pattern replicates on a second artificial local relation.

No blind panel was run. The local gate did not justify panel spending.

## Design

Family: `notch_rotation_priority`

Config:
`config/recursive-tutor-learning/underdetermined-transfer-families.yaml`

Chain directory:
`exports/recursive-tutor-learning/a18.11-second-family-local`

Selected repair: `rotation_fit_test`

Competing public repairs:

- `color_match_test`
- `nearest_slot_test`
- `corridor_path_test`
- `rotation_fit_test`

Hardening defaults:

- fresh S0 and fresh S1 on the same held-out sibling;
- bounded continuation rather than whole-transcript rewriting;
- held-out inner metadata withheld with `inner_max_chars=0`;
- S1 gets the attempt-1 learned policy memory;
- S0 gets no policy memory;
- policy-contrast gate enabled;
- panel skipped unless local headroom survives.

Corrected local reports:

- `exports/recursive-tutor-learning/a18.11-second-family-local/a18.11-notch-green-bounded-transfer/a18.11-second-underdetermined-transfer-family-report.json`
- `exports/recursive-tutor-learning/a18.11-second-family-local/a18.11-notch-red-bounded-transfer/a18.11-second-underdetermined-transfer-family-report.json`

## Result

| Sibling | S0 status | S1 status | Local verdict | Policy contrast | Distinctiveness |
| --- | --- | --- | --- | --- | --- |
| `notch_holdout_green_top` | `revise_again` | `survivor` | `policy_memory_local_advantage` | `policy_distinct` | `0.250` |
| `notch_holdout_red_middle` | `survivor` | `survivor` | `no_local_headroom` | `policy_distinct` | `0.375` |

Attempt 1 survived and filled the policy ledger. On the first held-out sibling,
the design worked locally: S0 produced a plausible corridor-first repair but did
not survive, while S1 used the notch-turn fit and survived.

On the second held-out sibling, S0 survived. It did not use the exact configured
`rotation_fit_test`; it invented a different public notch relation, a
`locking-edge` / facing-back test. But that was enough for the local critic to
score the transcript as a survivor. Under A18.11's stop rule, S0 survival blocks
panel escalation even though the policy-contrast gate still marked S1 as
distinctly more policy-like.

## Interpretation

A18.11 is a mixed local result and a failed family-level replication. It does not
invalidate A18.9/A18.10, but it shows that the second family is not yet strong
enough to support the broader reliability claim.

The useful diagnosis is more precise than "S0 found the same policy." S0 did not
recreate the exact rotation-fit signature. Instead, the public notch apparatus
made another notch-based relation easy enough to invent. That means the held-out
public stage still over-affords adaptive repair, even when it does not
overdetermine the same repair.

## Next Move

Do not panel `notch_rotation_priority` in its current form. The next design move
is A18.12: make the second family less publicly self-solving by separating the
selected repair from the visible object vocabulary. A good candidate should make
S0 choose a plausible non-policy repair without letting that repair itself become
a local survivor.
