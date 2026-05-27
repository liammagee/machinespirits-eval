# Stratified Adaptation Pilot

Date: 2026-05-26

## Purpose

The clean-anchor replication run deliberately concentrated on D42/D50/D53:
material-led Montessori/workshop scenes with terse card, tile, or label
mechanisms. That made the negative/control side cleaner, but it also narrowed the
dramatic palette. The next pilot should test whether tutor adaptation survives
outside that material-object family.

## First Stratified Slice

Use `config/poetics-calibration/phase2-classic-drama-adaptation-v1.yaml` and run
one target unit over six scenarios:

| Stratum | Scenario | Pedagogy | Dialogue |
|---|---|---|---|
| Brecht/directorial interruption | D37 | `brecht_epic_distanciation` | `brechtian_placard` |
| Dewey/social consequence | D38 | `dewey_experience_inquiry` | `miller_social_reckoning` |
| Socratic/discursive low-organic | D39 | `socratic_elenchus` | `aristotelian_reversal` |
| Vygotskian scaffold/workshop | D40 | `vygotsky_zpd_scaffolding` | `workshop_clinic` |
| Montessori/material anchor | D42 | `montessori_prepared_environment` | `montessori_observation` |
| Bloom/plain transcript | D45 | `bloom_cognitive_ladder` | `no_stage_plain_transcript` |

Run only the paired adaptation arms needed for a first contrast:

- `routine`: competent continuation without dramatic pressure.
- `none`: no explicit tutor adaptation.
- `peripeteia-only`: tutor adaptation triggered by reversal pressure, without an
  explicit learner self-reframe cue.

## Mixed CLI Authorship

Use a side-symmetric role map so ego/superego pairs stay together:

```bash
--role-map 'director=claude,tutor=codex,learner=claude'
```

This keeps tutor ego and tutor superego on the same backend, and learner ego and
learner superego on the same backend. It also spreads generation work across
Codex and Claude CLI while preserving the bilateral architecture. Future mixed
runs should pin Claude to Opus:

```bash
--claude-model opus
```

## Command

```bash
node scripts/run-poetics-production-batch.js \
  --batch-id phase2-stratified-adaptation-pilot-v1 \
  --repeats 1 \
  --stress-repeats 0 \
  --only target-r01 \
  --target-spec config/poetics-calibration/phase2-classic-drama-adaptation-v1.yaml \
  --target-only D37,D38,D39,D40,D42,D45 \
  --target-tid-start 300 \
  --target-adaptation-arms routine,none,peripeteia-only \
  --role-map 'director=claude,tutor=codex,learner=claude' \
  --claude-model opus \
  --generation-concurrency 1 \
  --score-concurrency 2
```

## Interpretation Boundary

This pilot should not be read as a final estimate of adaptation. It is a
stratified smoke test: if the tutor mechanism works only in D42-style card
scenes, that is a mechanism limitation. If it also works in Socratic,
Vygotskian, Brechtian, Deweyan, and no-stage settings, then the adaptation claim
is no longer tied to one scene grammar.

## First Run Result

Run id: `phase2-stratified-adaptation-pilot-v1`

Artifacts:

- Root: `config/poetics-calibration/phase2-stratified-adaptation-pilot-v1`
- Sidecar browser: `http://127.0.0.1:3466/?runId=phase2-stratified-adaptation-pilot-v1`
- Items: 18 public scripts, 18 full transcripts, 90 critic scores
- Generation role map: `director=claude,tutor=codex,learner=claude`
- Claude model: `sonnet` in the completed first run, before Opus was pinned for
  future mixed-role generation
- Fifth critic pass: `codex` scored the same 18 public scripts through isolated
  `codex exec --ephemeral -s read-only` scorer calls.

High-level score counts:

