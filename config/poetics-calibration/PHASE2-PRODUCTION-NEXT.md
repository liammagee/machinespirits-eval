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

## Tutor adaptation sidecar

The poetics sidecar now has a deterministic tutor-adaptation analyzer. It is not
a replacement for the recognitive/trap/flat critic labels. It now keeps two
adaptation questions apart:

1. **Peripeteia-triggered adaptive mechanism**: learner resistance, breakdown,
   false closure, or misfit creates reversal pressure; the tutor ego/superego
   exchange takes stock and invents a changed route, task, role, object,
   counterexample, interruption, evidence standard, social consequence,
   representation, affective register, or cognitive load.
2. **Recognition-contingent tutor uptake**: after a learner visibly reframes an
   earlier line, the next tutor turn takes up that revised framing. This is a
   useful closure/follow-through pattern, but it is secondary to the main
   adaptation mechanism.

Run it after ingesting a batch:

```bash
npm run poetics:adaptation -- --run-id <run-id> \
  --out exports/<run-id>-tutor-adaptation.json \
  --csv exports/<run-id>-tutor-adaptation.csv
```

The analyzer writes `poetics_tutor_adaptations` with legacy uptake columns plus
extended `metadata.peripeteia`:

- `metadata.peripeteia.learner_reversal_pressure`: the learner produces
  resistance, breakdown, false closure, contradiction, or misfit.
- `metadata.peripeteia.instrumented_pressure`: the tutor consumed a hidden
  reversal-pressure event from the bilateral trace. From `tutor-adaptation-v3`
  onward, this is counted only for policies that include `peripeteia`; routine
  negative-control pressure is not treated as instrumented peripeteia.
- `metadata.peripeteia.private_mechanism_route`: optional old-route-to-new-route
  declaration from the tutor ego/superego exchange, e.g.
  `ADAPTIVE_MECHANISM: graph label -> audit standard`.
- `metadata.peripeteia.tutor_strategy_reversal`: legacy field name for whether
  the following tutor turn visibly changes strategy by inventing an adaptive
  mechanism.
- `metadata.peripeteia.tutor_adaptive_mechanism`: alias for the same primary
  peripeteia-sidecar judgment, added so reports can use the clearer concept.
- `metadata.peripeteia.tutor_peripeteia_score`: heuristic 0-100 score for the
  pressure-to-reversal sequence.
- `metadata.peripeteia.learner_outcome_after_reversal`: next learner outcome
  bracket: recognition, trap/declared insight, maintained resistance, partial, or
  unknown.

The legacy uptake columns remain intentionally separate:

- `learner_self_reframe`: the learner revoices an earlier utterance, names the
  prior framing problem, and supplies a replacement framing.
- `tutor_contingent_adaptation`: the next tutor turn takes up the learner's
  revised framing through shared salient terms, explicit uptake, or a strategy
  shift.

This should be reported as sidecar audit evidence, not as ground truth. The
peripeteia sidecar asks whether adaptation happened before the learner's
recognition/trap/failure outcome. The uptake sidecar distinguishes scripts where
recognitive form is mostly learner-side from scripts where the tutor closes the
loop after the learner's reframe.

The next adaptation test can now be run as a four-arm paired design. The arms
separate the public learner reframe cue from tutor-private uptake pressure:

- `none`: no public reframe cue, no tutor uptake pressure.
- `reframe-only`: public learner reframe cue, no tutor uptake pressure.
- `tutor-uptake-only`: no public reframe cue, but the tutor receives an uptake
  contract; this should mostly be inert unless an organic learner reframe is
  detected.
- `reframe+tutor-uptake`: public learner reframe cue plus tutor-private uptake
  pressure on the next tutor turn.

For the remodeled adaptation hypothesis, add peripeteia arms:

- `peripeteia-only`: no public learner reframe cue, but tutor-private reversal
  pressure is available when the learner resists, breaks down, falsely closes, or
  exposes a misfit.
- `reframe+peripeteia`: public learner reframe cue plus both tutor-private
  reversal pressure and recognition-contingent uptake.

Pilot command:

