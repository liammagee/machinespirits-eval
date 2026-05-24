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

**Completed, 2026-05-23.** Repeats r02 and r03 were generated with Codex using
stable `director_variation_key` values per unit, then scored by Qwen
`qwen/qwen3.5-plus-02-15`, Gemini `google/gemini-3.5-flash`, and third critic
DeepSeek `deepseek/deepseek-v4-pro`.

Two D21/T22 reframe branches initially tripped blocking quality warnings. Both
public transcripts were valid ordinary reframe forms rather than invalid
transcripts: one named the mistake as the chart leaning from aggregate evidence
onto a person, and the other used a later learner turn to replace the table as a
clipboard label with the table as a prompt for careful questioning. The detector
was extended with regression coverage for those forms, then both reframe keys
were re-cleaned to zero warnings and rescored at full N.

Breadth-v2 three-repeat target result:

| Critic | `none` recognitions | `reframe` recognitions |
|---|---:|---:|
| Qwen | 1/18 | 17/18 |
| Gemini | 0/18 | 13/18 |
| DeepSeek | 6/18 | 14/18 |

Form counts:

| Critic | `none` forms | `reframe` forms |
|---|---|---|
| Qwen | R1 T3 F14 | R17 T0 F1 |
| Gemini | R0 T2 F16 | R13 T0 F5 |
| DeepSeek | R6 T0 F12 | R14 T0 F4 |

Control result: D4 remains flat for all three critics in all three repeats.
D10 emphatic is trap for all three critics in r01, remains trap for Gemini in
r02/r03, and is read as recognition by Qwen and DeepSeek in r02/r03. Treat this
as a critic-sensitive control boundary: the target contrast transfers across
the new scenario family, but emphatic-trap controls can cross into recognition
for some critics when the public sample contains enough later re-reading
structure.

**Follow-up completed, 2026-05-23.** A control-only Sonnet 4.6 spot-check
strengthens the boundary reading rather than resolving it away. Sonnet reads
production-v2 D10 as trap in r01, recognition in r02, and trap in r03. The
control taxonomy is therefore now explicit:

| Control role | Scenario | Status |
|---|---|---|
| `flat_control` | D4 | stable flat bracket |
| `boundary_trap_control` | D10 emphatic | critic-sensitive boundary; not a hard trap |
| `hard_trap_control` | D25, D26 | strict insight-costume controls |

The strict-control slice lives under
`config/poetics-calibration/phase2-hard-trap-controls-v1/`. The first repeat
confirmed both D25 and D26 as traps for Qwen, Gemini, Sonnet, and DeepSeek. The
second repeat sharpened the caveat: Qwen, Gemini, and Sonnet again score both as
traps, while DeepSeek reads both r02 draws as recognition. This makes D25/D26
stronger brackets than D10, but not model-proof ground truth.

| Repeat | Control | Qwen | Gemini | Sonnet | DeepSeek |
|---|---|---|---|---|---|
| r01 | D25 | trap | trap | trap | trap |
| r01 | D26 | trap | trap | trap | trap |
| r02 | D25 | trap | trap | trap | recognition |
| r02 | D26 | trap | trap | trap | recognition |

These controls should travel with future target batches so D10 can remain a
useful boundary probe without being asked to do the harder bracketing job. The
r02 DeepSeek disagreements should be treated as the first cases to inspect when
human or non-ground-truth perspectives are added later.

Step 2's "limited yes" has also been implemented as sidecar persistence rather
than main-harness promotion. `scripts/ingest-poetics-artifacts.js` writes
`poetics_runs`, `poetics_items`, `poetics_scores`, and `poetics_labels` into the
same SQLite DB while leaving `evaluation_results` untouched. The current local
DB has ingested production-v1, production-v2, and the strict-control slice
(4 items, 16 critic scores).

## Operational tooling added

Use the sidecar path for calibration reporting and inspection:

```bash
npm run poetics:ingest -- --root-dir config/poetics-calibration/<artifact-root>
npm run poetics:report -- --run-id <run-id>
npm run poetics:audit -- --run-id phase2-hard-trap-controls-v1
npm run poetics:browse -- --run-id <run-id>
```

