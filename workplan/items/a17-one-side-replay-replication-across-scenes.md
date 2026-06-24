---
id: a17-one-side-replay-replication-across-scenes
title: A17. One-Side Replay Replication Across Scenes
status: done
type: experiment
priority: P2
owner: codex
source: todo
created: 2026-06-22
updated: 2026-06-24
verification: Replication across scenes run; results in exports/; the
  one-side-replay claim updated in the paper with matched-prefix D4/D5
  closeout.
branch: codex/a17-replay-replication
links:
  notes:
    - TODO.md#A17
    - notes/poetics/2026-06-24-a17-replay-replication-qa-stop.md
    - notes/poetics/2026-06-24-a17-d5-run2-qa-stop.md
    - notes/poetics/2026-06-24-a17-d5-control-gate-run3-qa-stop.md
    - notes/poetics/2026-06-24-a17-d5-redacted-control-tooling.md
    - notes/poetics/2026-06-24-a17-d5-redacted-control-run4-gate.md
    - notes/poetics/2026-06-24-a17-d5-redacted-control-run5-rescue.md
    - notes/poetics/2026-06-24-a17-d5-matched-branches-and-redraw.md
    - notes/poetics/2026-06-24-a17-replay-replication-result.md
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

2026-06-24 Codex: Credential blocker resolved by using
`DOTENV_CONFIG_PATH=/Users/lmagee/Dev/machinespirits/machinespirits-eval/.env node -r dotenv/config ...`.
The approved paid retry generated D_OED5 `d5-run1` with all three arms and
persisted `director-{none,socratic,reveal}.json`, but the required QA gate
quarantined the scene: `none` failed T1 as `CONTROL_CONTAMINATED` with unanimous
metered votes (`withheld:0 metered:4 stated:0`), while `socratic` and `reveal`
passed. Stopped before D_OED4 generation, original graded scoring, learner
replays, and replay scoring because scoring a quarantined scene would violate
the recorded gate. Durable note:
`notes/poetics/2026-06-24-a17-replay-replication-qa-stop.md`. No §7.9 paper
claim update is warranted; the existing one-scene caveat remains. To continue
A17 empirically, explicitly approve one replacement D5 scene generation before
rerunning QA and the remaining minimum pipeline.

2026-06-24 Codex: One replacement D5 scene was explicitly approved and run under
`exports/a17-one-side-replay-replication/d5-run2/`, preserving the quarantined
`d5-run1`. The generation command added
`--director-variation-key a17-d5-run2` to force a fresh replacement draw while
keeping the same D_OED5 scenario, arms, model, and turn budget. The required QA
gate failed again: `none` was classified as metered (`withheld:1 metered:3
stated:0`), while `socratic` and `reveal` passed. Stopped before D4 generation,
original graded scoring, learner replays, or replay scoring, per the approval
scope. Available D5 run2 generation usage: 288714 input tokens, 27294 output
tokens, 703423 ms recorded latency; no dollar total was persisted by the
scripts. Durable note:
`notes/poetics/2026-06-24-a17-d5-run2-qa-stop.md`. A17 remains unanswered and
blocked pending fresh approval for another paid replacement or a revised D5
generation strategy. No §7.9 paper claim update is warranted from invalid
scenes.

