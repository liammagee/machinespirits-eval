# Phase-2 production v1 plan

**Status: pre-specified production-shaped run plan, 2026-05-22.**
This is the next step after `PHASE2-DRAMA-PROGRESS.md`: stop adding one-off
diagnostic probes and run the calibrated dramatic mechanism as a repeatable
batch.

This is still not a paper claim until the batch is completed, inspected, and
folded into `docs/research/paper-full-2.0.md`.

## Batch shape

Runner:

```bash
node scripts/run-poetics-production-batch.js --batch-id phase2-production-v1
```

Default shape:

- Generator: Codex CLI, high-level role orchestration via
  `scripts/generate-pedagogical-dramas.js`.
- Target repeats: 3.
- Target scenarios per repeat: D7, D9, D11, D14, D17, D18.
- Target contrast: paired fixed-prefix `none` versus `reframe`.
- Reframe anchor: `misframing-candidate`.
- Controls per repeat: D4 flat and D10 emphatic trap.
- Stress slice: one uncued D8, D12, D13, D15, D16 pass.
- Critics: `qwen/qwen3.5-plus-02-15` and `google/gemini-3.5-flash`.
- Public samples, held-out deliberation, role transcripts, keys, and scores all
  land under `config/poetics-calibration/phase2-production-v1/`.

## Why this shape

The current calibration does not support a deterministic claim that every
reframe becomes recognition or every uncued target stays flat. It supports a
probabilistic mechanism claim: public reframe interventions add strong
recognitive pressure, while uncued recognition can still emerge from the
bilateral roles themselves.

The production run therefore keeps:

- repeated draws, so variance is visible rather than treated as an error;
- fixed-prefix paired target continuations, so `none` and `reframe` arms share
  the same early scene;
- flat and trap controls beside every target repeat, so scorer drift is visible;
- the stress slice, so impasse, sticky-flat, ordinary-flat, and costume-trap
  material remains in view;
- Qwen and Gemini as independent critics, with human labelling preserved as an
  additional reader perspective rather than ground truth.

## Useful commands

Print the plan without running models:

```bash
node scripts/run-poetics-production-batch.js --dry-run
```

Run a fast plumbing smoke in `/tmp`:

```bash
node scripts/run-poetics-production-batch.js \
  --mock \
  --batch-id phase2-production-v1-smoke \
  --root-dir /tmp/phase2-production-v1-smoke \
  --repeats 1 \
  --stress-repeats 1 \
  --allow-quality-warnings \
  --force
```

Run only the first target repeat:

```bash
node scripts/run-poetics-production-batch.js \
  --batch-id phase2-production-v1 \
  --only target-r01
```

Score existing generated artifacts without regenerating:

```bash
node scripts/run-poetics-production-batch.js \
  --batch-id phase2-production-v1 \
  --skip-generate
```

## Interpretation rules

- Treat branch labels as claims only after quality warnings are clean.
- Treat human labels as one reader perspective, not ground truth.
- Preserve critic disagreement; do not smooth it into a binary pass/fail.
- Do not report the result in spin-off docs before adding the empirical claim to
  `docs/research/paper-full-2.0.md`.

## Checkpoints

### target-r01

The first attended checkpoint completed under
`config/poetics-calibration/phase2-production-v1/target-r01/`.

After re-cleaning the generated traces against the current admission heuristics,
both target arms are cleanly scoreable: `none` and `reframe` each have six
scored transcripts, zero skipped transcripts, and zero blocking quality
warnings.

| Critic | `none` | `reframe` |
|---|---:|---:|
| Qwen | 0 recognition / 6 flat | 6 recognition / 0 flat |
| Gemini | 0 recognition / 6 flat | 6 recognition / 0 flat |

The repeat-1 controls now have matching artifacts under
`control-r01/d4/` and `control-r01/d10-emphatic/`.

| Control | Qwen | Gemini |
|---|---|---|
| D4 flat | flat | flat |
| D10 emphatic trap | recognition | trap |

D4 brackets the target result as intended. D10 does not: Qwen reads the generated
sample as recognitive because the learner's later crossed-out-name example
re-reads the earlier winners/write-the-label slogan. Preserve this as a split
control result unless a later pre-specified stress/control slice supplies a
cleaner trap bracket.

The pre-specified stress slice completed under `stress-r01/`:

| Scenario | Stress role | Qwen | Gemini |
|---|---|---|---|
| D8/T07 | impasse/boundary | recognition | flat |
| D13/T09 | sticky flat | flat | flat |
| D15/T11 | impasse | flat | flat |
| D12/T15 | ordinary flat | trap | trap |
| D16/T17 | costume trap | trap | trap |

D16 supplies the cleaner trap bracket for repeat 1. D8 should be treated as a
boundary split, not as a silent failure: its design hypothesis allowed unresolved
impasse or re-reading "price" as signal, and the critics separate along that
line.

### target-r02

The second target repeat completed under
`config/poetics-calibration/phase2-production-v1/target-r02/`.

Both arms are now cleanly scoreable after re-cleaning the generated reframe
traces against the current admission heuristics. The detector updates were for
ordinary public phrasing, not new generation: "acting like the work standard owns
rules" and "letting clear mean no salt / I will change it to ...".

| Critic | `none` | `reframe` |
|---|---:|---:|
| Qwen | 0 recognition / 6 flat | 6 recognition / 0 flat |
| Gemini | 0 recognition / 6 flat | 5 recognition / 1 flat |

Gemini's lone flat reframe row is D9/T10. Preserve that as target-repeat
variance rather than smoothing the repeat to a binary pass.

The repeat-2 controls completed under `control-r02/d4/` and
`control-r02/d10-emphatic/`:

| Control | Qwen | Gemini |
|---|---|---|
| D4 flat | flat | flat |
| D10 emphatic trap | trap | trap |

This gives target-r02 its own clean flat/trap bracket.
