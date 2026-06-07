# A18.17 Fresh-Family Local Screen Result

Date: 2026-06-06

Status: local negative under the frozen A18.16 protocol. No contrastive panel
was run.

## Question

A18.17 asked whether a fresh third artificial local-relation family, authored
after the A18.16 correctness-gated protocol freeze, could become a local
candidate before any panel spending.

## Fresh Family

Family: `hinge_shadow_priority`

Config:

`config/recursive-tutor-learning/a18.17-fresh-family.yaml`

The selected repair was `hinge_shadow_test`: use the hinge-edge smudge as the
governing public test when pigment, distance, and lane cues conflict.

## Static Validation

Frozen protocol validation:

```bash
npm run poetics:recursive-tutor-protocol -- \
  --config config/recursive-tutor-learning/a18.17-fresh-family.yaml
```

Result: `pass` for 1 family, 0 errors, 0 warnings.

Benchmark fixture validation:

```bash
npm run poetics:recursive-tutor-learning -- \
  --config config/recursive-tutor-learning/a18.17-fresh-family.yaml \
  --out-dir exports/recursive-tutor-learning/a18.17-fresh-family-local \
  --dry-run
```

Result: valid, 0 issues, 1 family `ready_for_attempt1`.

## Local Run

Materialized chain:

`exports/recursive-tutor-learning/a18.17-fresh-family-local`

Attempt-1 replay:

```bash
node scripts/replay-discursive-transcript.js \
  --transcript exports/recursive-tutor-learning/a18.17-fresh-family-local/hinge_shadow_priority/training-seed.full.md \
  --generator codex \
  --checker claude \
  --recursive-tutor-learning-gate \
  --out-dir exports/recursive-tutor-learning/a18.17-fresh-family-local/hinge_shadow_priority/attempt1-replay \
  --timeout-ms 900000 \
  --force
```

Result: `survivor: 1`.

Policy fill:

```bash
npm run poetics:recursive-tutor-policy -- \
  --chain-dir exports/recursive-tutor-learning/a18.17-fresh-family-local
```

Result: `filled: 1`; preferred move `pose_counterexample`.

Held-out local screen was run only for `hinge_holdout_teal_inner`:

```bash
npm run poetics:recursive-tutor-ablation -- \
  --chain-dir exports/recursive-tutor-learning/a18.17-fresh-family-local \
  --family hinge_shadow_priority \
  --sibling hinge_holdout_teal_inner \
  --out-dir exports/recursive-tutor-learning/a18.17-fresh-family-local/hinge_shadow_priority/a18.17-hinge-holdout-teal-local \
  --run-id a18-17-hinge-teal-local \
  --generator codex \
  --checker claude \
  --fresh-s1 \
  --inner-max-chars 0 \
  --rewrite-mode bounded_continuation \
  --policy-contrast-gate \
  --panel-policy headroom \
  --skip-panel \
  --experiment-label a18.17_fresh_family_frozen_protocol \
  --timeout-ms 900000 \
  --force
```

Report:

`exports/recursive-tutor-learning/a18.17-fresh-family-local/hinge_shadow_priority/a18.17-hinge-holdout-teal-local/a18.17-fresh-family-frozen-protocol-report.json`

## Result

| Field | Verdict |
| --- | --- |
| S0 local status | `revise_again` |
| S1 local status | `survivor` |
| Raw local verdict | `policy_memory_local_advantage` |
| Effective local verdict | `policy_memory_local_advantage` |
| Policy correctness verdict | `policy_memory_correctness_advantage` |
| Policy contrast verdict | `not_policy_distinct` |
| Panel verdict | `not_panelled` |

Key policy-contrast detail:

- S0 signature overlap: `0.545`
- S1 signature overlap: `0.545`
- distinctiveness: `0`
- minimum distinctiveness required: `0.12`

S1 was correctly targeted: it applied `hinge_shadow_test` to `inner_sima`.
S0 was not a local survivor and did not pass policy correctness. But S0 still
used enough hinge/smudge/folding vocabulary that the signature contrast did not
separate the arms. Under A18.16, this blocks the pair.

## Decision

Stop locally. This family has only two held-out siblings; after the first sibling
failed the policy-distinct gate, it cannot reach the A18.16 requirement of at
least two local panel candidates. The second sibling was therefore not run.

No panel should be run for `hinge_shadow_priority`.

## Interpretation

This is not evidence against the A18.15 bounded positive. It is evidence that
the frozen A18.16 protocol is doing real work. A transcript can show S1
improvement and selected-policy correctness while still failing the stricter
policy-distinctiveness requirement.

The likely failure source is that the selected repair is too lexicalized in the
public stage: even an S0 continuation that fails the local gate can reuse enough
hinge/smudge vocabulary to match the learned policy signature. The next design
move should not be to relax the gate after seeing this transcript. Either:

1. keep protocol v1 and author a new family whose selected repair is less
   recoverable from public vocabulary alone; or
2. explicitly pre-register a protocol v2 that changes how policy signatures are
   measured, then test it only on future families.