`poetics:report` emits stable Markdown and CSV summaries from
`poetics_runs/items/scores/labels`: target separation, control stability, critic
disagreement, and label counts. `poetics:audit` is deterministic; it surfaces
public text and critic evidence for disagreement cases without asking another
model to adjudicate. `poetics:browse` starts a local script browser over the
sidecar DB so public samples, full traces, scores, and labels-as-perspective can
be inspected from one place.

The one-off `drama:generate` front door now accepts `--answers <yaml|json>` and
`--write-template <file>`. It also writes a sidecar-compatible `batch-plan.json`,
so generated single scripts can be ingested and browsed with the same tooling.

## Balanced calibration batch

**Completed, 2026-05-24.** A balanced non-human calibration batch now lives under
`config/poetics-calibration/phase2-balanced-calibration-v1/`. It uses the v2
breadth target family (D19-D24), paired `none`/`reframe` continuations, and all
three control roles travelling in the same run: D4 flat, D10 boundary trap, and
D25/D26 hard traps. The run is scored by Qwen, Gemini, Sonnet 4.6, and DeepSeek.

Reproduce generation/scoring shape with:

```bash
CODEX_REASONING_EFFORT=high node scripts/run-poetics-production-batch.js \
  --batch-id phase2-balanced-calibration-v1 \
  --root-dir config/poetics-calibration/phase2-balanced-calibration-v1 \
  --target-spec config/poetics-calibration/phase2-dramas-v4.yaml \
  --target-only D19,D20,D21,D22,D23,D24 \
  --target-tid-start 18 \
  --repeats 1 \
  --stress-repeats 0 \
  --critics qwen/qwen3.5-plus-02-15,google/gemini-3.5-flash,anthropic/claude-sonnet-4.6,deepseek/deepseek-v4-pro \
  --max-turns 3
```

If a provider stalls mid-score, resume without overwriting completed score files:

```bash
node scripts/run-poetics-production-batch.js \
  --batch-id phase2-balanced-calibration-v1 \
  --root-dir config/poetics-calibration/phase2-balanced-calibration-v1 \
  --target-spec config/poetics-calibration/phase2-dramas-v4.yaml \
  --target-only D19,D20,D21,D22,D23,D24 \
  --target-tid-start 18 \
  --repeats 1 \
  --stress-repeats 0 \
  --skip-generate \
  --skip-existing-scores \
  --critics <critic-list>
```

Two target reframe keys (T21/D20 and T22/D21) initially tripped the quality
detector. Inspection showed valid public reframe forms rather than invalid
transcripts: `The new check is ...` and `I’d change it to ...`. The detector was
broadened with regression tests and the reframe key was re-cleaned to zero
warnings before scoring.

Balanced target result:

| Critic | `none` recognitions | `reframe` recognitions | `none` forms | `reframe` forms |
|---|---:|---:|---|---|
| Qwen | 1/6 | 6/6 | R1 T0 F5 | R6 T0 F0 |
| Gemini | 1/6 | 6/6 | R1 T0 F5 | R6 T0 F0 |
| Sonnet 4.6 | 0/6 | 5/6 | R0 T0 F6 | R5 T0 F1 |
| DeepSeek | 1/6 | 3/6 | R1 T0 F5 | R3 T1 F2 |

Balanced control result:

| Control | Qwen | Gemini | Sonnet 4.6 | DeepSeek |
|---|---|---|---|---|
| D4 flat | flat | flat | flat | flat |
| D10 boundary trap | trap | trap | trap | trap |
| D25 hard trap | trap | trap | trap | trap |
| D26 hard trap | trap | trap | trap | trap |

Interpretation: the balanced batch strengthens the control story. In this draw,
all three control roles behave as intended for all four critics. The target
contrast remains strong for Qwen/Gemini/Sonnet and directionally positive but
weaker for DeepSeek. DeepSeek is therefore not only a permissive boundary critic
on hard-trap r02; it is also a stricter recognitive-form critic for some target
reframe scripts. Treat those DeepSeek reframe misses as the next qualitative
audit targets before scaling again.

Sidecar status: `phase2-balanced-calibration-v1` has been ingested locally as 16
items and 64 critic scores. Generated summaries:
`exports/poetics-balanced-calibration-v1-summary.md`,
`exports/poetics-balanced-calibration-v1-report.md`, and
`exports/poetics-balanced-calibration-v1-disagreement-audit.md`.

