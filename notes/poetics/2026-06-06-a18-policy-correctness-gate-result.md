# A18.13 Policy-Correctness Gate Result

Date: 2026-06-06

Status: implemented; A18.12 bead family re-scored as two corrected panel
candidates under the stricter gate. No paid panel was run.

## Question

A18.12 showed that the raw local recursive tutor-learning gate can accept a
continuation that repairs learner resistance with a different plausible public
rule. The decisive example was `bead_holdout_gold_middle`: S0 survived by using
an exact repeated badge-mark test, while S1 used the registered
`predecessor_alias_test`.

A18.13 asked whether the local gate could distinguish adaptive repair quality
from selected-policy correctness before another panel.

## Mechanism

Added sibling-level `policy_correctness` metadata to underdetermined transfer
families. For each held-out sibling the fixture now records:

- the registered selected repair
- the registered target
- public aliases for that target
- public markers of the selected repair
- aliases for incorrect/non-policy targets

This metadata is carried into `attempt-chain-plan.json` but is not rendered into
the replay transcript or policy memory. The gate evaluates only the saved public
continuation after subtracting the original stage text, so target names or cue
words already present in the setup do not create false positives.

Future ablation reports now include:

- `policy_correctness_gate`
- `effective_local_verdict`

The old `local_verdict` remains as the raw adaptation-gate verdict. The
effective verdict uses policy correctness when configured.

Added a zero-cost reporter:

`npm run poetics:recursive-tutor-policy-correctness -- --chain-dir <chain> --family <family>`

This reads saved ablation reports/manifests and writes an A18.13 correctness
overlay without regenerating transcripts.

## A18.12 Rescore

Command:

```bash
npm run poetics:recursive-tutor-policy-correctness -- \
  --chain-dir exports/recursive-tutor-learning/a18.12-second-family-repair-local \
  --family bead_predecessor_priority
```

Report:

`exports/recursive-tutor-learning/a18.12-second-family-repair-local/a18.13-policy-correctness-report.json`

Result:

| Sibling | Raw local verdict | Effective local verdict | Correctness verdict | Panel candidate |
| --- | --- | --- | --- | --- |
| `bead_holdout_blue_upper` | `policy_memory_local_advantage` | `policy_memory_local_advantage` | `policy_memory_correctness_advantage` | yes |
| `bead_holdout_gold_middle` | `no_local_headroom` | `policy_memory_local_advantage` | `policy_memory_correctness_advantage` | yes |

The gold sibling is the important case. S0 remains a raw local survivor, but the
correctness gate marks it `wrong_target`: it chooses `right_naro` via an exact
repeated badge-mark repair. S1 is marked `selected_policy_applied`: it chooses
`middle_naro` via the bead-strip one-step-before repair.

## Packaging Smoke

The contrast-panel wrapper now automatically applies
`a18.13-policy-correctness-report.json` as an overlay when present. A zero-cost
`--skip-score` packaging smoke found both bead siblings as pairs for the next
panel package:

`exports/recursive-tutor-learning/a18.12-second-family-repair-local/a18.13-correctness-overlay-panel-package`

The smoke report has zero critic votes because scoring was deliberately skipped;
it is not a panel result.

## Interpretation

A18.13 repairs the local decision rule. It does not prove the bead family yet,
but it prevents the specific A18.12 failure mode from being counted as
no-headroom merely because S0 produced some coherent adaptive repair.

The new claim boundary is sharper:

- raw local survivor = the continuation repairs learner resistance well enough
- policy-correct local survivor = the continuation repairs learner resistance
  using the registered selected policy on the registered target
- panel evidence is still needed to test whether blind critics attribute the
  difference to policy transfer rather than ordinary public inference

## Next Move

A18.14 should run the contrastive blind panel over the two A18.13-corrected bead
pairs. That is a paid step and should use the existing contrast-panel wrapper
with the A18.13 overlay present.
