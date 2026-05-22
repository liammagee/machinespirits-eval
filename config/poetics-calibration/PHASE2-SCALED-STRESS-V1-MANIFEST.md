# Phase-2 scaled stress v1 manifest

**Status: diagnostic scaled stress manifest, 2026-05-22.**
This batch exercises the remaining v3 uncued stress setups after the scaled
target-variety batch showed a clean `none` versus `reframe` split.

## Stress batch

Source spec: `config/poetics-calibration/phase2-dramas-v3.yaml`

Stress scenarios: D8, D12, D13, D15, D16

Stress disciplines: economics, computer science, astronomy, art history,
psychology

Director revisit policy: `none`

T-id handling: `--tid-start 6` preserves the v3 T07-T18 map.

Artifacts:

- Public samples: `phase2-scaled-stress-v1/sample/`
- Held-out deliberation: `phase2-scaled-stress-v1/deliberation/`
- Held-out role transcripts: `phase2-scaled-stress-v1/transcripts/`
- Held-out key: `phase2-scaled-stress-v1/key.yaml`
- Committed scores: `phase2-scaled-stress-v1/scores/`

Generation command:

```bash
CODEX_REASONING_EFFORT=high node scripts/generate-pedagogical-dramas.js \
  --generator codex \
  --spec config/poetics-calibration/phase2-dramas-v3.yaml \
  --tid-start 6 \
  --only D8,D12,D13,D15,D16 \
  --max-turns 3 \
  --out-dir config/poetics-calibration/phase2-scaled-stress-v1/sample \
  --delib-dir config/poetics-calibration/phase2-scaled-stress-v1/deliberation \
  --transcripts-dir config/poetics-calibration/phase2-scaled-stress-v1/transcripts \
  --key config/poetics-calibration/phase2-scaled-stress-v1/key.yaml \
  --force
```

Scoring command shape:

```bash
node scripts/score-poetics-phase2.js \
  --model qwen/qwen3.5-plus-02-15 \
  --sample-dir config/poetics-calibration/phase2-scaled-stress-v1/sample \
  --key config/poetics-calibration/phase2-scaled-stress-v1/key.yaml \
  --out exports/poetics-phase2-scaled-stress-v1-qwen.json
```

Repeat the same command with `google/gemini-3.5-flash` for the second critic.

Readout:

| Scenario | Intended stress role | Qwen | Gemini |
|---|---|---|---|
| D8/T07 | impasse | flat | flat |
| D13/T09 | sticky flat | flat | flat |
| D15/T11 | impasse | flat | flat |
| D12/T15 | ordinary flat | flat | flat |
| D16/T17 | costume trap | trap | trap |

## Decision

The remaining uncued v3 stress slice stays separated across both critics: no
recognition leaks out of impasse or flat stress material, and the D16 costume
trap remains a trap without a revisit cue. The next scale decision is whether to
repeat the six new reframe targets first or add another positive target slice
before repeats grow.
