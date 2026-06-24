---
id: a17-one-side-replay-replication-across-scenes
title: A17. One-Side Replay Replication Across Scenes
status: blocked
type: experiment
priority: P2
owner: codex
source: todo
created: 2026-06-22
updated: 2026-06-24
verification: Replication across scenes run; results in exports/; the
  one-side-replay claim updated or closed in the paper.
branch: codex/a17-replay-replication
blocked_by: OPENROUTER_API_KEY is not available in this worktree's shell or
  dotenv-loaded environment, so the approved API generation/scoring gate cannot
  start.
links:
  notes: TODO.md#A17
  paper: §7.9
  exports: exports/a17-one-side-replay-replication/
claim_status: exploratory
tags:
  - replay
  - poetics
  - learner-variance
milestone: poetics-followups
---

TODO §A17 asks whether the D_OED5 run3 verdict generalizes across scenes now that per-run director plans are persisted.

Acceptance:
- Generate fresh D_OED5 and D_OED4 scenes with `director-<arm>.json` persistence intact.
- Replay each scene's learner side K≈8 and score with `scripts/score-replays.js`.
- Report whether each scene is a structural cap or learner-draw case, then update §7.9 or close the follow-up as exploratory.

## Status log

2026-06-24 Codex: Blocked on the paid-run gate. The current checkout does not
contain replayable D_OED5/D_OED4 source scenes for this follow-up: no
`exports/replay-d5-run3-socratic/`, no `exports/oedipus-d5-full/`, and no
persisted `exports/**/director-*.json` files are present. Existing
`exports/oedipus-d4-full/RESULTS.md` is a summary only, not a replayable scene
root.

No-cost readiness completed: installed local dependencies, rebuilt
`better-sqlite3`, and ran a `/tmp` mock smoke that generated isolated D_OED5
and D_OED4 scene roots, confirmed `director-socratic.json` for each, replayed
the learner side once with `--generator mock`, and scored each replay with
`scripts/score-replays.js --mock`. The smoke also confirmed an important
operational rule: generate one scenario per scene root for this item. If D_OED5
and D_OED4 are generated into the same root, `director-socratic.json` is
overwritten by the later scenario; isolated roots preserve director-plan
fidelity.

Paid gate: the minimum completion run is two fresh scene generations
(D_OED5 and D_OED4, three arms each), plus 16 learner-side replay generations
(K=8 per scene), plus QA / original graded scoring / replay graded scoring with
the blind panel. Do not run this until a human approves the budget and the
current model/panel cost estimate.

Exact commands after approval:

```bash
SPEC=config/poetics-calibration/oedipus-pilot-v2.yaml
ROOT=exports/a17-one-side-replay-replication
PANEL=qwen/qwen3.7-max,google/gemini-3.5-flash,deepseek/deepseek-v4-pro,gpt

for entry in "D_OED5 d5 T01" "D_OED4 d4 T04"; do
  set -- $entry
  SCENARIO=$1
  SHORT=$2
  TID=$3
  SCENE_DIR="$ROOT/${SHORT}-run1"
  REPLAY_DIR="$ROOT/replay-${SHORT}-run1-socratic"

  node scripts/generate-pedagogical-dramas.js \
    --generator api --api-model sonnet \
    --spec "$SPEC" \
    --only "$SCENARIO" \
    --paired-adaptation-arms none,socratic,reveal \
    --max-turns 6 \
    --out-dir "$SCENE_DIR/sample" \
    --delib-dir "$SCENE_DIR/deliberation" \
    --transcripts-dir "$SCENE_DIR/transcripts" \
    --key "$SCENE_DIR/key.yaml" \
    --generation-concurrency 1 \
    --force

  test -s "$SCENE_DIR/director-socratic.json"
  test -s "$SCENE_DIR/sample/socratic/$TID.txt"

  node scripts/qa-oedipus-arms.js \
    --sample-root "$SCENE_DIR" \
    --spec "$SPEC" \
    --arms none,socratic,reveal \
    --panel "$PANEL" \
    --out "$SCENE_DIR/qa-oedipus-arms.json"

  node scripts/critic-poetics-omniscient-graded.js \
    --sample-root "$SCENE_DIR" \
    --spec "$SPEC" \
    --arms none,socratic \
    --panel "$PANEL" \
    --out "$SCENE_DIR/graded-original.json"

  node scripts/replay-one-side.js \
    --director-plan "$SCENE_DIR/director-socratic.json" \
    --source-transcript "$SCENE_DIR/sample/socratic/$TID.txt" \
    --spec "$SPEC" \
    --scenario "$SCENARIO" \
    --side learner \
    --generator api \
    --model sonnet \
    --repeats 8 \
    --out "$REPLAY_DIR"

  node scripts/score-replays.js "$REPLAY_DIR" \
    --spec "$SPEC" \
    --scenario "$SCENARIO" \
    --panel "$PANEL" \
    --out "$REPLAY_DIR/graded-replays.json"
done
```

Expected artifacts:
- `exports/a17-one-side-replay-replication/d5-run1/` and `d4-run1/` with
  `sample/{none,socratic,reveal}/`, `key-*.yaml`, `director-socratic.json`,
  `qa-oedipus-arms.json`, and `graded-original.json`.
- `exports/a17-one-side-replay-replication/replay-d5-run1-socratic/` and
  `replay-d4-run1-socratic/` with `replay-1.txt` ... `replay-8.txt`,
  `replays.json`, and `graded-replays.json`.
- A §7.9 paper update, or an explicit closeout note preserving the result as
  exploratory if the distributions do not support a stronger claim.

2026-06-24 Codex: Paid-run approval received, but execution is blocked before
any model call by missing credentials. Checks:
- `.env` is absent in this worktree.
- `node -r dotenv/config -e "..."` reports `OPENROUTER_API_KEY` missing after
  dotenv loading.
- The first approved generation command fails at `buildDirectorPlan` with
  `OPENROUTER_API_KEY not set (required for --generator api)`.

No paid API call was reached; cost incurred for this retry is $0. The failed
attempt created only ignored partial directories and writing-pad SQLite files
under `exports/a17-one-side-replay-replication/`; those were removed so the
next retry starts clean. To resume, provide the key through `.env` or the shell
environment, then rerun the exact commands above.