```bash
CODEX_REASONING_EFFORT=high node scripts/run-poetics-production-batch.js \
  --batch-id phase2-tutor-adaptation-pilot-v1 \
  --repeats 1 \
  --stress-repeats 0 \
  --adaptation-arms \
  --only target-r01 \
  --critics qwen/qwen3.7-max,google/gemini-3.5-flash,anthropic/claude-sonnet-4.6
```

The generator stores hidden `learner_reframe_event` and
`learner_reversal_event` records in the full trace. Reframe events are passed
only when `tutor_adaptation_policy` includes `uptake`; reversal events are passed
only when it includes `peripeteia`. Public transcripts should show the resulting
tutor move, not the hidden event itself.

The dramatic-theory inheritance is structural rather than ornamental. The
director and tutor prompts can draw on Sophoclean/Aristotelian reversal and
recognition, Shakespearean scene-turns, Brechtian interruption, Miller-style
social pressure, and other didactic dramatic forms, but public dialogue should
remain in modern standard English idiom unless a spec explicitly asks otherwise.
The point is to produce novel mechanisms for learning breakthrough, not antique
pastiche or overt theory talk.

The underlying pedagogical bet is habit-breaking. We cannot literally retrain a
model tutor between scenes, but we can make each ego/superego exchange ask:
"What tutor habit is failing here?" Sometimes the failed habit may be cheery
informality, quick validation, or soft reassurance; sometimes it may be excessive
severity, abstraction, or procedural control. The dramatic repertoire gives the
tutor alternative mechanisms: a cooler register, a sharper public consequence, a
role turn, an interruption, a concrete object, a counterexample, or a silence
that makes the learner's resistance usable rather than smoothing it away.

**Update, 2026-05-24.** `tutor-adaptation-v3` tightens this mechanism in two
ways. First, reframe cues now use a three-slot public reframe object
(`earlier wording / what that old frame hid / replacement frame`) and the
misframing anchor selector prefers eligible anchors before downgrading to
reconsideration. Second, peripeteia prompts now require the tutor superego and
ego adjudication to name a mechanism route change privately while making the new
route visible in public speech. The detector may use that instrumented private
route as evidence only when a public mechanism is also visible.

The first seven-arm classic-drama routine pilot
(`phase2-classic-drama-routine-pilot-v1`) remains diagnostic, not a claim. Its
strict structural critic passed, but peripeteia-only did not separate cleanly
from routine/none; the reframe-bearing arms were strongest but had cue-quality
warnings. Treat it as the reason for the v3 changes, then rerun a small real
pilot before scaling.

Small v3 real pilot:

```bash
CODEX_REASONING_EFFORT=high node scripts/run-poetics-production-batch.js \
  --batch-id phase2-classic-drama-v3-smoke-v1 \
  --root-dir config/poetics-calibration/phase2-classic-drama-v3-smoke-v1 \
  --target-spec config/poetics-calibration/phase2-classic-drama-adaptation-v1.yaml \
  --target-only D35,D38 \
  --target-tid-start 35 \
  --repeats 1 \
  --stress-repeats 0 \
  --only target-r01 \
  --adaptation-arms \
  --generation-concurrency 2 \
  --structure-critic rules \
  --fail-on-structure-critic \
  --critics qwen/qwen3.7-max,google/gemini-3.5-flash,deepseek/deepseek-v4-pro \
  --force
```

Artifacts:

- Run root: `config/poetics-calibration/phase2-classic-drama-v3-smoke-v1`
- Sidecar report: `exports/phase2-classic-drama-v3-smoke-v1-report-v3.md`
- Tutor-adaptation sidecar:
  `exports/phase2-classic-drama-v3-smoke-v1-tutor-adaptation-v3.json`

Result reading:

- Generation produced 14 scripts (two scenarios times seven arms). The rules
  structural critic passed all arms, 2/2 per arm.
- Scoring coverage is complete: 42 critic rows after one DeepSeek retry.
- The stricter reframe cue is cleaner than the previous warning-heavy pilot:
  `reframe+peripeteia` produced learner self-reframes in 2/2 scripts;
  `reframe+tutor-uptake` also produced 2/2; `reframe-only` produced 1/2.
