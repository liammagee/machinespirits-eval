# Phase 5g A20 Fresh First-Pass Validation

Date: 2026-06-16

Status: paid first-pass run with real role calls. No crash recovery, no reruns.

## Purpose

This run tested the current promoted selector-v4/conduct clamp against the
plain hidden + proofDebt baseline on three small fresh first-pass worlds:
Hethel, Withercombe, and Ravensmark.

The question was narrow: do replay-local A20 wins survive fresh dialogue
generation, and does promoted selector-v4 avoid negative transfer against
hidden + proofDebt?

## Arms

- H: `--pacing-guard --proof-debt-guard`
- V4 promoted: `--pacing-guard-selective-v4 --proof-debt-guard`

Selector-v4 implies conduct-policy logging and enforcement by default. In all
three promoted arms selector-v4 selected `hidden`, not visible. Therefore this
run does not test adaptive visible routing; it tests hidden + proofDebt plus
the selector-v4 visible-consolidation / assertion-gate / conduct overlay.

## Result Table

| World | Arm | Label | Verdict | Grounded | Turns | Final D | Forced | Asserted | Gap | Repairs | Fabricated | Overreach | Lucky leap | Selector | Conduct pass | Enforcement changes |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| Hethel | hidden+proofDebt | `hethel-phase5g-a20-fresh-hidden-r1` | `grounded_anagnorisis` | yes | 20 | 0 | 20 | 20 | 0 | 1 | 0 | 0 | 0 | n/a | n/a | n/a |
| Hethel | promoted selector-v4+proofDebt | `hethel-phase5g-a20-fresh-selective-v4-r1` | `disengagement` | no | 11 | 4 | - | - | - | 0 | 0 | 0 | 0 | hidden | 10/10 | 2 |
| Withercombe | hidden+proofDebt | `withercombe-phase5g-a20-fresh-hidden-r1` | `grounded_anagnorisis` | yes | 19 | 0 | 19 | 19 | 0 | 13 | 0 | 0 | 0 | n/a | n/a | n/a |
| Withercombe | promoted selector-v4+proofDebt | `withercombe-phase5g-a20-fresh-selective-v4-r1` | `grounded_anagnorisis` | yes | 19 | 0 | 19 | 19 | 0 | 7 | 0 | 0 | 0 | hidden | 18/18 | 2 |
| Ravensmark | hidden+proofDebt | `ravensmark-phase5g-a20-fresh-hidden-r1` | `grounded_anagnorisis` | yes | 13 | 0 | 13 | 13 | 0 | 1 | 0 | 0 | 0 | n/a | n/a | n/a |
| Ravensmark | promoted selector-v4+proofDebt | `ravensmark-phase5g-a20-fresh-selective-v4-r1` | `grounded_anagnorisis` | yes | 14 | 0 | 14 | 14 | 0 | 4 | 0 | 0 | 0 | hidden | 13/13 | 2 |

## D Curves

| World | Arm | D curve |
| --- | --- | --- |
| Hethel | hidden+proofDebt | `5->5->5->4->4->4->4->4->3->3->3->3->2->2->2->1->1->1->1->0` |
| Hethel | promoted selector-v4+proofDebt | `5->5->5->5->5->4->4->4->4->4->4` |
| Withercombe | hidden+proofDebt | `6->6->6->5->5->4->3->3->3->3->2->2->2->2->2->1->1->1->0` |
| Withercombe | promoted selector-v4+proofDebt | `6->6->6->5->5->4->4->4->4->3->3->3->3->2->2->1->1->1->0` |
| Ravensmark | hidden+proofDebt | `2->2->2->1->1->1->1->1->1->1->1->1->0` |
| Ravensmark | promoted selector-v4+proofDebt | `2->2->2->1->1->1->1->1->1->1->1->1->1->0` |

## Conduct Policy

