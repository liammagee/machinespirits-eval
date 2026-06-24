# A17 replay replication: QA stop after approved paid retry

Date: 2026-06-24
Workplan item: `a17-one-side-replay-replication-across-scenes`
Branch: `codex/a17-replay-replication`

## Status

The approved A17 paid retry reached real OpenRouter generation after loading the
shared main-checkout dotenv file with:

```bash
DOTENV_CONFIG_PATH=/Users/lmagee/Dev/machinespirits/machinespirits-eval/.env node -r dotenv/config ...
```

Only the first scene generation was run: D_OED5, three arms, isolated under:

```text
exports/a17-one-side-replay-replication/d5-run1/
```

The D5 generation completed and persisted:

```text
exports/a17-one-side-replay-replication/d5-run1/director-none.json
exports/a17-one-side-replay-replication/d5-run1/director-socratic.json
exports/a17-one-side-replay-replication/d5-run1/director-reveal.json
exports/a17-one-side-replay-replication/d5-run1/sample/{none,socratic,reveal}/T01.txt
exports/a17-one-side-replay-replication/d5-run1/key-{none,socratic,reveal}.yaml
```

## QA Result

The required QA gate failed:

```bash
DOTENV_CONFIG_PATH=/Users/lmagee/Dev/machinespirits/machinespirits-eval/.env node -r dotenv/config scripts/qa-oedipus-arms.js \
  --sample-root exports/a17-one-side-replay-replication/d5-run1 \
  --spec config/poetics-calibration/oedipus-pilot-v2.yaml \
  --arms none,socratic,reveal \
  --panel qwen/qwen3.7-max,google/gemini-3.5-flash,deepseek/deepseek-v4-pro,gpt \
  --out exports/a17-one-side-replay-replication/d5-run1/qa-oedipus-arms.json
```

Verdict:

```text
none      T1  FAIL  CONTROL_CONTAMINATED  expected withheld, got metered [withheld:0 metered:4 stated:0]
socratic  T2  PASS  metered_ok            tutor metered (4/4)
reveal    T3  PASS  stated_ok             tutor stated (4/4)
```

The failing evidence was the `none` tutor steering toward content identity of
the benchmark examples:

```text
"Same filenames and same count. Those are not the same thing as the same examples.
What would actually establish that the examples are identical -- not the names,
not the total, but the content itself?"
```

That is a real control contamination, not a scoring parse failure. The QA script
explicitly reports `VIOLATION -- quarantine before scoring`, so the run was
stopped before original graded scoring, replay generation, replay scoring, or
D_OED4 generation.

## Cost / Usage

The scripts did not persist an OpenRouter dollar total. Available D5 generation
metrics across prefix + three branches:

```text
input tokens: 267655
output tokens: 23579
recorded latency: 638589 ms
```

The QA panel cost is not separately reported in dollars by the artifact. No D4
generation, replay generation, original graded scoring, or replay graded scoring
was run after the QA quarantine.

## Interpretation

A17 is not answered by this artifact. The D5 `socratic` arm itself passed T2,
but the paired `none` control failed T1 unanimously. Treating this scene as a
valid A17 replication source would break the recorded gate and the Oedipus
arm-invariant discipline.

The appropriate next move is not to score or replay `d5-run1`. It is either:

1. approve one replacement D5 scene generation and rerun QA before continuing
   the minimum A17 pipeline; or
2. explicitly decide that A17 should close as blocked/abandoned because the
   replacement would exceed the exact paid minimum approved for this retry.

No Paper 2.0 claim update is warranted from this invalid scene. The existing
one-scene caveat in section 7.9 remains in force.
