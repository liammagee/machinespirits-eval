---
name: ms-replay-one-side
description: Inspect or mock a one-side counterfactual replay while holding the source scene and tutor turns fixed. Use for older guided-discovery artifacts; use ms-derivation-episode-replay for derivation prefixes. Real replay and panel scoring are blocked until their routes and call ceilings are explicit and enforced.
---

Run a one-side replay and read its grade distribution. The point: a fresh re-run gives a *new scene* each time, so it can't separate "the learner drew badly" from "the scene lacked the evidence." This holds the scene + the frozen side fixed and varies only the regenerated side.

If the source is a dramatic derivation run under `exports/dramatic-derivation/loop/<label>/` and the user wants to preserve the full prefix through a failure turn, stop here and use `ms-derivation-episode-replay`. This skill is for the older one-side guided-discovery replay harness, not the derivation episode CLI.

Read the user's request for a source run directory (for example
`exports/oedipus-d5-full/run3`), an arm (`socratic`/`none`/`reveal`), and
optional side (only `learner` is wired), repeats (the script default is 1),
generator (the script default is `mock`), and model. Read the current source
run and provider registry rather
than assuming a historical model example is still appropriate. The default
spec is `config/poetics-calibration/oedipus-pilot-v2.yaml`; infer the `D_OED*`
scenario from the source files or ask.

## 1. Locate the source directorPlan (fidelity is load-bearing)

A faithful replay MUST reuse the **source run's** directorPlan — regenerating it = a different scene = a confounded result. Find it, in this order:

```bash
# preferred: persisted per-run (generation writes this since the persistence change)
ls <run-dir>/director-<arm>.json
# fallback: the salvaged full trace (discover the actual transcript id)
find <run-dir>/transcripts/<arm> -maxdepth 1 -name '*.full.md' -print
```

If neither exists, the plan was clobbered (the volatile `config/poetics-calibration/phase2-transcripts-*/` dir is overwritten each generation). In that case STOP and tell the user the run is not faithfully replayable — offer to regenerate it (generation now persists the plan) rather than replay with a fresh director.

## 2. Mock replay only

Resolve the exact source transcript from the saved artifacts; do not assume
`T01`. Validate every path, scenario, side, repeat count, and generator before
execution. Then run a one-repeat mock plumbing check:

```bash
node scripts/replay-one-side.js \
  --director-plan <resolved-director-plan> \
  --source-transcript <resolved-source-transcript> \
  --spec config/poetics-calibration/oedipus-pilot-v2.yaml --scenario <D_OED id> \
  --side learner --generator mock --repeats 1 \
  --out exports/replay-<id>-<run>-<arm>
```

Do not use a real generator from this skill. The replay runner has retries but
no enforced aggregate attempt ceiling.

## 3. Panel scoring is a separate blocked action

```bash
# Do not run by default. The script invokes a multi-model panel with retries and
# currently has no independently enforced panel-call ceiling.
```

## 4. Read the distribution (the whole point)

On the 0–4 ladder (`notes/poetics/2026-06-01-oedipus-discovery-grade-rubric.md`):
- **Tight cluster / unanimous band** (e.g. all ~2) → results are consistent
  with a cap under this scene, learner model, and replay design; they do not
  prove a universal structural cap.
- **Wide / bimodal** (some 2, some 4) → a **learner draw** the scene only sometimes resolves; the cap isn't structural.

Report the histogram, mean/median, and which reading it supports — that is the answer to "structural vs draw."

## Notes

- `--side tutor` is not yet wired (needs a symmetric `scriptedLearnerTurns` hook in the engine); v1 is learner-only.
- Works for any guided-discovery scenario with a `secret` block, not just D_OED5.
- The engine hook is guarded (`scriptedTutorTurns`); normal generation is unaffected.
