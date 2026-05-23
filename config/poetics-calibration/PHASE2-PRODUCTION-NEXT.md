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
node scripts/analyze-poetics-production-v1.js \
  --target-repeats r01,r02,r03 \
  --control-repeats r01,r02,r03
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

**Completed, 2026-05-23.** `target-r04`, `control-r04-d4`, and
`control-r04-d10-emphatic` were generated with Codex and scored by Qwen
`qwen/qwen3.5-plus-02-15` plus Gemini `google/gemini-3.5-flash`.

The reframe arm initially tripped five blocking quality warnings, but inspection
showed valid ordinary public phrasing rather than invalid transcripts. The
quality detector was broadened with regression tests for those forms, then the
reframe key was re-cleaned to zero warnings.

Depth top-up result:

| Critic | `none` recognitions | `reframe` recognitions |
|---|---:|---:|
| Qwen | 3/6 | 6/6 |
| Gemini | 1/6 | 5/6 |

The paired controls stayed clean: D4 was flat for both critics and D10 emphatic
was trap for both critics. The depth-inclusive target aggregate is therefore
Qwen 3/24 `none` versus 23/24 `reframe`, and Gemini 2/24 `none` versus 21/24
`reframe`.

Interpretation: the depth top-up supports the public reframe manipulation, but
it also shows more uncued recognitive variance than the frozen three-repeat
claim. Keep the §7.9 production-v1 paper claim bounded to r01-r03 unless the
paper is deliberately revised to include the top-up.

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

**Completed, 2026-05-23.** The first breadth slice was generated with Codex on
D19-D24 and scored by Qwen plus Gemini. The target key initially exposed
admission warnings, but inspection showed valid public forms rather than bad
transcripts: intentional unfinished learner lines, replacement phrasings such as
`Replace it:` / `the form should say`, and one downgraded Director reframe cue
whose later public learner line still revoiced, named the framing problem, and
supplied a replacement. The detector now has regression coverage for those
forms, and all v2 keys are clean.

Breadth-v2 target result:

| Critic | `none` recognitions | `reframe` recognitions |
|---|---:|---:|
| Qwen | 1/6 | 5/6 |
| Gemini | 0/6 | 5/6 |

Form counts:

| Critic | `none` forms | `reframe` forms |
|---|---|---|
| Qwen | R1 T1 F4 | R5 T0 F1 |
| Gemini | R0 T1 F5 | R5 T0 F1 |

The same controls bracket the slice: D4 is flat for both critics and D10
emphatic is trap for both critics. This is the first positive transfer check
outside the original target family, but it is still one repeat over one new
scenario family, not a general-transfer claim.

## Step 4: Breadth repeats plus variation hardening

**Decision, 2026-05-23:** proceed now with more breadth repeats and director
variation hardening. Defer two larger moves until the next reassessment:
integrating these artifacts into the main evaluation database/harness, and
deciding whether the apparatus becomes a formal paper experiment rather than a
calibration/diagnostic mechanism.

The immediate risk is that additional repeats merely redraw the same scene
ecology and house voice. The generator therefore accepts a
`--director-variation-key` and the production batch runner supplies a stable key
per repeat/unit, for example `phase2-production-v2:r02:target`. This key is
persisted in the director plan, trace JSON, and scoring key. It should vary
scene/register defaults without changing condition labels, target/control
assignment, paired-prefix mechanics, critic models, or scoring policy.

Run the next breadth repeats only, retaining the v2 scenario family and the same
D4/D10 controls:

```bash
CODEX_REASONING_EFFORT=high node scripts/run-poetics-production-batch.js \
  --batch-id phase2-production-v2 \
  --target-spec config/poetics-calibration/phase2-dramas-v4.yaml \
  --target-only D19,D20,D21,D22,D23,D24 \
  --target-tid-start 18 \
  --repeats 3 \
  --stress-repeats 0 \
  --only target-r02,control-r02-d4,control-r02-d10-emphatic,target-r03,control-r03-d4,control-r03-d10-emphatic
```

Summarise the expanded v2 slice with:

```bash
node scripts/analyze-poetics-production-v1.js \
  --root-dir config/poetics-calibration/phase2-production-v2 \
  --out exports/poetics-production-v2-summary.json \
  --markdown exports/poetics-production-v2-summary.md
```

Do not pass `--allow-quality-warnings`. If warnings appear, inspect the public
sample and full trace, then either regenerate the invalid transcript or extend
the detector only for valid ordinary phrasing with regression coverage.

## Reporting rule

If the depth top-up or breadth slice changes the empirical interpretation, fold
the revised bounded claim into `docs/research/paper-full-2.0.md` before using it
in any spin-off, slide, or external summary.
