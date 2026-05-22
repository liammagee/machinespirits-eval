# Phase-2 scaled v2 manifest

**Status: diagnostic scaled target repeat manifest, 2026-05-22.**
This batch repeats the six-target v3 `none` versus `reframe` comparison from
`PHASE2-SCALED-V1-MANIFEST.md` after the remaining v3 uncued stress slice was
recorded in `PHASE2-SCALED-STRESS-V1-MANIFEST.md`.

## Target repeat

Source spec: `config/poetics-calibration/phase2-dramas-v3.yaml`

Target scenarios: D7, D9, D11, D14, D17, D18

Target disciplines: chemistry, statistics, linguistics, ecology, geology, law

Fixed-prefix policies: `none`, `reframe`

T-id handling: `--tid-start 6` preserves the v3 T07-T18 map.

Artifacts:

- Public samples: `phase2-scaled-targets-v2/sample/<policy>/`
- Held-out deliberation: `phase2-scaled-targets-v2/deliberation/<policy>/`
- Held-out role transcripts: `phase2-scaled-targets-v2/transcripts/<policy>/`
- Held-out keys: `phase2-scaled-targets-v2/key-<policy>.yaml`
- Committed scores: `phase2-scaled-targets-v2/scores/`

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
  --out-dir config/poetics-calibration/phase2-scaled-targets-v2/sample \
  --delib-dir config/poetics-calibration/phase2-scaled-targets-v2/deliberation \
  --transcripts-dir config/poetics-calibration/phase2-scaled-targets-v2/transcripts \
  --key config/poetics-calibration/phase2-scaled-targets-v2/key.yaml \
  --force
```

The first post-generation quality pass flagged all six `reframe` branches for
missing public reframe consequences. Inspection showed the repeat had produced
valid but ordinary forms the admission detector did not yet know, including
corrections counting as rules, sudden-event-first wording, fact-like legal
framing, deer-count stopping points, visibility versus balance, and significance
being "too quick". Those forms now have regression tests, and the held-out
`reframe` traces were revalidated with:

```bash
node scripts/generate-pedagogical-dramas.js \
  --reclean \
  --delib-dir config/poetics-calibration/phase2-scaled-targets-v2/deliberation/reframe \
  --out-dir config/poetics-calibration/phase2-scaled-targets-v2/sample/reframe \
  --transcripts-dir config/poetics-calibration/phase2-scaled-targets-v2/transcripts/reframe \
  --key config/poetics-calibration/phase2-scaled-targets-v2/key-reframe.yaml
```

Readout:

| Critic | `none` recognitions | `reframe` recognitions |
|---|---:|---:|
| Qwen | 1/6 | 6/6 |
| Gemini | 1/6 | 4/6 |

The shared uncued recognition is D11/T08. Its learner moves from "outside the
rules" to a repeated-versus-right-now dialect pattern without a Director revisit
cue, so this is substantive repeat variance rather than a branch-label error.
Gemini leaves the compressed D9/T10 statistics and incremental D14/T16 ecology
reframe branches flat; Qwen reads both as recognitive.

## Fresh controls

Artifacts:

- D4 flat control: `phase2-scaled-controls-v2/d4/`
- D10 emphatic trap control: `phase2-scaled-controls-v2/d10-emphatic/`
- Committed scores: `phase2-scaled-controls-v2/scores/`

Generation commands:

```bash
CODEX_REASONING_EFFORT=high node scripts/generate-pedagogical-dramas.js \
  --generator codex \
  --spec config/poetics-calibration/phase2-dramas-v2.yaml \
  --only D4 \
  --max-turns 3 \
  --out-dir config/poetics-calibration/phase2-scaled-controls-v2/d4/sample \
  --delib-dir config/poetics-calibration/phase2-scaled-controls-v2/d4/deliberation \
  --transcripts-dir config/poetics-calibration/phase2-scaled-controls-v2/d4/transcripts \
  --key config/poetics-calibration/phase2-scaled-controls-v2/d4/key.yaml \
  --force
```

```bash
CODEX_REASONING_EFFORT=high node scripts/generate-pedagogical-dramas.js \
  --generator codex \
  --spec config/poetics-calibration/phase2-dramas-v3.yaml \
  --tid-start 6 \
  --only D10 \
  --max-turns 3 \
  --out-dir config/poetics-calibration/phase2-scaled-controls-v2/d10-emphatic/sample \
  --delib-dir config/poetics-calibration/phase2-scaled-controls-v2/d10-emphatic/deliberation \
  --transcripts-dir config/poetics-calibration/phase2-scaled-controls-v2/d10-emphatic/transcripts \
  --key config/poetics-calibration/phase2-scaled-controls-v2/d10-emphatic/key.yaml \
  --force
```

Readout:

| Control | Qwen | Gemini |
|---|---|---|
| D4/T01 | flat | flat |
| D10/T14 emphatic | trap | trap |

## Decision

The repeat keeps a positive `reframe` advantage, but v1's perfect cross-critic
separation does not repeat exactly. The next scale step should preserve this
variance and decide whether to run another repeat with fresh adjacent controls or
promote the current artifact set into a larger pre-specified batch with repeat
draws built in.