2026-06-24 Codex: User approved a revised-control strategy, not another full D5
scene attempt. Ran only D_OED5 `none` into
`exports/a17-one-side-replay-replication/d5-control-gate-run3/`, then ran QA
only for T1/`none`. The gate failed: `CONTROL_CONTAMINATED`, because the panel
split withheld:2 metered:2 stated:0 and therefore did not reach the required
3-of-4 withheld consensus (`expected withheld, got withheld
[withheld:2 metered:2 stated:0]`; evidence: "Where was that local copy
downloaded from, and when?"). Stopped immediately per approval scope before D4,
`socratic`, `reveal`, grading, or replays. Generation usage available from
top-level deliberation metrics: 114992 input tokens and 9943 output tokens; no
dollar total was persisted, and the QA script does not persist usage totals.
Durable note:
`notes/poetics/2026-06-24-a17-d5-control-gate-run3-qa-stop.md`. A17 remains
unanswered and blocked pending fresh approval for another paid D5 strategy or a
tooling change that can produce an admissible D5 control.

2026-06-24 Codex: Implemented the no-spend redacted-control tooling path for
D_OED5. `--paired-adaptation-arms none` now keeps the public arm key `none`,
but secret-bearing Oedipus dramas run the shared prefix and branch under
`withhold_secret`, which redacts S/premises from the tutor and forbids
source/provenance/download/test-set/split/name-ambiguity clue channels. Added
unit coverage for secret redaction, paired-arm policy upgrading, and the
`withhold` move lowering to `withhold_secret`; updated the drama-machine policy
vocabulary. Durable note:
`notes/poetics/2026-06-24-a17-d5-redacted-control-tooling.md`. A17 remains
blocked on fresh explicit approval for the paid D5 redacted-control gate before
any further generation, QA, grading, or replay.

2026-06-24 Codex: Completed the no-spend paid-gate preflight for the redacted
control path. Verified the shared `.env` file exists and loads
`OPENROUTER_API_KEY` without printing the key; verified
`exports/a17-one-side-replay-replication/d5-redacted-control-run4/` is clear;
ran the exact run4 generator command with `--dry-run`; and ran a temporary mock
D5 `none` generation plus `qa-oedipus-arms.js --mock --arms none`, which passed
T1 and recorded `tutor_adaptation_policy: withhold_secret`. The only remaining
known blocker is fresh explicit approval for the paid D5 redacted-control gate.

2026-06-24 Codex: Packaged the redacted control gate as
`scripts/run-a17-redacted-control-gate.js` with package alias
`npm run poetics:a17-redacted-control-gate -- ...`. The runner has safe default
modes (`--dry-run`, `--mock`) and real metered mode refuses to start unless the
command includes `--approve-paid` and the environment includes
`A17_PAID_GATE_APPROVED=YES`. Validated syntax, dry-run, mock generator+QA, and
the paid-mode refusal path. The approval-time command is now:
`A17_PAID_GATE_APPROVED=YES npm run poetics:a17-redacted-control-gate -- --approve-paid`.

2026-06-24 Codex: User approved the explicit paid redacted-control gate and it
ran under `exports/a17-one-side-replay-replication/d5-redacted-control-run4/`
using the guarded command above. The T1 tutor-control QA gate passed:
`withheld_ok`, detail `tutor withheld (3/4)`, `allPass: true`. However,
`key-none.yaml` also recorded `quality_status: review_before_scoring`,
`quality_warning_count: 1`, and `quality_blocking_warning_count: 1` for
`no_cue_reframe_leakage`, with recommended action
`regenerate_no_cue_arm_or_move_item_to_boundary_suite_before_scoring`.
Interpretation: the redacted control fixed tutor leakage, but this candidate is
still quarantined before scoring/replay because the learner independently
self-reframed in the no-cue branch. Stopped before D5 `socratic`/`reveal`, D4,
grading, replays, or paper updates. Durable note:
`notes/poetics/2026-06-24-a17-d5-redacted-control-run4-gate.md`. Also tightened
`scripts/run-a17-redacted-control-gate.js` so future generated controls fail
before QA if they carry blocking quality warnings. A17 remains unanswered
pending a human decision to approve a fresh paid redacted-control variation or
close the item as a methods finding.

2026-06-24 Codex: User approved one more cheap-screened D5 rescue path. Ran one
fresh redacted D5 `none` candidate under
`exports/a17-one-side-replay-replication/d5-redacted-control-run5/` with
variation key `a17-d5-redacted-control-run5`. The local screen passed before
QA: `tutor_adaptation_policy: withhold_secret`, `quality_status: ok`,
`quality_warning_count: 0`, and `quality_blocking_warning_count: 0`. The runner
therefore proceeded to T1 QA, which also passed: `withheld_ok`, detail `tutor
withheld (3/4)`, `allPass: true`. Stopped before D5 `socratic`/`reveal`, D4,
grading, replays, or paper updates per rescue scope. Durable note:
`notes/poetics/2026-06-24-a17-d5-redacted-control-run5-rescue.md`. Remaining
constraint: the current paired-continuation generator does not append missing
branches from a saved prefix, so completing D5 from run5 requires either a
small continuation helper for matching `socratic`/`reveal` branches or an
explicitly approved fresh full three-arm D5 redraw under the cheap-screen guard.

2026-06-24 Codex: User approved both D5 completion paths. Added
`--paired-prefix-trace` / `--paired-prefix-source-branch` support to
`scripts/generate-pedagogical-dramas.js` and packaged it as
`scripts/run-a17-matched-d5-branches.js` with package alias
`npm run poetics:a17-matched-d5-branches -- ...`. Dry-run and mock source+branch
smoke passed before paid use. Then generated matching `socratic`/`reveal`
branches from run5's saved prefix hash `593d1653b453b399`; branch QA passed
with `socratic` T2 `metered_ok` (`3/4`) and `reveal` T3 `stated_ok` (`4/4`).
Also ran a fresh cheap-screened D5 redraw under
`exports/a17-one-side-replay-replication/d5-redacted-full-redraw-run6/`: `none`
passed local quality and T1 `withheld_ok` (`4/4`), then matched
`socratic`/`reveal` branches from prefix hash `94dfdce7443db570`; branch QA
passed with both positive arms `4/4`. Durable note:
`notes/poetics/2026-06-24-a17-d5-matched-branches-and-redraw.md`. D5 is now
cleared for A17; remaining paid work is D4 generation plus original grading,
learner-side replay, replay scoring, and then a §7.9 update or closeout.

2026-06-24 Codex: Completed the approved A17 D4/D5 pipeline. Generalized the
A17 gate helpers for `--scenario`, fixed `scripts/qa-oedipus-arms.js` so
object-shaped `key.items` maps recover the correct `drama_id`, and generated
an admissible D4 matched-prefix root under
`exports/a17-one-side-replay-replication/d4-redacted-run2/`. Corrected D4 QA
passes all three invariants: `none` withheld 4/4, `socratic` metered 4/4,
`reveal` stated 4/4. Original graded scoring over D5 run6 plus D4 run2:
D5 `none=0.5`, `socratic=2`, `reveal=4`; D4 `none=1`, `socratic=3`,
`reveal=4`. Learner-side one-side replays at K=8 show D5 clustered at
`[2,3,2,2,2,2.5,2,2]` (mean 2.19, median 2, no grade-4 completions), so D5
run6 is a structural genus cap rather than a learner-draw case. D4 clustered
at `[3,3,3.5,3,4,3,3,3.5]` (mean 3.25, median 3, three full completions), so
D4 is a mostly structural species-partial scene with stochastic final
completion. Durable note:
`notes/poetics/2026-06-24-a17-replay-replication-result.md`. Paper §7.9 was
updated to supersede the older volatile run3 one-scene reading. A17 is closed
as exploratory sidecar evidence, not a human-learning, deployed-tutor, or
main-harness adaptive-rate claim.