| Arm | Critic | Recognition | Flat | Action >= 75 | Tutor mechanism >= 75 | Quality >= 75 |
|---|---|---:|---:|---:|---:|---:|
| routine | Codex | 2/6 | 4/6 | 6/6 | 3/6 | 2/6 |
| routine | Qwen | 4/6 | 2/6 | 5/6 | 2/6 | 1/6 |
| routine | Gemini | 0/6 | 6/6 | 4/6 | 1/6 | 0/6 |
| routine | DeepSeek | 3/6 | 3/6 | 6/6 | 0/6 | 0/6 |
| routine | Sonnet | 0/6 | 6/6 | 4/6 | 1/6 | 1/6 |
| none | Codex | 3/6 | 3/6 | 6/6 | 3/6 | 3/6 |
| none | Qwen | 3/6 | 3/6 | 6/6 | 2/6 | 2/6 |
| none | Gemini | 0/6 | 6/6 | 5/6 | 1/6 | 1/6 |
| none | DeepSeek | 2/6 | 4/6 | 3/6 | 1/6 | 1/6 |
| none | Sonnet | 1/6 | 5/6 | 4/6 | 1/6 | 1/6 |
| peripeteia-only | Codex | 5/6 | 1/6 | 5/6 | 3/6 | 3/6 |
| peripeteia-only | Qwen | 3/6 | 3/6 | 6/6 | 3/6 | 2/6 |
| peripeteia-only | Gemini | 0/6 | 6/6 | 5/6 | 4/6 | 3/6 |
| peripeteia-only | DeepSeek | 3/6 | 3/6 | 4/6 | 3/6 | 3/6 |
| peripeteia-only | Sonnet | 2/6 | 4/6 | 6/6 | 4/6 | 4/6 |

First interpretation:

- The peripeteia arm improves tutor-mechanism and mechanism-quality hits for
  Gemini, DeepSeek, and Sonnet, including outside the material-card family.
- Recognition votes remain critic-sensitive. Qwen and DeepSeek read more routine
  and no-adaptation scripts as recognitive; Gemini remains extremely strict on
  recognitive self-reframe; Sonnet sits between them on the peripeteia arm. Codex
  joins Qwen/DeepSeek on being more recognition-permissive, but strengthens the
  peripeteia arm relative to its own routine/no-adaptation baseline.
- D42 no longer dominates the evidence. D38/Dewey-Miller and D45/Bloom
  no-stage show high tutor-mechanism scores in peripeteia-only, while D39/D37
  show recognition votes without consistently high mechanism-quality hits. That
  suggests at least two distinguishable phenomena: visible tutor adaptation and
  recognitive learner re-reading.
- The run is a pilot, not a conclusion. The next pass should inspect exemplar
  disagreements by stratum, especially D38 and D45 for successful non-card
  adaptation and D39/D37 for recognitive votes with weaker mechanism evidence.

## Ending-Shape D42 Smoke

Run id: `phase2-ending-shape-d42-smoke-v1`

Artifacts:

- Root: `config/poetics-calibration/phase2-ending-shape-d42-smoke-v1`
- Sidecar browser: `http://127.0.0.1:3466/?runId=phase2-ending-shape-d42-smoke-v1`
- Items: 3 public scripts, 3 full transcripts, 15 critic scores
- Scenario/arms: D42 only, `routine`, `none`, `peripeteia-only`
- Generation role map: `director=claude,tutor=codex,learner=claude`
- Claude model for generation: `opus`
- Critic panel: Qwen 3.7 Max, Gemini 3.5 Flash, DeepSeek v4 Pro, Claude
  Sonnet 4.6, isolated Codex

This smoke tested a narrower mechanism change: after a tutor's adaptive device,
the learner must visibly perform the device and then earn a short reorientation
of the prior difficulty. This is meant to avoid endings where the learner acts
locally but never re-reads the impasse, or re-reads the impasse without a public
performance.

Score summary:

| Arm | Recognition votes | Avg action | Avg tutor mechanism | Avg mechanism quality |
|---|---:|---:|---:|---:|
| routine | 0/5 | 60.0 | 35.0 | 35.0 |
| none | 0/5 | 65.0 | 25.0 | 25.0 |
| peripeteia-only | 4/5 | 80.0 | 80.0 | 80.0 |