- Peripeteia-only remains only partly solved. D38 produced the desired
  tutor-private route change and a public release-gate mechanism; D35 stayed on
  the same visual-counting route. Current sidecar: instrumented pressure 1/2,
  private route 1/2, public habit-break 1/2 for `peripeteia-only`.
- The combined `reframe+peripeteia` arm exposed a new weakness: the tutor named
  private route changes in 2/2 scripts, but the public detector found 0/2
  visible habit-break mechanisms. This means private ego/superego compliance is
  not enough; the public turn must make the new learning device legible.
- DeepSeek is much more recognition-generous than Qwen/Gemini on this pilot.
  The sharpest disagreements are the two peripeteia-only scripts and D38 in
  tutor-uptake-only / reframe+tutor-uptake.

Reporting now separates ordinary learner pressure from instrumented peripeteia
pressure. The sidecar report includes learner pressure, instrumented pressure,
private route, and public habit-break columns, so routine/none arms with organic
dramatic pressure are not confused with policy-triggered peripeteia.

Before paying for external critic scoring, run the structural critic. This is a
quasi unit test, not an outcome label: it can use the same local generator family
(`codex` or `claude-code`) to check whether public transcripts are clean, modern
in idiom, structurally dramatic, and free of hidden ego/superego/director leaks.

```bash
node scripts/critic-poetics-structure.js \
  --critic codex \
  --sample-dir <sample-dir> \
  --key <key.yaml> \
  --out exports/<run-id>-structure-critic.json
```

The production runner can insert this as a pre-scoring stage:

```bash
CODEX_REASONING_EFFORT=high node scripts/run-poetics-production-batch.js \
  --batch-id phase2-classic-drama-adaptation-pilot-v1 \
  --root-dir config/poetics-calibration/phase2-classic-drama-adaptation-pilot-v1 \
  --target-spec config/poetics-calibration/phase2-classic-drama-adaptation-v1.yaml \
  --target-only D35,D36,D37,D38 \
  --target-tid-start 35 \
  --repeats 1 \
  --stress-repeats 0 \
  --only target-r01 \
  --adaptation-arms \
  --structure-critic codex \
  --critics qwen/qwen3.7-max,google/gemini-3.5-flash,deepseek/deepseek-v4-pro
```

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

Qwen `qwen/qwen3.5-plus-02-15` was attempted twice at concurrency 1 but stalled
on the first target score artifact without writing a partial result. The Qwen
retry therefore used `qwen/qwen3.7-max`: first as a one-item D4 probe, then as a
full target/control scoring pass at concurrency 1. DeepSeek completed the target
arms after a concurrency-1 retry, and a later D10 retry succeeded; DeepSeek now
reads the D10 boundary-control row as recognition rather than missing.

Genre-batch target result:

| Critic | `none` recognitions | `reframe` recognitions | `none` forms | `reframe` forms |
|---|---:|---:|---|---|
| Qwen 3.7 Max | 3/8 | 8/8 | R3 T1 F4 | R8 T0 F0 |
| Gemini 3.5 Flash | 1/8 | 6/8 | R1 T1 F6 | R6 T0 F2 |
| Sonnet 4.6 | 3/8 | 6/8 | R3 T0 F5 | R6 T0 F2 |
| DeepSeek | 4/8 | 4/8 | R4 T1 F3 | R4 T1 F3 |

Control result:

| Control | Role | Qwen 3.7 | Gemini | Sonnet 4.6 | DeepSeek |
|---|---|---|---|---|---|
| D4 | flat control | flat | flat | flat | flat |
| D10 | boundary trap | recognition | trap | trap | recognition |
| D25 | hard trap | trap | trap | flat | flat |
| D26 | hard trap | trap | trap | trap | trap |

Interpretation: genre variation makes the mechanism less clean, which is useful
rather than disappointing. Qwen 3.7, Gemini, and Sonnet show the intended
`none`/`reframe` separation; DeepSeek behaves as a weak separation critic on the
genre-diverse targets. D10 again behaves as a boundary control rather than a
hard trap: Qwen 3.7 and DeepSeek read it as recognition, while Gemini and Sonnet
read it as trap. The next audit target is therefore DeepSeek's uncued
recognitions and reframe misses by genre, and the D10/Qwen/DeepSeek boundary
read, not another aggregate-only run.

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

