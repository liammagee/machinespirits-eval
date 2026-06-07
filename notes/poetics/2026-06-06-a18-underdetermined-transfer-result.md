# A18.9 Under-Determined Transfer-Family Result

Date: 2026-06-06

## Claim Boundary

This is a simulated counterfactual replay screen. It is not evidence of human
learning, model-weight learning, or a deployed adaptive tutor. It tests whether
a learned tutor policy can become locally load-bearing when the held-out public
stage admits multiple plausible repairs.

No blind panel was run. The result is a local-gate candidate only.

## Design

Family: `selector_rail_priority`

Config:
`config/recursive-tutor-learning/underdetermined-transfer-families.yaml`

Chain directory:
`exports/recursive-tutor-learning/a18.9-under-determined-local`

Policy selected repair: `selector_tab_test`

Competing public repairs:

- `color_match_test`
- `nearest_stamp_test`
- `rail_path_test`
- `selector_tab_test`

Held-out siblings:

- `selector_holdout_blue_lower`
- `selector_holdout_gold_middle`

The screen kept the A18.8 hardening defaults:

- fresh S0 and fresh S1 on the same held-out sibling;
- bounded continuation rather than whole-transcript rewriting;
- held-out inner metadata withheld with `inner_max_chars=0`;
- S1 gets the attempt-1 learned policy memory;
- S0 gets no policy memory;
- policy-contrast gate enabled;
- panel skipped until local headroom appears.

## Result

| Sibling | S0 status | S1 status | Local verdict | Policy contrast | Distinctiveness |
| --- | --- | --- | --- | --- | --- |
| `selector_holdout_blue_lower` | `reject` | `survivor` | `policy_memory_local_advantage` | `policy_distinct` | `0.241` |
| `selector_holdout_gold_middle` | `revise_again` | `survivor` | `policy_memory_local_advantage` | `policy_distinct` | `0.138` |

Corrected local reports:

- `exports/recursive-tutor-learning/a18.9-under-determined-local/a18.9-selector-blue-bounded-transfer/a18.9-underdetermined-transfer-family-report.json`
- `exports/recursive-tutor-learning/a18.9-under-determined-local/a18.9-selector-gold-bounded-transfer/a18.9-underdetermined-transfer-family-report.json`

The reports were initially emitted under the A18.8 filename because the wrapper
could not distinguish A18.8 and A18.9 bounded-transfer runs. The wrapper now
infers A18.9 from A18.9 run IDs / chain directories and also accepts
`--experiment-label`.

## Qualitative Read

On the blue-lower sibling, S0 repaired the failed comparison by switching to a
support-path / continuity test. That is coherent from the public stage, but it
does not instantiate the selected policy. S1 instead used the selector-tab test:
it temporarily bracketed color, nearness, and clean-line clues, then asked which
rail the frame tab selected.

On the gold-middle sibling, S0 again found a plausible non-policy repair: it
discarded the rail with no `rumi` and then chose the gold-marked remaining
`rumi`. S1 used the learned selector-tab policy and chose the middle `rumi`,
because the green frame tab selected the middle rail.

This is the first A18 screen where the local contrast does what the design asks:
S0 does not simply fail from incoherence, and S1 does not merely polish the same
move. The public stage supports several reasonable tutor repairs, while policy
memory selects one repair and carries it across siblings.

## Interpretation

A18.9 is a bounded local positive. It does not yet justify a reliable
peripeteia-induced adaptation claim, but it does repair the failure diagnosed in
A18.8: the public stage is no longer trivially overdetermining the same repair
for S0.

The decisive improvement is not higher S1 prose quality. It is differential
strategy selection under a hard local contrast:

- S0 can repair locally, but chooses a different plausible policy.
- S1 chooses the attempt-1 selected policy.
- The policy-contrast gate marks S0/S1 distinct on both siblings.

## Next Move

Do not generalize yet. The immediate next step is an A18.10 contrastive blind
panel over only this clean A18.9 S0/S1 bundle. The panel question should not be
"is the final learner answer right?" but:

> Did the policy-memory tutor use a learned selector policy to address the
> learner's resistance in a way the no-policy tutor did not?

If the panel passes both siblings, the next serious standard is a second
under-determined transfer family, not more tuning of this selector family.
