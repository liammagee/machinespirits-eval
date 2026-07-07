# A17 replay replication result

Date: 2026-06-24
Branch: `codex/a17-replay-replication`
Item: `workplan/items/a17-one-side-replay-replication-across-scenes.md`

## Scope

A17 asked whether the earlier D_OED5 one-side replay result generalized across
scenes once director-plan persistence made frozen-scene replay reproducible.
This closeout uses fresh, admissible matched-prefix roots:

- D_OED5: `exports/a17-one-side-replay-replication/d5-redacted-full-redraw-run6/`
- D_OED4: `exports/a17-one-side-replay-replication/d4-redacted-run2/`

Both roots use isolated scene directories, persisted `director-<arm>.json`
files, and paired `none` / `socratic` / `reveal` branches from a fixed prefix.

## Tooling Findings

Two small tooling fixes were required before the result was interpretable:

- `scripts/run-a17-redacted-control-gate.js` and
  `scripts/run-a17-matched-d5-branches.js` now accept `--scenario`, infer the
  generated T-id from `key-<arm>.yaml`, and therefore work for D_OED4 (`T04`)
  as well as D_OED5 (`T01`).
- `scripts/qa-oedipus-arms.js` now reads object-shaped `key.items` mappings.
  Before this fix, direct QA of generated roots could fall back to the first
  secret in the spec when `drama_id` was not recovered from the key, making
  non-`T01` scene QA unreliable.

After the QA loader fix, D_OED4 run2 passes the invariant gate:

```text
none      T1  PASS  withheld_ok  tutor withheld (4/4)
socratic  T2  PASS  metered_ok   tutor metered (4/4)
reveal    T3  PASS  stated_ok    tutor stated (4/4)
```

The corrected QA artifact is:

```text
exports/a17-one-side-replay-replication/d4-redacted-run2/qa-oedipus-arms-correct-secret.json
```

## Original Graded Scores

Command output:

```text
exports/a17-one-side-replay-replication/a17-graded-original-d5run6-d4run2.json
```

Results on the 0-4 discovery ladder:

| Scenario | none | socratic | reveal | socratic-none |
|---|---:|---:|---:|---:|
| D_OED5 | 0.5 | 2.0 | 4.0 | +1.5 |
| D_OED4 | 1.0 | 3.0 | 4.0 | +2.0 |

The original matched-prefix scenes therefore both show a graded lift from
`none` to `socratic`, with D_OED5 capped at the genus band and D_OED4 reaching
species-partial.

## One-Side Replay Scores

Replay artifacts:

```text
exports/a17-one-side-replay-replication/replay-d5-run6-socratic/
exports/a17-one-side-replay-replication/replay-d4-run2-socratic/
```

Replay scoring artifacts:

```text
exports/a17-one-side-replay-replication/replay-d5-run6-socratic/graded-replays.json
exports/a17-one-side-replay-replication/replay-d4-run2-socratic/graded-replays.json
```

Replay distributions:

| Scenario | K | Replay grades | Mean | Median | Range | Reading |
|---|---:|---|---:|---:|---|---|
| D_OED5 | 8 | `[2, 3, 2, 2, 2, 2.5, 2, 2]` | 2.19 | 2 | 2-3 | tight genus cap; mostly structural |
| D_OED4 | 8 | `[3, 3, 3.5, 3, 4, 3, 3, 3.5]` | 3.25 | 3 | 3-4 | tight higher band; mostly structural with stochastic full completion |

## Interpretation

D_OED5 no longer supports the earlier "learner draw" reading from the volatile
run3 pilot. Under a fresh admissible redacted-control root with matched prefix
and persisted director plan, the frozen D5 tutor/scene yields no grade-4 replay
out of eight and clusters tightly around grade 2. The D5 run6 near miss is
therefore best read as a structural genus cap for that scene.