The updated bounded claim has been folded into
`docs/research/paper-full-2.0.md` §7.9 as v3.0.97-v3.0.100. The remaining
promotion decision is narrower now: keep this as calibration apparatus with
sidecar persistence, or design a separate formal poetics experiment. It still
should not be folded into `evaluation_results`.

## Genre variation and blind browser scoring

**Completed, 2026-05-24.** A genre-diversity calibration batch now lives under
`config/poetics-calibration/phase2-genre-calibration-v1/`. This is a sidecar
calibration run, not a main-harness evaluation. It was designed to address the
earlier problem that target scripts shared too much voice, speaker order,
American tutoring register, stage-direction style, and first/second-person
reflective tone.

Two source databases now feed the Director:

- `config/poetics-calibration/pedagogical-approaches.yaml`
- `config/poetics-calibration/dialogue-approaches.yaml`

The first database describes teaching logics: Socratic elenchus, Bloom,
Vygotsky, Montessori, Skinner, hidden curriculum, didactic literature, Brecht,
Hegelian recognition, Dewey, and Freire. The second describes public dialogue
forms: short Socratic exchange, plain transcript without stage direction,
catechism, Brechtian placards, online thread, workshop clinic, courtroom
cross-examination, Bakhtinian polyphony, didactic fable, Montessori observation,
and seminar dispute. The Director receives one approach from each database when
authoring scene, tutor, and learner constraints.

Run shape:

```bash
CODEX_REASONING_EFFORT=high node scripts/run-poetics-production-batch.js \
  --batch-id phase2-genre-calibration-v1 \
  --root-dir config/poetics-calibration/phase2-genre-calibration-v1 \
  --target-spec config/poetics-calibration/phase2-genre-dramas-v1.yaml \
  --target-only D27,D28,D29,D30,D31,D32,D33,D34 \
  --target-tid-start 26 \
  --repeats 1 \
  --stress-repeats 0 \
  --critics google/gemini-3.5-flash,anthropic/claude-sonnet-4.6,deepseek/deepseek-v4-pro \
  --max-turns 3
```

Qwen `qwen/qwen3.5-plus-02-15` was attempted separately at concurrency 1 but
stalled on the first target score artifact without writing a partial result, so
it is excluded from the completed report. DeepSeek completed the target arms
after a concurrency-1 retry, but still returned empty content for the D10
boundary control; that row is recorded as missing rather than converted into a
form label.

Genre-batch target result:

| Critic | `none` recognitions | `reframe` recognitions | `none` forms | `reframe` forms |
|---|---:|---:|---|---|
| Gemini 3.5 Flash | 1/8 | 6/8 | R1 T1 F6 | R6 T0 F2 |
| Sonnet 4.6 | 3/8 | 6/8 | R3 T0 F5 | R6 T0 F2 |
| DeepSeek | 4/8 | 4/8 | R4 T1 F3 | R4 T1 F3 |

Control result:

| Control | Role | Gemini | Sonnet 4.6 | DeepSeek |
|---|---|---|---|---|
| D4 | flat control | flat | flat | flat |
| D10 | boundary trap | trap | trap | missing |
| D25 | hard trap | trap | flat | flat |
| D26 | hard trap | trap | trap | trap |

Interpretation: genre variation makes the mechanism less clean, which is useful
rather than disappointing. Gemini and Sonnet still show the intended
`none`/`reframe` separation; DeepSeek behaves as a weak separation critic on the
genre-diverse targets. The next audit target is therefore DeepSeek's uncued
recognitions and reframe misses by genre, not another aggregate-only run.

The browser now supports blind human-scoring mode:

```bash
npm run poetics:browse -- --run-id phase2-genre-calibration-v1 --port 3466 --no-open
```

Normal investigator view:

```text
http://127.0.0.1:3466/?runId=phase2-genre-calibration-v1
```

Blind scoring view:

```text
http://127.0.0.1:3466/?runId=phase2-genre-calibration-v1&mode=label&labeller=<id>
```

Blind mode hides critic scores, held-out keys, intended lean, control role, full
trace, and metadata. It writes to `poetics_labels` with
`perspective = human-browser`, preserving the rule that human labels are another
perspective rather than a ground-truth authority.

## Reporting rule

If the depth top-up or breadth slice changes the empirical interpretation, fold
the revised bounded claim into `docs/research/paper-full-2.0.md` before using it
in any spin-off, slide, or external summary.
