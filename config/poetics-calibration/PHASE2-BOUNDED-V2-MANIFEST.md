# Phase-2 bounded v2 repeat manifest

**Status: diagnostic repeat manifest, 2026-05-22.**
This repeat narrows the target branch comparison to `none` versus `reframe` and
rechecks the flat/trap controls from bounded v1.

## Target repeat

Source spec: `config/poetics-calibration/phase2-dramas-v2.yaml`

Scenarios: D1, D3, D6

Fixed-prefix policies: `none`, `reframe`

Artifacts:

- Public samples: `phase2-bounded-targets-v2/sample/<policy>/`
- Held-out deliberation: `phase2-bounded-targets-v2/deliberation/<policy>/`
- Held-out role transcripts: `phase2-bounded-targets-v2/transcripts/<policy>/`
- Held-out keys: `phase2-bounded-targets-v2/key-<policy>.yaml`
- Committed scores: `phase2-bounded-targets-v2/scores/`

Generation command:

```bash
CODEX_REASONING_EFFORT=high node scripts/generate-pedagogical-dramas.js \
  --generator codex \
  --spec config/poetics-calibration/phase2-dramas-v2.yaml \
  --only D1,D3,D6 \
  --max-turns 3 \
  --paired-continuation-policies none,reframe \
  --director-revisit-anchor misframing-candidate \
  --out-dir config/poetics-calibration/phase2-bounded-targets-v2/sample \
  --delib-dir config/poetics-calibration/phase2-bounded-targets-v2/deliberation \
  --transcripts-dir config/poetics-calibration/phase2-bounded-targets-v2/transcripts \
  --key config/poetics-calibration/phase2-bounded-targets-v2/key.yaml \
  --force
```

Readout:

| Critic | `none` D6/D3/D1 | `reframe` D6/D3/D1 |
|---|---|---|
| Qwen | trap, flat, flat | recognition, recognition, recognition |
| Gemini | trap, flat, flat | recognition, recognition, recognition |

The target negative condition is therefore non-recognitive on this repeat, but
not uniformly flat: the uncued D6 draw is a trap for both critics.

## Control repeat

Artifacts:

- D4 flat control: `phase2-bounded-controls-v2/d4/`
- D10 emphatic trap control: `phase2-bounded-controls-v2/d10-emphatic/`
- Committed scores: `phase2-bounded-controls-v2/scores/`

Readout:

| Control | Qwen | Gemini |
|---|---|---|
| D4 | flat | flat |
| D10 emphatic | trap | trap |

## Decision

Bounded v1 and v2 now support the next scaled generator path:

1. Scale `none` versus `reframe` first.
2. Keep `revoice` as an exploratory weaker arm instead of requiring it in the
   first scaled batch.
3. Carry explicit flat and trap controls in the scored batch, because the uncued
   target arm is a no-revisit baseline, not a guaranteed flat-form control.