Peripeteia-only was recognized by Qwen, DeepSeek, Sonnet, and Codex. Gemini
remained the strict outlier and scored the adaptive branch flat/all-zero. The
important local result is that the same D42 anchor now has clean negative arms
and a much stronger adaptive arm: the ending-shape constraint improved the target
mechanism without contaminating the controls.

## Six-Scenario Ending-Shape Stratified Smoke

Run id: `phase2-ending-shape-stratified-smoke-v1`

Artifacts:

- Root: `config/poetics-calibration/phase2-ending-shape-stratified-smoke-v1`
- Sidecar browser: `http://127.0.0.1:3466/?runId=phase2-ending-shape-stratified-smoke-v1`
- Items: 18 public scripts, 18 full transcripts, 90 critic rows
- Scenarios: D37, D38, D39, D40, D42, D45
- Arms: `routine`, `none`, `peripeteia-only`
- Generation role map: `director=claude,tutor=codex,learner=claude`
- Claude model for generation: `opus`
- Critic panel attempted: Qwen 3.7 Max, Gemini 3.5 Flash, DeepSeek v4 Pro,
  Claude Sonnet 4.6, isolated Codex

Two caveats matter before interpretation:

- D38 generated a public-stage warning. The visible transcript does not leak
  ego/superego deliberation, but it does include intrusive stage phrasing such as
  the explanation becoming usable and a final tutor line closing the scene. Codex
  scored those D38 rows after manual inspection; OpenRouter critics could not
  score them because the remaining balance was too low for the prompt tokens.
- OpenRouter credits ran out during the peripeteia scoring pass. Retrying with
  `OPENROUTER_SCORER_MAX_TOKENS=512` preserved successful rows, but several
  external rows still failed because the account could not afford either the
  prompt tokens or even a 512-token response. Codex completed all 18 rows.

Aggregate score summary, including error rows as missing:

| Arm | Total critic rows | Errors | Recognition votes | Avg action | Avg tutor mechanism | Avg quality | Complete ending-shape votes |
|---|---:|---:|---:|---:|---:|---:|---:|
| routine | 30 | 5 | 12 | 72.0 | 55.0 | 51.0 | 2 |
| none | 30 | 5 | 16 | 67.0 | 46.0 | 49.0 | 6 |
| peripeteia-only | 30 | 13 | 17 | 88.2 | 70.6 | 58.8 | 10 |

Excluding D38, which only Codex could score after the quality warning:

| Arm | Successful critic rows | Recognition votes | Avg action | Avg tutor mechanism | Avg quality | Complete ending-shape votes |
|---|---:|---:|---:|---:|---:|---:|
| routine | 24 | 11 | 70.8 | 53.1 | 49.0 | 1 |
| none | 24 | 15 | 65.6 | 44.8 | 46.9 | 5 |
| peripeteia-only | 16 | 16 | 87.5 | 68.8 | 56.3 | 9 |

Interpretation:

- The ending-shape mechanism clearly raises the adaptive arm on action,
  mechanism, and full ending-shape votes. Peripeteia-only is 16/16 recognition
  among successful non-D38 external/Codex rows.
- The negative side is not clean in this stratified run. D40, D45, and parts of
  D39/D42 organically produce learner reorientation even in `routine` or `none`.
  That means this run is evidence that the prompt can generate recognitive drama,
  not clean evidence that peripeteia caused it.
- D37 is the cleanest stratified signal: routine and none are flat across the
  successful critics, while peripeteia-only is recognition for Qwen, DeepSeek,
  and Codex before the external-credit failures.
- Gemini should still be treated as a calibration critic rather than a veto. It
  is stricter and more failure-prone under low OpenRouter balance, but when it
  succeeds its disagreement is useful for surfacing whether the public transcript
  actually reorients earlier learner meaning or merely performs a task.

Browser support was extended in the same pass: each detail view now exposes an
ending-shape diagnostics panel showing critic votes for tutor adaptive move,
learner public performance, learner reorientation, and complete ending shape.
The list view also adds an `ending X/Y` chip. This should make future debugging
less dependent on reading raw JSON or long transcript files.

## Recognition-Origin Axis and Anchor Preview

