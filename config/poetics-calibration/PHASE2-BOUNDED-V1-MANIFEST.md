# Phase-2 bounded v1 batch manifest

**Status: diagnostic artifact manifest, 2026-05-22.**
This batch persists the first accepted D1/D3/D6 target comparison and its
bounded controls outside `/tmp`. It is a generator/scorer checkpoint, not a
paper claim.

## Target batch

Source spec: `config/poetics-calibration/phase2-dramas-v2.yaml`

Target scenarios: D1, D3, D6

Fixed-prefix policies: `none`, `revoice`, `reframe`

Artifacts:

- Public samples: `phase2-bounded-targets-v1/sample/<policy>/`
- Held-out deliberation: `phase2-bounded-targets-v1/deliberation/<policy>/`
- Held-out role transcripts: `phase2-bounded-targets-v1/transcripts/<policy>/`
- Held-out keys: `phase2-bounded-targets-v1/key-<policy>.yaml`

Generation command shape:

```bash
CODEX_REASONING_EFFORT=high node scripts/generate-pedagogical-dramas.js \
  --generator codex \
  --spec config/poetics-calibration/phase2-dramas-v2.yaml \
  --only D1,D3,D6 \
  --max-turns 3 \
  --paired-continuation-policies none,revoice,reframe \
  --director-revisit-anchor misframing-candidate \
  --out-dir config/poetics-calibration/phase2-bounded-targets-v1/sample \
  --delib-dir config/poetics-calibration/phase2-bounded-targets-v1/deliberation \
  --transcripts-dir config/poetics-calibration/phase2-bounded-targets-v1/transcripts \
  --key config/poetics-calibration/phase2-bounded-targets-v1/key.yaml \
  --force
```

Committed score artifacts:

- `phase2-bounded-targets-v1/scores/poetics-phase2-bounded-targets-v1-none-qwen.json`
- `phase2-bounded-targets-v1/scores/poetics-phase2-bounded-targets-v1-revoice-qwen.json`
- `phase2-bounded-targets-v1/scores/poetics-phase2-bounded-targets-v1-reframe-qwen.json`
- `phase2-bounded-targets-v1/scores/poetics-phase2-bounded-targets-v1-none-gemini.json`
- `phase2-bounded-targets-v1/scores/poetics-phase2-bounded-targets-v1-revoice-gemini.json`
- `phase2-bounded-targets-v1/scores/poetics-phase2-bounded-targets-v1-reframe-gemini.json`

Readout:

| Critic | `none` recognitions | `revoice` | `reframe` |
|---|---:|---:|---:|
| Qwen | 0/3 | 1/3 | 2/3 |
| Gemini | 0/3 | 0/3 | 2/3 |

## Control batch

D4 stays the flat control from `phase2-dramas-v2.yaml`. D10 is the provisional
trap replacement from `phase2-dramas-v3.yaml`.

Artifacts:

- D4: `phase2-bounded-controls-v1/d4/`
- Plain D10 draw: `phase2-bounded-controls-v1/d10/`
- Emphatic D10 draw after stronger premature-breakthrough voice pressure:
  `phase2-bounded-controls-v1/d10-emphatic/`

Committed score artifacts:

- `phase2-bounded-controls-v1/scores/poetics-phase2-bounded-controls-v1-d4-qwen.json`
- `phase2-bounded-controls-v1/scores/poetics-phase2-bounded-controls-v1-d4-gemini.json`
- `phase2-bounded-controls-v1/scores/poetics-phase2-bounded-controls-v1-d10-qwen.json`
- `phase2-bounded-controls-v1/scores/poetics-phase2-bounded-controls-v1-d10-gemini.json`
- `phase2-bounded-controls-v1/scores/poetics-phase2-bounded-controls-v1-d10-emphatic-qwen.json`
- `phase2-bounded-controls-v1/scores/poetics-phase2-bounded-controls-v1-d10-emphatic-gemini.json`

Readout:

| Control | Qwen | Gemini |
|---|---|---|
| D4 | flat | flat |
| D10 plain | flat | trap |
| D10 emphatic | trap | trap |

The plain D10 draw stays in the batch because it records the failed control
search honestly. The `d10-emphatic` draw is the current bounded trap control
candidate.

## Admission notes

The target generation initially wrote stale blocking warnings for two branches:
D3's revoice opening contained a quoted ellipsis, and D1 replaced its earlier
decimal framing with "the stronger start". Both public branches were judged
admissible after the detector learned those forms. `--reclean` refreshed the
held-out traces and keys from the current warning logic before scoring.

Gemini also returned malformed JSON twice on the math-heavy target `none` arm.
The shared poetics scorer parser now repairs raw LaTeX backslashes in model JSON
before failing; the retried `none` artifact is complete.
