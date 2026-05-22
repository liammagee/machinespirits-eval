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