## Four-step operating split after genre audit

**Decision, 2026-05-24:** keep the clean effect-estimation and genre-stress
apparatuses separate.

1. `phase2-balanced-calibration-v1` is the clean paired-contrast template for
   estimating the Director reframe effect. It keeps a tighter scenario family
   and all three control roles travelling with the target arms.
2. `phase2-genre-calibration-v1` is the boundary/stress suite. It deliberately
   varies pedagogy and dialogue genre, and its value is in exposing where
   organic recognition leaks into `none` arms or where critics disagree.
3. Future paired `none` arms now carry an anti-reframe guard. The generator adds
   no-cue branch constraints telling tutor and learner not to quote, revisit,
   name a framing problem, say `reframe`, use `read it as`, or replace an
   earlier frame. The quality gate also flags `no_cue_reframe_leakage` when a
   no-cue learner turn visibly self-reframes anyway. These warnings should be
   treated as regenerate-or-boundary-suite cases before scoring.
4. Human labelling should start with disagreement cases only, as a perspective
   layer rather than an answer key. The browser supports a focused cross-run
   blind queue:

```text
http://127.0.0.1:3466/?runIds=phase2-balanced-calibration-v1,phase2-genre-calibration-v1&mode=label&queue=disagreements&unlabelled=1&labeller=<id>
```

This queue currently targets the 5 balanced disagreements plus the 13 genre
disagreements before any full-run human labelling. Once those are labelled,
rerun the sidecar report and compare human-browser labels against each critic as
another disagreement matrix, not as ground truth.

## Review flags, trap demarcation, and Sonnet pilot

**Update, 2026-05-24:** the browser now has a durable review-flag queue in the
poetics sidecar DB, separate from the computed disagreement queue. The new
`poetics_review_flags` table records `item_id`, `flagger_id`, `flag_type`,
priority, reason, metadata, and resolution status. This lets Codex or a human
editor mark cases for blind human review without turning critic disagreement
itself into a ground-truth label.

Flag the current cross-run disagreement cases:

```bash
npm run poetics:flag-review -- \
  --run-ids phase2-balanced-calibration-v1,phase2-genre-calibration-v1 \
  --flagger codex \
  --reason "critic disagreement selected for blind human perspective review"
```

Blind review queue:

```text
http://127.0.0.1:3466/?runIds=phase2-balanced-calibration-v1,phase2-genre-calibration-v1&mode=label&queue=review&unlabelled=1&labeller=<id>
```

The initial flag pass wrote 18 review flags: 5 from
`phase2-balanced-calibration-v1` and 13 from `phase2-genre-calibration-v1`.

Trap demarcation is now backed by
`config/poetics-calibration/trap-demarcation-signals.yaml`, a small design
database of false-settling signals: procedural compliance, impatient
resolution, confident summary, slogan transfer, and grade-seeking closure. The
D10, D25, and D26 trap specs now forbid the stock "Oh, I get it" / "I get it
now" signal and ask for varied premature closure instead. The production batch
default Qwen critic has also moved from `qwen/qwen3.5-plus-02-15` to
`qwen/qwen3.7-max`.

Public stage direction should vary more, not merely shrink. The generator now
treats stage direction as a positive style axis: bare transcript, compact scene
heading, object business, ambient pressure, placard/caption, thread metadata,
choric margin, or richer physical scene work. The quality gate still flags
`intrusive_stage_direction` when a stage line reads as a role instruction rather
than public scene material, and the default revisit cue now appears as an
earlier line returning to the table rather than as an explicit "the learner
must..." instruction. Re-cleaning can apply the current public-transcript
sanitizer and warning logic to already-generated traces without re-calling a
model. New keys also record `stage_direction_style_counts`, so batch review can
check whether stage form is actually varying.

Small Sonnet-only pilot:

```bash
CODEX_REASONING_EFFORT=high node scripts/run-poetics-production-batch.js \
  --batch-id phase2-sonnet-pilot-v1 \
  --root-dir config/poetics-calibration/phase2-sonnet-pilot-v1 \
  --target-spec config/poetics-calibration/phase2-genre-dramas-v1.yaml \
  --target-only D27,D31,D33 \
  --target-tid-start 40 \
  --repeats 1 \
  --stress-repeats 0 \
  --only target-r01,control-r01-d10-emphatic,control-r01-d25-hard-trap,control-r01-d26-hard-trap \
  --critics anthropic/claude-sonnet-4.6 \
  --score-concurrency 1 \
  --max-turns 3 \
  --force
```

After re-cleaning from the held-out traces and re-scoring the target arms, the
pilot summary is:

| Critic | `none` recognitions | `reframe` recognitions | Controls |
|---|---:|---:|---|
| Claude Sonnet 4.6 | 1/3 | 3/3 | D10 flat; D25 flat; D26 flat |

Interpretation: the revised stage-direction and trap-demarcation changes
removed the visible "Oh, I get it" crutch from this pilot and kept all three
trap controls out of recognition under Sonnet. But the controls are now flat
rather than trap, which means the false-settling signal may have become too
weak. The D31 no-cue target also crossed into recognition under Sonnet, showing
that some genres can produce organic tutor adaptation even without the explicit
reframe cue. That is not a failure to hide; it is exactly the mechanism boundary
this branch should map before it is promoted into the main evaluation harness.

## Structural critic and classic-drama adaptation pilot

**Update, 2026-05-24:** the production batch can now insert a cheap structural
critic before external scoring:

```bash
node scripts/critic-poetics-structure.js \
  --sample-dir <sample-dir> \
  --key <key.yaml> \
  --critic rules|codex|claude-code
```

The batch wrapper exposes the same stage through
`--structure-critic rules|codex|claude|claude-code`, with
`--fail-on-structure-critic` for future runs that should stop before paid
external scoring. This is a quasi unit test, not an outcome evaluator. It checks
formal compliance: labelled public turns, no hidden-process leakage, no named
theory exposition or archaic pastiche, action asides in square brackets, direct
quoted tutor/learner speech, and a visible dramatic pressure/turn. The model
critic asks the same local CLI family used for generation, while deterministic
rules catch cheap mechanical violations first.

The first classic-drama pilot used
`phase2-classic-drama-adaptation-pilot-v1` over D35-D38 with six arms:
`none`, `reframe-only`, `tutor-uptake-only`, `reframe+tutor-uptake`,
`peripeteia-only`, and `reframe+peripeteia`. Critics were
`qwen/qwen3.7-max`, `google/gemini-3.5-flash`, and
`deepseek/deepseek-v4-pro`.

Artifacts:

- Run root:
  `config/poetics-calibration/phase2-classic-drama-adaptation-pilot-v1`
- Sidecar report:
  `exports/phase2-classic-drama-adaptation-pilot-v1-report.md`
- Tutor-adaptation sidecar:
  `exports/phase2-classic-drama-adaptation-pilot-v1-tutor-adaptation.json`

Pilot reading:

- The structural critic was useful but exposed a formatting defect: generated
  learner turns were direct speech in the stage-play sense but not enclosed as
  quoted speech. Future generation now wraps public tutor/learner speech as
  quotes while keeping action asides in square brackets.
- The reframe-only arm was externally scored as recognition in all clean cases
  (3/3 across the three critics). The combined reframe arms had several
  `reframe_cue_not_reframed` quality skips, so those cells should be treated as
  exploratory, not evidence of a reliable effect.
- The peripeteia sidecar detects learner reversal pressure and tutor habit-break
  mechanisms in every arm, including `none`. That is informative but not yet a
  clean contrast: the classic-drama scene ecology is strong enough to elicit
  organic adaptation even without the explicit peripeteia policy. The next
  design needs a genuinely routine/nonadaptive arm, or a stricter peripeteia
  detector, before the pilot can estimate the marginal effect of the policy.

**Next design correction:** future `--adaptation-arms` runs now use a seven-arm
target set by adding `routine` ahead of `none`. `routine` is the true negative
control: it removes branch-level director pressure cues after the shared prefix
and asks the tutor ego/superego loop to preserve the established teaching route
under pressure. `none` remains an uncued but otherwise normal dramatic branch,
so it can still reveal organic adaptation.