| World | Promoted arm active turns | Move-family mix | Compliance | Enforcement changed |
| --- | ---: | --- | ---: | ---: |
| Hethel | 10 | `ask_diagnostic` 8, `release_next_evidence` 2 | 10/10 | 2 |
| Withercombe | 18 | `ask_diagnostic` 8, `release_next_evidence` 3, `repair_dependency` 7 | 18/18 | 2 |
| Ravensmark | 13 | `ask_diagnostic` 7, `release_next_evidence` 3, `repair_dependency` 3 | 13/13 | 2 |

The conduct policy passed its own post-enforcement compliance checks in every
promoted run. The Hethel failure is therefore not a generator-compliance
failure. It is a policy-level negative transfer: locally compliant diagnostic
moves and visible-consolidation holds can still starve proof progress.

## Negative Transfer

- Final-outcome negative transfer: Hethel. Hidden grounded at t20; promoted
  selector-v4 disengaged at t11 with final D=4.
- Turn-count negative transfer: Ravensmark. Hidden grounded at t13; promoted
  selector-v4 grounded at t14.
- No negative transfer: Withercombe matched hidden on final verdict, turn, gap,
  fabricated facts, overreach, and lucky leap.

## Hethel Failure Classification

Classification: conduct/guard policy artifact, not old-style H/V route failure.

Selector-v4 selected `hidden` in Hethel. The failing overlay was the promoted
visible-consolidation and conduct layer:

- `ask_diagnostic` fired eight times from `visible_hidden_conflict`.
- `p_point` was delayed from planned t4 to t6.
- `p_surface` was delayed from planned t9 to t11.
- Two proof-critical early exhibits, `m_record` and `m_yard`, were decayed and
  unrepaired at the end.
- The run disengaged at t11 after a long plateau: D only moved from 5 to 4.

The transcript shows the tutor repeatedly asking the learner to read back or
separate the existing public record instead of advancing the proof quickly
enough. This is exactly the risk A20 was meant to surface: a locally reasonable
conduct move can be globally bad when repeated or allowed to delay due
evidence.

## Interpretation

This run falsifies promotion of selector-v4/conduct enforcement as a general
reliability baseline. The strongest current baseline remains hidden +
proofDebt, not promoted selector-v4.

The A20 fixture and replay machinery is still useful: it caught a real local
policy issue and produced a replayable Hethel fixture. But the fresh run shows
that successful local compliance is insufficient. The policy needs a progress
budget: diagnostic moves must be bounded, premise-local, and subordinate to
release/proofDebt progress when the proof is starving.

## Recommended Next Policy

Do not broaden or celebrate promoted selector-v4.

Recommended engineering change:

1. Remove selector-v4's default conduct enforcement, or gate it behind an
   explicit flag for paid probes.
2. Add a `visible_hidden_conflict` budget: do not keep firing
   `ask_diagnostic` on the same premise family across adjacent turns.
3. Prevent `ask_diagnostic` from delaying a certified release at its safe
   boundary unless the trigger is a predeclared valid-alternative fixture.
4. Re-run the Hethel promoted arm after that change, paired against hidden.

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
  --worlds hethel,withercombe,ravensmark \
  --arms hidden,selective-v4 \
  --runs 1 \
  --parallelism 3 \
  --provider codex \
  --learner-provider claude \
  --learner-model sonnet \
  --proof-debt-guard \
  --label-prefix phase5g-a20-fresh \
  --group phase5g-a20-fresh \
  --log-dir exports/dramatic-derivation/phase5g-a20-fresh-run-logs
```

Manifest:

- `exports/dramatic-derivation/phase5g-a20-fresh-run-logs/manifest.tsv`

Loop artifacts:

- `exports/dramatic-derivation/loop/hethel-phase5g-a20-fresh-hidden-r1/`
- `exports/dramatic-derivation/loop/hethel-phase5g-a20-fresh-selective-v4-r1/`
- `exports/dramatic-derivation/loop/withercombe-phase5g-a20-fresh-hidden-r1/`
- `exports/dramatic-derivation/loop/withercombe-phase5g-a20-fresh-selective-v4-r1/`
- `exports/dramatic-derivation/loop/ravensmark-phase5g-a20-fresh-hidden-r1/`
- `exports/dramatic-derivation/loop/ravensmark-phase5g-a20-fresh-selective-v4-r1/`