After OpenRouter credits were refreshed, the same six-scenario run was rescored
to completion: 90/90 critic rows, zero errors. The repaired five-critic panel
strengthened the peripeteia arm but did not solve the control problem.

Final completed score summary:

| Arm | Recognition | Trap | Flat | Avg action | Avg tutor mechanism | Complete ending shape |
|---|---:|---:|---:|---:|---:|---:|
| routine | 15/30 | 0 | 15 | 67.5 | 52.5 | 3 |
| none | 18/30 | 1 | 11 | 65.8 | 50.0 | 7 |
| peripeteia-only | 27/30 | 1 | 2 | 77.5 | 65.0 | 16 |

To separate "recognition appeared" from "peripeteia caused recognition", the
scorer and browser now include a derived recognition-origin axis:

- `none`: no recognitive learner self-reframe.
- `organic`: recognition appears without enough tutor-mechanism evidence.
- `peripeteia_induced`: the same critic sees tutor mechanism, learner public
  performance, and learner reorientation.
- `false_closure`: insight/relief is marked without recontextualization.
- `ambiguous`: recognition appears with partial mechanism evidence but not the
  full chain.

This origin axis is deterministic over each critic's own role-symmetric scores,
not a new LLM judgment. It is meant as a diagnostic bridge: cheap enough to apply
to existing score artifacts, conservative enough not to relabel organic control
recognition as mechanism success.

Origin summary for `phase2-ending-shape-stratified-smoke-v1`:

| Arm | Peripeteia-induced | Organic | False closure | Ambiguous | None |
|---|---:|---:|---:|---:|---:|
| routine | 3/30 | 12/30 | 0/30 | 0/30 | 15/30 |
| none | 7/30 | 11/30 | 1/30 | 0/30 | 11/30 |
| peripeteia-only | 16/30 | 11/30 | 1/30 | 0/30 | 2/30 |

The origin axis makes the problem sharper. Peripeteia-only is better, but it
still contains a large organic-recognition tail. The controls are not merely
flat-or-not-flat; they contain different origins. D37 and D42 remain the most
useful clean anchors in this run. D40 and D45 should be treated as organic
contamination probes rather than clean controls.

A fresh candidate-anchor spec was added at
`config/poetics-calibration/phase2-low-organic-anchor-candidates-v2.yaml`.
It drafts four ordinary-continuity anchors:

- D54 citation fields: source-field labeling, not credibility.
- D55 parameter line: definition-side parameter, call-side argument.
- D56 bracketed action: stage direction as performed action, not spoken line.
- D57 fraction labels: numerator/denominator/fraction-bar placement, not size.

Preview generation was run without external scoring:

- Run id: `phase2-low-organic-anchor-origin-preview-v1`
- Root: `config/poetics-calibration/phase2-low-organic-anchor-origin-preview-v1`
- Browser: `http://127.0.0.1:3466/?runId=phase2-low-organic-anchor-origin-preview-v1`
- Items: 12 target scripts: D54-D57 × `routine`, `none`, `peripeteia-only`
- Scores: none yet

Generation was stopped after target scripts completed because the batch runner
then moved to default controls, which were not needed for this preview.

Initial qualitative screen:

- D54 is not usable as a clean anchor in this generated preview. The quality
  gate flagged no-cue self-reframe leakage in `routine` and `none`, plus one
  possible truncation in `none`.
- D55 has a promising peripeteia branch, but the `routine` branch already says
  "same slot is the trap" and performs a reframe. It needs a flatter routine
  constraint before scoring.
- D56 likely leaks pseudo-catharsis in routine form: "Oh, I get it" appears
  without needing the peripeteia arm. It may be useful as a false-closure probe,
  not a clean low-organic anchor.
- D57 is clearer than D54/D56 but still risks routine self-reframe around
  top/bottom position versus numerical size.

Practical implication: do not spend a five-critic external panel on this preview
batch yet. The useful next step is a stricter anchor-generation pass that forbids
routine/no-cue branches from naming traps, old/new frames, or "I get it" closure,
then uses the origin axis as the first cheap screen before external scoring.
