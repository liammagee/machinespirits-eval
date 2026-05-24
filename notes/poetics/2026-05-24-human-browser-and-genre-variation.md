# Human Browser And Genre Variation

Date: 2026-05-24

## Aim

The current poetics browser already reads generated public scripts, held-out
full traces, critic scores, and sidecar labels. The next step is to make the same
browser usable for human scoring while preserving the paper's current decision:
human labels are another perspective, not ground truth.

The parallel generation problem is genre homogeneity. Earlier batches varied
topic and scene, but many scripts still shared a recognizable tutoring voice:
first/second person, in medias res learner openings, long reflective turns, and
American AI-tutor phrasing. The new mechanism needs reusable source material for
both pedagogy and dialogue.

## Design Commitments

1. Human browser scoring must be blind by default in scoring mode.
   - Hide critic scores.
   - Hide intended lean, condition, control role, and key-derived metadata.
   - Show only the public transcript and a compact form rubric.
   - Persist labels into `poetics_labels`, not `evaluation_results`.

2. Pedagogical approaches and dialogue approaches are separate databases.
   - Pedagogy controls teaching logic and learner relation.
   - Dialogue controls public form: turn length, stage directions, interruptions,
     object use, voice ecology, and speaker order.
   - A Director can combine one of each for a scene.

3. The databases are prompt repertoires, not labels.
   - They should shape authoring.
   - They should be held out from human scoring.
   - They can be inspected later through full trace/key metadata.

4. The new batch should be sidecar-only.
   - Keep these scripts in the poetics apparatus.
   - Do not promote them into the main `evaluation_results` table until the
     apparatus is explicitly promoted into a paper experiment.

## Files

- `config/poetics-calibration/pedagogical-approaches.yaml`
- `config/poetics-calibration/dialogue-approaches.yaml`
- `config/poetics-calibration/phase2-genre-dramas-v1.yaml`
- `scripts/browse-poetics-scripts.js`
- `scripts/generate-pedagogical-dramas.js`

## Generation Plan

The genre batch uses D27-D34. Each drama names:

- `pedagogical_approach`
- `dialogue_approach`
- existing tutor/learner profiles
- ordinary topic and learner start state
- a public learner voice constraint
- the intended dramatic shape

The generator loads both databases, attaches the selected approach records to
the drama object, and passes condensed approach guidance to the Director. The
Director then uses those materials to author the scene card and role constraints.

The paired target mechanism remains unchanged:

- shared prefix through tutor turn 2
- `none` arm without the look-back cue
- `reframe` arm with the visible learner look-back cue
- same poetics critic rubric
- same sidecar ingest/report/browser path

## Human Scoring Mode

Browser scoring mode should be opened with:

```bash
npm run poetics:browse -- --run-id <run-id> --port 3466 --no-open
```

Then visit:

```text
http://127.0.0.1:3466/?runId=<run-id>&mode=label&labeller=<labeller-id>
```

The mode writes one row per item into `poetics_labels` with:

- `perspective = human-browser`
- `label_file = browser:<runId>:<labellerId>`
- `form_class = recognition|trap|flat`
- optional pivot learner turn
- optional rationale

These rows are deliberately peer evidence beside model critics, not an answer
key.

## Implementation Notes

The browser now has a blind labelling mode:

- `GET /api/items?runId=<run-id>&blind=1` returns stripped item rows only:
  item id, blind display id, run id, transcript id, and label count.
- `GET /api/item?id=<item-id>&blind=1&labeller=<id>` returns public text only.
  It omits critic scores, held-out form, full trace, and metadata.
- `POST /api/labels` writes to `poetics_labels` with
  `perspective = human-browser` and
  `label_file = browser:<runId>:<labellerId>`.

The normal browser remains available for investigator use; blind mode is only a
scoring surface. This preserves the current methodological stance: human labels
are a structured perspective and can be compared with critic labels, but are not
treated as the ground-truth answer key.

## Genre Databases

Two prompt-source databases were added.

`pedagogical-approaches.yaml` separates teaching logic from dramatic form. It
currently covers:

- Socratic elenchus
- Bloom cognitive ladder
- Vygotsky ZPD scaffolding
- Montessori prepared environment
- Skinner behavioral feedback
- hidden curriculum
- didactic literature
- Brecht epic distanciation
- Hegelian recognition
- Dewey experience/inquiry
- Freire problem posing

`dialogue-approaches.yaml` separates public dialogue form from pedagogy. It
currently covers:

- Socratic short exchange
- plain transcript with no stage direction
- catechism/recitation
- Brechtian placard interruption
- online thread
- workshop clinic
- courtroom cross-examination
- Bakhtinian polyphony
- didactic fable
- Montessori observation
- seminar dispute

The generator attaches one pedagogical approach and one dialogue approach to a
drama spec. The Director receives condensed approach guidance when authoring
scene, tutor, and learner constraints. Human blind mode does not expose these
approach labels.

## Genre Batch Run

Run id: `phase2-genre-calibration-v1`

Artifact root:
`config/poetics-calibration/phase2-genre-calibration-v1/`

Target spec:
`config/poetics-calibration/phase2-genre-dramas-v1.yaml`

The batch generated eight target dramas, D27-D34, across varied pedagogy and
dialogue combinations:

| Drama | Pedagogical source | Dialogue source |
|---|---|---|
| D27 | Socratic elenchus | Socratic short exchange |
| D28 | Bloom cognitive ladder | seminar dispute |
| D29 | Vygotsky ZPD scaffolding | workshop clinic |
| D30 | Montessori prepared environment | Montessori observation |
| D31 | Skinner behavioral feedback | catechism/recitation |
| D32 | hidden curriculum | Bakhtinian polyphony |
| D33 | Brecht epic distanciation | Brechtian placard |
| D34 | Dewey experience/inquiry | online-thread / sparse-stage form |

Generation/scoring shape:

```bash
CODEX_REASONING_EFFORT=high node scripts/run-poetics-production-batch.js \
  --batch-id phase2-genre-calibration-v1 \
  --root-dir config/poetics-calibration/phase2-genre-calibration-v1 \
  --target-spec config/poetics-calibration/phase2-genre-dramas-v1.yaml \
  --target-only D27,D28,D29,D30,D31,D32,D33,D34 \
  --target-tid-start 26 \
  --repeats 1 \
  --stress-repeats 0 \
  --critics qwen/qwen3.5-plus-02-15,google/gemini-3.5-flash,anthropic/claude-sonnet-4.6,deepseek/deepseek-v4-pro \
  --max-turns 3 \
  --force
```

The initial reframe arm produced four quality-detector warnings. Qualitative
inspection showed valid genre-specific reframe forms rather than bad scripts:
hidden-curriculum phrasing about the sheet sounding like the judge, explicit
`Reframe:` replacement language, later learner turns naming a framing problem,
and Brechtian split-tag replacement. The detector was broadened with regression
coverage and the reframe key was re-cleaned to zero warnings before final
ingest.

Scoring status:

- Gemini 3.5 Flash, Claude Sonnet 4.6, and DeepSeek V4 Pro completed all target
  arms and controls.
- DeepSeek's failed target row was repaired by a concurrency-1 rescore.
- DeepSeek's D10 boundary-control row later succeeded on retry and now scores as
  recognition.
- Qwen `qwen/qwen3.5-plus-02-15` stalled twice on the first target artifact with
  no partial artifact.
- Qwen `qwen/qwen3.7-max` succeeded as the replacement Qwen critic. It first
  passed a one-item D4 probe, then completed the full target/control scoring
  pass at concurrency 1.

Sidecar ingest:

```bash
node scripts/ingest-poetics-artifacts.js \
  --root-dir config/poetics-calibration/phase2-genre-calibration-v1
```

Result: 20 items, 80 critic score rows, 0 human labels.

Generated reports:

- `exports/poetics-genre-calibration-v1-summary.md`
- `exports/poetics-genre-calibration-v1-summary.json`
- `exports/poetics-genre-calibration-v1-report.md`
- `exports/poetics-genre-calibration-v1-report.csv`
- `exports/poetics-genre-calibration-v1-report.json`

Target result:

| Critic | `none` recognitions | `reframe` recognitions | `none` forms | `reframe` forms |
|---|---:|---:|---|---|
| Qwen 3.7 Max | 3/8 | 8/8 | R3 T1 F4 | R8 T0 F0 |
| Gemini 3.5 Flash | 1/8 | 6/8 | R1 T1 F6 | R6 T0 F2 |
| Claude Sonnet 4.6 | 3/8 | 6/8 | R3 T0 F5 | R6 T0 F2 |
| DeepSeek V4 Pro | 4/8 | 4/8 | R4 T1 F3 | R4 T1 F3 |

Interpretation: the genre batch supports the broader mechanism for Qwen 3.7,
Gemini, and Sonnet, but it also exposes DeepSeek as a much less
separation-sensitive critic on this style-diverse target set. That is useful
calibration evidence rather than a reason to smooth the result. The next
qualitative audit should inspect DeepSeek's uncued recognitions and reframe
misses by genre, and compare those against Qwen's more permissive reframe
readings.

Control result:

| Control | Role | Qwen 3.7 | Gemini | Sonnet 4.6 | DeepSeek |
|---|---|---|---|---|---|
| D4 | flat control | flat | flat | flat | flat |
| D10 | boundary trap | recognition | trap | trap | recognition |
| D25 | hard trap | trap | trap | flat | flat |
| D26 | hard trap | trap | trap | trap | trap |

The controls are no longer simple pass/fail checks. They are bracket probes:
D4 remains the stable flat bracket, D10 is a boundary trap, and D25/D26 are
harder insight-costume probes that still show critic variance.

## Browser URLs

Normal investigator browser:

```text
http://127.0.0.1:3466/?runId=phase2-genre-calibration-v1
```

Blind human-scoring mode:

```text
http://127.0.0.1:3466/?runId=phase2-genre-calibration-v1&mode=label&labeller=liam
```

## Stage Direction Correction

Follow-up correction: the stage-direction problem is not mainly that directions
are too frequent or too intrusive. The deeper problem is sameness. Stage
direction should be a positive form-variation axis, while still avoiding public
role instructions or hidden-process leakage.

The generator now distinguishes:

- bare transcript
- compact scene heading
- object business
- ambient pressure
- placard/caption
- thread metadata
- choric margin
- richer physical scene work

Held-out keys now record `stage_direction_style` per item and aggregate
`stage_direction_style_counts`, so a batch can be checked for public-form
variety before scoring.