The tutor-adaptation sidecar is also bumped to `tutor-adaptation-v2`. The v2
peripeteia detector still records learner reversal pressure, but it only counts
a tutor mechanism when the post-pressure tutor turn shows a route reset, changed
task/question, new evidence standard, representation/object move, role or
interruption device, social consequence, register shift, or cognitive-load
shift. Same-route continuation is capped below the mechanism threshold.

**Tightened D35/D38 smoke, 2026-05-25:** `phase2-classic-drama-v3-smoke-v3`
reran the focused D35/D38 batch with the seven adaptation arms and three
external critics (`qwen/qwen3.7-max`, `google/gemini-3.5-flash`,
`deepseek/deepseek-v4-pro`). The generator added a stricter peripeteia contract:
post-pressure tutor speech must include a public stock-taking contrast and a new
device, artifact, criterion, role, or standard. Quality gates were tightened for
replacement-standard reframes and relaxed for ordinary quoted speech that follows
leading bracketed action asides.

Artifacts:

- Run root:
  `config/poetics-calibration/phase2-classic-drama-v3-smoke-v3`
- Sidecar report:
  `exports/phase2-classic-drama-v3-smoke-v3-report-v3.md`
- Tutor-adaptation sidecar:
  `exports/phase2-classic-drama-v3-smoke-v3-tutor-adaptation-v3.json`

Result:

- Recleaned generation is clean: 14 scripts, 42 scored critic rows, no remaining
  scorer errors or quality skips. Rules structural critic passed all arms 2/2.
- The local peripeteia detector now cleanly separates `peripeteia-only`:
  instrumented pressure 2/2, private route 2/2, public habit-break 2/2, mean
  peripeteia score 93.8. The combined `reframe+peripeteia` arm also has 2/2
  instrumented/private/public route evidence, mean score 72.5.
- External recognition scoring is encouraging but not uniform. `peripeteia-only`
  is recognition 4/6 overall: Qwen 2/2, DeepSeek 2/2, Gemini 0/2.
  `reframe+peripeteia`, `reframe+tutor-uptake`, and `reframe-only` are all 6/6
  recognition across critics.
- The negative side is still imperfect. `routine` is 2/6 recognition and `none`
  is 3/6 recognition, driven mainly by D35 and DeepSeek/Qwen. D38 routine is
  flat across all three critics. D35 geometry remains an unstable control because
  the Socratic square task itself creates a natural reversal even without the
  explicit branch mechanism.

Interpretation: the tightened architecture now demonstrates the intended
peripeteia mechanism structurally: the tutor inner dialogue can force a public
habit-break without requiring a prior learner self-reframe. The next production
move should not be another prompt-only tightening pass; it should either replace
or explicitly tag high-organic-reversal negative controls like D35, and then run
a larger batch where peripeteia evidence, learner self-reframe, and external
recognition labels can be modeled separately.

**Control-boundary follow-up, 2026-05-25:** the D35 problem is now represented
explicitly in the target taxonomy instead of treated as an accidental failed
negative. `phase2-classic-drama-adaptation-v1.yaml` marks D35 as
`evaluation_role: organic_reversal_boundary`,
`baseline_control_class: organic_reversal`, and `organic_reversal_risk: high`.
Two replacement candidates were added:

- D39, a geometry scale-label scenario, marked low-risk by design but observed
  as medium-risk because Qwen read the fixed prefix as recognition.
- D40, a food-web-arrow scenario, marked low-risk by design and observed as
  low-risk in the smoke: no prefix, routine, or none recognitions across scored
  critics.

The sidecar now has a prefix-baseline extractor:

```bash
npm run poetics:prefix-baseline -- --root-dir <run-root> \
  --unit-id target-r01 \
  --source-arm routine \
  --arm prefix-baseline \
  --through-tutor-turn 2
```

This creates a pseudo-arm from the shared pre-branch transcript, then appends it
to `batch-plan.json` so ordinary ingest/report/browser tooling can include it.
The sidecar report now carries a `Baseline Risk` section and CSV fields for
`evaluation_role`, `baseline_control_class`, and `organic_reversal_risk`.

