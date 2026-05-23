# Phase-2 production next moves

**Decision, 2026-05-23:** do both depth and breadth, in that order.

Production-v1 is frozen as the current bounded result: three target repeats,
three flat/trap control repeats, and the stress slice are complete and already
folded into `docs/research/paper-full-2.0.md` as a scoped §7.9 claim. The frozen
claim is only about critic-rated dramatic form in this scenario family: Director
reframing sharply increases recognitive form, while flat/trap controls show the
critics are not merely rewarding emphatic insight language.

## Step 1: Freeze production-v1

The frozen baseline is:

| Critic | `none` recognitions | `reframe` recognitions |
|---|---:|---:|
| Qwen | 0/18 | 17/18 |
| Gemini | 1/18 | 16/18 |

Reproduce with:

```bash
node scripts/analyze-poetics-production-v1.js
```

## Step 2: Small depth top-up

Run exactly one more target/control repeat on the same target family. The purpose
is not to chase a perfect score; it is to test whether the D9/T10 reframe miss
and the Gemini uncued D7/T18 recognition remain isolated variance under one more
paired draw.

```bash
CODEX_REASONING_EFFORT=high node scripts/run-poetics-production-batch.js \
  --batch-id phase2-production-v1 \
  --repeats 4 \
  --stress-repeats 1 \
  --only target-r04,control-r04-d4,control-r04-d10-emphatic
```

Do not pass `--allow-quality-warnings` on real production artifacts. If the key
records warnings, inspect and either re-clean valid ordinary phrasing or
regenerate invalid transcripts.

## Step 3: Breadth production-v2

Run the same mechanism on a new scenario family rather than another draw from
D7/D9/D11/D14/D17/D18. The breadth spec is
`config/poetics-calibration/phase2-dramas-v4.yaml` (D19-D24: medicine,
cartography, sociology, environmental science, engineering, media studies).

The first breadth slice keeps the same target contrast and the same controls:

```bash
CODEX_REASONING_EFFORT=high node scripts/run-poetics-production-batch.js \
  --batch-id phase2-production-v2 \
  --target-spec config/poetics-calibration/phase2-dramas-v4.yaml \
  --target-only D19,D20,D21,D22,D23,D24 \
  --target-tid-start 18 \
  --repeats 1 \
  --stress-repeats 0
```

Summarise breadth with:

```bash
node scripts/analyze-poetics-production-v1.js \
  --root-dir config/poetics-calibration/phase2-production-v2 \
  --out exports/poetics-production-v2-summary.json \
  --markdown exports/poetics-production-v2-summary.md
```

## Reporting rule

If the depth top-up or breadth slice changes the empirical interpretation, fold
the revised bounded claim into `docs/research/paper-full-2.0.md` before using it
in any spin-off, slide, or external summary.
