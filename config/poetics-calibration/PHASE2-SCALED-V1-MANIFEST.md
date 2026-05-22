# Phase-2 scaled v1 manifest

**Status: diagnostic scaled target-variety manifest, 2026-05-22.**
This batch broadens the bounded mechanism check from D1/D3/D6 to six v3 target
setups before adding many repeat draws.

## Target batch

Source spec: `config/poetics-calibration/phase2-dramas-v3.yaml`

Target scenarios: D7, D9, D11, D14, D17, D18

Target disciplines: chemistry, statistics, linguistics, ecology, geology, law

Fixed-prefix policies: `none`, `reframe`

T-id handling: `--tid-start 6` preserves the v3 T07-T18 map.

Artifacts:

- Public samples: `phase2-scaled-targets-v1/sample/<policy>/`
- Held-out deliberation: `phase2-scaled-targets-v1/deliberation/<policy>/`
- Held-out role transcripts: `phase2-scaled-targets-v1/transcripts/<policy>/`
- Held-out keys: `phase2-scaled-targets-v1/key-<policy>.yaml`
- Committed scores: `phase2-scaled-targets-v1/scores/`

Generation command:

```bash
CODEX_REASONING_EFFORT=high node scripts/generate-pedagogical-dramas.js \
  --generator codex \
  --spec config/poetics-calibration/phase2-dramas-v3.yaml \
  --tid-start 6 \
  --only D7,D9,D11,D14,D17,D18 \
  --max-turns 3 \
  --paired-continuation-policies none,reframe \
  --director-revisit-anchor misframing-candidate \
  --out-dir config/poetics-calibration/phase2-scaled-targets-v1/sample \
  --delib-dir config/poetics-calibration/phase2-scaled-targets-v1/deliberation \
  --transcripts-dir config/poetics-calibration/phase2-scaled-targets-v1/transcripts \
  --key config/poetics-calibration/phase2-scaled-targets-v1/key.yaml \
  --force
```

The first broad attempt stopped on a D17 Codex tutor-ego timeout after also
showing that D11/D9 needed stronger public self-framing markers for the reframe
anchor gate. The committed artifact set is the successful retry after target
voice constraints were tightened and current admission warnings were refreshed.

Readout:

| Critic | `none` recognitions | `reframe` recognitions |
|---|---:|---:|
| Qwen | 0/6 | 6/6 |
| Gemini | 0/6 | 6/6 |

## Control batch

Artifacts:

- D4 flat control: `phase2-scaled-controls-v1/d4/`
- D10 emphatic trap control: `phase2-scaled-controls-v1/d10-emphatic/`
- Committed scores: `phase2-scaled-controls-v1/scores/`

Readout:

| Control | Qwen | Gemini |
|---|---|---|
| D4 | flat | flat |
| D10 emphatic | trap | trap |

## Decision

The bounded none-versus-reframe decision holds on six new v3 targets with
explicit controls. The next expansion should stress the remaining v3
flat/trap/impasse setups before calling this a broad production mechanism.