The old D35/D38 smoke (`phase2-classic-drama-v3-smoke-v3`) was retro-screened
with the prefix-baseline arm. It confirms the original diagnosis: D35 is high
organic reversal risk (prefix recognition 2/3, routine/none recognition 4/6),
while D38 is much cleaner (prefix 0/3, routine/none 1/6).

The new low-organic smoke is
`phase2-low-organic-control-smoke-v1`, generated over D35, D39, and D40 with the
seven adaptation arms plus a prefix-baseline arm and scored by Qwen 3.7 Max,
Gemini 3.5 Flash, and DeepSeek v4 Pro.

Artifacts:

- Run root:
  `config/poetics-calibration/phase2-low-organic-control-smoke-v1`
- Sidecar report:
  `exports/phase2-low-organic-control-smoke-v1-report.md`
- Tutor-adaptation sidecar:
  `exports/phase2-low-organic-control-smoke-v1-tutor-adaptation-v3.json`
- Browser:
  `http://127.0.0.1:3466/?runId=phase2-low-organic-control-smoke-v1`

Baseline-risk result:

| Drama | Intended role | Declared risk | Observed risk | Prefix recognition | Routine/none recognition |
|---|---|---:|---:|---:|---:|
| D35 | organic reversal boundary | high | high | 0/3 | 3/6 |
| D39 | replacement negative/control | low | medium | 1/3 | 0/6 |
| D40 | replacement negative/control | low | low | 0/3 | 0/6 |

Reading: D40 is the strongest clean negative/control candidate from this pass.
D39 is usable as a medium-risk boundary, but should not be the main negative
anchor unless its prefix is revised. D35 should remain in future runs only as a
boundary/stress probe, not as evidence that a routine arm is clean.

Recognition/adaptation result:

- Routine/none separation improves on the replacement controls: D39 and D40 are
  0/12 recognition across routine/none, while D35 remains 3/6.
- Reframe-bearing arms still create strong recognitive form among scored rows:
  `reframe-only` and `reframe+peripeteia` are 6/6 across critics after quality
  skips; `reframe+tutor-uptake` is 3/3 but only D35 survived the reframe-quality
  gates.
- Peripeteia-only is structurally present but not yet a reliable external
  recognition trigger on low-organic controls: Qwen sees 2/3 recognitions,
  Gemini sees 0/3, and DeepSeek sees 0/2 with one D35 no-content response.
- The tutor-adaptation sidecar sees `peripeteia-only` as a partial mechanism
  pass: instrumented pressure 2/3, private route 2/3, public habit-break 1/3,
  mean peripeteia score 60.5. That means the inner-dialogue route exists, but
  it is not yet public and forceful enough to produce consistent recognitive
  form without the learner reframe cue.

Caveats: the D40 generation used an unknown persona name in the target spec and
fell back to the default learner persona; the spec is now corrected to
`eager_explorer` for future runs, but the generated smoke artifact still records
the original requested persona. DeepSeek repeatedly returned no content for the
D35/T41 prefix-baseline and peripeteia-only rows; those missing responses are
kept as critic/runtime caveats rather than imputed labels.

Practical next move: scale a cleaner negative/control set around D40-like
scenarios, not D35-like scenarios. Add two or three more low-organic candidates
from non-Socratic domains, require prefix-baseline flatness before the paid
adaptation arms are interpreted, and keep D35/D39 as boundary probes. The
production question should be modeled as three separable variables:

1. organic reversal risk from the fixed prefix;
2. tutor-private peripeteia mechanism evidence;
3. external recognition/trap/flat form after the branch.

That lets the paper say what the remodeled architecture actually contributes:
not "adaptation always causes recognition," but "a tutor ego/superego exchange
can be forced to break a failed teaching habit, and this route becomes most
visible as recognitive form when the scenario is not already doing the reversal
by itself."

## Reporting rule

If the depth top-up or breadth slice changes the empirical interpretation, fold
the revised bounded claim into `docs/research/paper-full-2.0.md` before using it
in any spin-off, slide, or external summary.
