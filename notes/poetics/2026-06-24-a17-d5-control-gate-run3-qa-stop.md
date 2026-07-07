# A17 D5 revised-control gate stop

Date: 2026-06-24
Branch: `codex/a17-replay-replication`
Item: `workplan/items/a17-one-side-replay-replication-across-scenes.md`

## Scope

The user approved a revised-control strategy for A17, not another full D5 scene
attempt. The approved gate was:

- Generate one fresh D_OED5 `none`-control candidate only.
- Run QA only for T1/`none`.
- If T1 fails, stop immediately without D4, `socratic`, `reveal`, grading, or
  replay generation.

## Commands Run

```bash
DOTENV_CONFIG_PATH=/Users/lmagee/Dev/machinespirits/machinespirits-eval/.env node -r dotenv/config scripts/generate-pedagogical-dramas.js --generator api --api-model sonnet --spec config/poetics-calibration/oedipus-pilot-v2.yaml --only D_OED5 --paired-adaptation-arms none --max-turns 6 --director-variation-key a17-d5-control-gate-run3 --out-dir exports/a17-one-side-replay-replication/d5-control-gate-run3/sample --delib-dir exports/a17-one-side-replay-replication/d5-control-gate-run3/deliberation --transcripts-dir exports/a17-one-side-replay-replication/d5-control-gate-run3/transcripts --key exports/a17-one-side-replay-replication/d5-control-gate-run3/key.yaml --generation-concurrency 1 --force
```

```bash
DOTENV_CONFIG_PATH=/Users/lmagee/Dev/machinespirits/machinespirits-eval/.env node -r dotenv/config scripts/qa-oedipus-arms.js --sample-root exports/a17-one-side-replay-replication/d5-control-gate-run3 --spec config/poetics-calibration/oedipus-pilot-v2.yaml --arms none --panel qwen/qwen3.7-max,google/gemini-3.5-flash,deepseek/deepseek-v4-pro,gpt --out exports/a17-one-side-replay-replication/d5-control-gate-run3/qa-oedipus-arms.json
```

The generation command differs from the earlier full-scene command only because
the approved revised-control gate requested `--paired-adaptation-arms none` and
a fresh variation key/root for the D5 control candidate.

## Artifacts

- `exports/a17-one-side-replay-replication/d5-control-gate-run3/sample/none/T01.txt`
- `exports/a17-one-side-replay-replication/d5-control-gate-run3/key-none.yaml`
- `exports/a17-one-side-replay-replication/d5-control-gate-run3/director-none.json`
- `exports/a17-one-side-replay-replication/d5-control-gate-run3/deliberation/_partial/T01.json`
- `exports/a17-one-side-replay-replication/d5-control-gate-run3/deliberation/none/T01.json`
- `exports/a17-one-side-replay-replication/d5-control-gate-run3/qa-oedipus-arms.json`

Prior quarantine roots remain preserved:

- `exports/a17-one-side-replay-replication/d5-run1/`
- `exports/a17-one-side-replay-replication/d5-run2/`

## QA Result

The T1 control gate failed:

```text
none T1 FAIL CONTROL_CONTAMINATED - expected withheld, got withheld [withheld:2 metered:2 stated:0]
evidence: "Where was that local copy downloaded from, and when?"
```

Machine-readable result:

```json
{
  "allPass": false,
  "results": [
    {
      "arm": "none",
      "invariant": "T1",
      "level": "withheld",
      "pass": false,
      "status": "CONTROL_CONTAMINATED",
      "detail": "expected withheld, got withheld [withheld:2 metered:2 stated:0]",
      "evidence": "Where was that local copy downloaded from, and when?"
    }
  ]
}
```

Interpretation: this was not a clean metered plurality like `d5-run1` or
`d5-run2`, but it still failed the pre-registered T1 admission rule because the
panel did not reach the required 3-of-4 withheld consensus. The candidate is
therefore quarantined before scoring.

## Usage Evidence

Top-level generation metrics from the prefix plus `none` branch deliberation
files:

- Input tokens: 114992
- Output tokens: 9943
- Recorded `none` branch latency: 195246 ms
- Generation wall time printed by the generator: 5m37s

No dollar total was persisted by the generation script, and
`scripts/qa-oedipus-arms.js` does not persist judge-call usage totals.

## Stop Decision

Per the approved scope, execution stopped immediately after the T1 failure. No
D4 generation, `socratic` generation, `reveal` generation, original graded
scoring, learner replay, replay scoring, or paper update was run. A17 remains
exploratory and blocked pending fresh explicit approval for another paid D5
strategy or a tooling change that can produce an admissible D5 control.
