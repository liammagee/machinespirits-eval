---
name: ms-replay-one-side
description: Counterfactual replay of a guided-discovery dialogue — freeze one side's turns + the scene from a source run and regenerate the OTHER side K times via a chosen bridge, then graded-score the result. Isolates learner-variance from scene-variance (the thing fresh re-runs confound). Use to ask "is this near-miss a learner draw or a structural cap?" For dramatic derivation selector/pacing failures where the goal is to preserve turns 1..N and resume live from a failure turn, use `ms-derivation-episode-replay` instead.
argument-hint: "<run-dir> <arm> [--side learner] [--repeats K] [--generator api|Codex|mock] [--model sonnet]"
allowed-tools: Bash, Read
---

Run a one-side replay and read its grade distribution. The point: a fresh re-run gives a *new scene* each time, so it can't separate "the learner drew badly" from "the scene lacked the evidence." This holds the scene + the frozen side fixed and varies only the regenerated side.

If the source is a dramatic derivation run under `exports/dramatic-derivation/loop/<label>/` and the user wants to preserve the full prefix through a failure turn, stop here and use `ms-derivation-episode-replay`. This skill is for the older one-side guided-discovery replay harness, not the derivation episode CLI.

Parse `$ARGUMENTS`: a source run dir (e.g. `exports/oedipus-d5-full/run3`), an arm (`socratic`/`none`/`reveal`), and optional `--side` (default `learner`), `--repeats` (default 8), `--generator` (default `api`), `--model` (default `sonnet`). Default spec: `config/poetics-calibration/oedipus-pilot-v2.yaml`; infer `--scenario` from the run (the D_OED* id in the key files) or ask.

## 1. Locate the source directorPlan (fidelity is load-bearing)

A faithful replay MUST reuse the **source run's** directorPlan — regenerating it = a different scene = a confounded result. Find it, in this order:

```bash
# preferred: persisted per-run (generation writes this since the persistence change)
ls <run-dir>/director-<arm>.json
# fallback: the salvaged full trace (## Director Scene Card block)
ls <run-dir>/<arm>.full.md
```

If neither exists, the plan was clobbered (the volatile `config/poetics-calibration/phase2-transcripts-*/` dir is overwritten each generation). In that case STOP and tell the user the run is not faithfully replayable — offer to regenerate it (generation now persists the plan) rather than replay with a fresh director.

## 2. Replay (regenerate the chosen side K times)

```bash
node scripts/replay-one-side.js \
  --director-plan <run-dir>/director-<arm>.json   # or <run-dir>/<arm>.full.md \
  --source-transcript <run-dir>/sample/<arm>/T01.txt \
  --spec config/poetics-calibration/oedipus-pilot-v2.yaml --scenario <D_OED id> \
  --side learner --generator api --model sonnet --repeats 8 \
  --out exports/replay-<id>-<run>-<arm>
```

`--generator mock` first for a free plumbing check. This is a **paid** run (~3 min/replay on api/sonnet) with per-replay retry for intermittent connections — run it in the background and confirm before spending.

## 3. Graded-score the replays → the distribution

```bash
node scripts/score-replays.js exports/replay-<id>-<run>-<arm> \
  --spec config/poetics-calibration/oedipus-pilot-v2.yaml --scenario <D_OED id>
```

## 4. Read the distribution (the whole point)

On the 0–4 ladder (`notes/poetics/2026-06-01-oedipus-discovery-grade-rubric.md`):
- **Tight cluster / unanimous band** (e.g. all ~2) → the frozen scene **caps** the learner there; the near-miss is **structural** (the scene didn't supply the decisive evidence).
- **Wide / bimodal** (some 2, some 4) → a **learner draw** the scene only sometimes resolves; the cap isn't structural.

Report the histogram, mean/median, and which reading it supports — that is the answer to "structural vs draw."

## Notes

- `--side tutor` is not yet wired (needs a symmetric `scriptedLearnerTurns` hook in the engine); v1 is learner-only.
- Works for any guided-discovery scenario with a `secret` block, not just D_OED5.
- The engine hook is guarded (`scriptedTutorTurns`); normal generation is unaffected.
