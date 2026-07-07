# Phase 5d Promoted Selector-v4 Mini-Run

Date: 2026-06-16

## Purpose

This was a first-pass paid retest of the newly promoted selector-v4 clamp:
`--pacing-guard-selective-v4` now implies conduct-policy enforcement by default.

The run was not designed as a V-positive selector validation. Existing
Ravensmark V-positive attempts showed visible/selective can succeed, but hidden
and baseline also succeed, so no true V-positive held-out world was available.
Instead, this mini-run used the two known selector-v4 negative-transfer worlds
from the prior confidence report: Lantern and Marrick.

## Arms

- H: `--pacing-guard --proof-debt-guard`
- V4 promoted: `--pacing-guard-selective-v4 --proof-debt-guard`

Both arms used the same decay stack, real provider stack, acts, release
authority, plot, throughline, critic off, and logic projection.

## Result Table

| world | arm | verdict | grounded | turns | final D | forced/asserted gap | fabricated facts | overreach | lucky leap | selector selected | conduct enforcement |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Lantern | hidden+proofDebt | grounded_anagnorisis | yes | 20 | 0 | 0 | 0 | 0 | 0 | n/a | off |
| Lantern | promoted selector-v4+proofDebt | grounded_anagnorisis | yes | 20 | 0 | 0 | 0 | 0 | 0 | hidden | on; 5/20 applied |
| Marrick | hidden+proofDebt | grounded_anagnorisis | yes | 22 | 0 | 0 | 0 | 0 | 0 | n/a | off |
| Marrick | promoted selector-v4+proofDebt | grounded_anagnorisis | yes | 22 | 0 | 0 | 0 | 0 | 0 | hidden | on; 5/22 applied |

## D Curves

| world | arm | D curve |
| --- | --- | --- |
| Lantern | hidden+proofDebt | `5->5->5->4->4->4->4->3->3->3->3->3->2->2->2->1->1->1->1->0` |
| Lantern | promoted selector-v4+proofDebt | `5->5->5->4->4->4->4->4->3->3->3->3->2->2->1->1->1->1->1->0` |
| Marrick | hidden+proofDebt | `6->6->5->5->5->5->4->4->4->3->3->3->2->2->2->2->1->1->1->1->1->0` |
| Marrick | promoted selector-v4+proofDebt | `6->6->6->5->5->5->5->4->4->3->3->3->3->2->2->2->2->1->1->1->1->0` |

## Conduct Enforcement

The promoted selector-v4 arms activated conduct policy and enforcement without
explicit `--conduct-policy` or `--conduct-policy-enforce` flags.

| world | checked | passed | failed | enforcement changes | move family |
| --- | ---: | ---: | ---: | ---: | --- |
| Lantern | 19 | 19 | 0 | 5 | `ask_diagnostic` |
| Marrick | 20 | 20 | 0 | 5 | `ask_diagnostic` |

All enforcement changes were `visible_hidden_conflict` corrections with
post-enforcement compliance passing.

## Interpretation

This reduces the immediate negative-transfer concern for the promoted
selector-v4 clamp. The two prior v4-risk worlds both grounded under the promoted
arm, matching hidden+proofDebt on final verdict, final D, forced/asserted gap,
fabricated facts, overreach, and lucky leap.

It does not establish adaptive selector success. In both worlds selector-v4
selected hidden and behaved as hidden plus visible-consolidation/answer-gate
shadowing and conduct enforcement. There is still no held-out world here where
visible or visible-consolidation uniquely beats hidden.

Mechanistically, the promoted clamp appears safe in this first-pass retest, but
the H/V selection problem remains unresolved.

## Recommendation

Do not broaden conduct enforcement to hidden+proofDebt. Do not claim selector-v4
as an adaptive-selector win.

Next paid work should be one of two things:

1. Repeat Lantern/Marrick with r2 only if we need stability evidence for the
   promoted clamp.
2. Preferably, first mine or construct a genuine V-positive/hidden-hurts fixture
   before running any mixed-world selector matrix.

## Commands And Artifacts

Launcher:

```bash
DERIVATION_PROVIDER=codex \
DERIVATION_LEARNER_PROVIDER=claude \
DERIVATION_LEARNER_MODEL=sonnet \
DERIVATION_CLI_TIMEOUT_MS=900000 \
DERIVATION_LLM=real \
DERIVATION_TRACE=0 \
node scripts/run-derivation-codex-learner-selector-probe.js \
  --worlds lantern,marrick \
  --arms hidden,selective-v4 \
  --runs 1 \
  --parallelism 4 \
  --provider codex \
  --learner-provider claude \
  --learner-model sonnet \
  --proof-debt-guard \
  --label-prefix phase5d-promoted-v4-mini \
  --group phase5d-promoted-v4-mini \
  --log-dir exports/dramatic-derivation/phase5d-promoted-v4-mini-run-logs
```

Manifest:

- `exports/dramatic-derivation/phase5d-promoted-v4-mini-run-logs/manifest.tsv`

Loop artifacts:

- `exports/dramatic-derivation/loop/lantern-phase5d-promoted-v4-mini-hidden-r1/`
- `exports/dramatic-derivation/loop/lantern-phase5d-promoted-v4-mini-selective-v4-r1/`
- `exports/dramatic-derivation/loop/marrick-phase5d-promoted-v4-mini-hidden-r1/`
- `exports/dramatic-derivation/loop/marrick-phase5d-promoted-v4-mini-selective-v4-r1/`