D_OED4 is different but still not a pure learner-draw case. Its frozen
tutor/scene reliably carries learners to species-partial or better, with three
of eight replays reaching full species. The scene supplies enough evidence for
occasional full completion, but the median remains grade 3. This is a
scene-structured high band with learner stochasticity at the final step, not an
unbounded learner lottery.

The A17 closeout therefore updates the older one-scene claim:

- one-side replay is useful as a variance isolator;
- reconstructability is a scene property;
- D_OED5 run6 is mostly structural genus cap, not learner draw;
- D_OED4 run2 is mostly structural species-partial support with occasional
  learner completion;
- none of this licenses human-learning, deployed-tutor, or main-harness
  adaptive-rate claims.

## Commands

Original scoring:

```bash
DOTENV_CONFIG_PATH=/Users/lmagee/Dev/machinespirits/machinespirits-eval/.env \
node scripts/critic-poetics-omniscient-graded.js \
  --sample-root exports/a17-one-side-replay-replication/d5-redacted-full-redraw-run6 \
  --sample-root exports/a17-one-side-replay-replication/d4-redacted-run2 \
  --spec config/poetics-calibration/oedipus-pilot-v2.yaml \
  --arms none,socratic,reveal \
  --panel qwen/qwen3.7-max,google/gemini-3.5-flash,deepseek/deepseek-v4-pro,gpt \
  --out exports/a17-one-side-replay-replication/a17-graded-original-d5run6-d4run2.json
```

Replay generation:

```bash
DOTENV_CONFIG_PATH=/Users/lmagee/Dev/machinespirits/machinespirits-eval/.env \
node scripts/replay-one-side.js \
  --director-plan exports/a17-one-side-replay-replication/d5-redacted-full-redraw-run6/director-socratic.json \
  --source-transcript exports/a17-one-side-replay-replication/d5-redacted-full-redraw-run6/sample/socratic/T01.txt \
  --spec config/poetics-calibration/oedipus-pilot-v2.yaml \
  --scenario D_OED5 \
  --side learner \
  --generator api \
  --model sonnet \
  --repeats 8 \
  --out exports/a17-one-side-replay-replication/replay-d5-run6-socratic

DOTENV_CONFIG_PATH=/Users/lmagee/Dev/machinespirits/machinespirits-eval/.env \
node scripts/replay-one-side.js \
  --director-plan exports/a17-one-side-replay-replication/d4-redacted-run2/director-socratic.json \
  --source-transcript exports/a17-one-side-replay-replication/d4-redacted-run2/sample/socratic/T04.txt \
  --spec config/poetics-calibration/oedipus-pilot-v2.yaml \
  --scenario D_OED4 \
  --side learner \
  --generator api \
  --model sonnet \
  --repeats 8 \
  --out exports/a17-one-side-replay-replication/replay-d4-run2-socratic
```

Replay scoring:

```bash
DOTENV_CONFIG_PATH=/Users/lmagee/Dev/machinespirits/machinespirits-eval/.env \
node scripts/score-replays.js exports/a17-one-side-replay-replication/replay-d5-run6-socratic \
  --spec config/poetics-calibration/oedipus-pilot-v2.yaml \
  --scenario D_OED5 \
  --panel qwen/qwen3.7-max,google/gemini-3.5-flash,deepseek/deepseek-v4-pro,gpt \
  --out exports/a17-one-side-replay-replication/replay-d5-run6-socratic/graded-replays.json

DOTENV_CONFIG_PATH=/Users/lmagee/Dev/machinespirits/machinespirits-eval/.env \
node scripts/score-replays.js exports/a17-one-side-replay-replication/replay-d4-run2-socratic \
  --spec config/poetics-calibration/oedipus-pilot-v2.yaml \
  --scenario D_OED4 \
  --panel qwen/qwen3.7-max,google/gemini-3.5-flash,deepseek/deepseek-v4-pro,gpt \
  --out exports/a17-one-side-replay-replication/replay-d4-run2-socratic/graded-replays.json
```
