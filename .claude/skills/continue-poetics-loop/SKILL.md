---
name: continue-poetics-loop
description: Run exactly one bounded poetics adaptation-recognition loop (D42/D50/D53, three iterations, two required passes) following the canonical handoff workflow. Use when continuing the poetics arc from a prior session.
argument-hint: "[--targets D42,D50,D53] [--iterations 3] [--passes 2]"
disable-model-invocation: true
allowed-tools: Bash, Read
---

Run one bounded gated adaptation-recognition loop, following the literal handoff in `notes/poetics/2026-05-27-handoff-adaptation-recognition-loop.md`. This skill has side effects (paid OpenRouter API calls and writes to the live poetics sidecar DB), so it is user-only.

## Defaults (do not broaden without explicit user instruction)

- targets: `D42,D50,D53`
- arms: `routine,none,peripeteia-only`
- iterations: `3`
- required passes: `2`

The handoff is explicit: do not broaden the target set until the focused loop either passes or diagnostically saturates.

## Steps

### 1. Confirm no loop is currently running

```bash
ps -axo pid,ppid,stat,command | rg 'run-poetics-adaptation-loop|run-poetics-production-batch|generate-pedagogical-dramas|codex exec' | rg -v ' rg ' || echo "no loop running"
```

If a loop IS running, STOP. Tell the user and exit — do not start a parallel loop.

### 2. Sync the branch and run the focused-tests gate

```bash
git pull
git status --short --branch
node --test tests/generatePedagogicalDramas.test.js tests/criticPoeticsStructure.test.js tests/runPoeticsAdaptationLoop.test.js
```

If tests fail, STOP and report — do not run the loop on a broken contract.

### 3. Run exactly one bounded loop

```bash
npm run poetics:adaptation-loop -- --max-iterations 3 --required-passes 2 --skip-existing-scores
```

This may take a long time (multiple iterations × generation + critic-panel scoring). Stream output. The loop writes a stamp like `phase2-adaptation-recognition-loop-<TIMESTAMP>Z` and persists status to `exports/<stamp>-loop-status.{md,json}`.

### 4. Inspect status

```bash
ls -t exports/*adaptation-recognition-loop*loop-status.md | head -3
latest=$(ls -t exports/*adaptation-recognition-loop*loop-status.md | head -1)
sed -n '1,220p' "$latest"
```

Summarise to the user:
- overall pass / fail
- per-iteration pass count (e.g. "1/2 passes")
- failure classes if any (`organic_or_ambiguous_recognition`, `quality_warning`, `critic_split`, `insufficient_scores`, `scorer_error`)

### 5. If the loop passes, package each completed iteration

For each iteration that passed:

```bash
npm run poetics:package-run -- --run-id <RUN_ID>
```

This archives raw artifacts to `artifacts/poetics-runs/<RUN_ID>/` (gitignored) and writes a small manifest to `config/poetics-calibration/runs/<RUN_ID>.manifest.json` (committable).

Confirm with the user before committing — they may want to inspect first.

### 6. If the loop fails

Use the `poetics-loop-diagnostician` subagent on the failed iteration's status artifact:

```text
Agent({ subagent_type: "poetics-loop-diagnostician", prompt: "Diagnose <RUN_ID>" })
```

If the same failure class has appeared for 3 consecutive iterations, STOP and recommend mechanism / prompt surgery per the handoff termination rule — do not just rerun.

## Critical rules

- **Never `--force` re-run a loop that produced evidence**; package and commit the manifest first.
- **Never broaden targets** without explicit user instruction; the gated-loop discipline is the whole point.
- **Never claim "the mechanical adaptive tutor is complete"** based on a single passing iteration. The defensible claim is in the handoff: branch-valid tutor peripeteia can produce recognitive reframe in clean low-organic anchors; one full gated iteration passed; not yet repeat-stable.
- **Archive payloads stay out of git**; only the manifests get committed. The user must copy `artifacts/poetics-runs/<RUN_ID>/` to durable external storage before deleting the worktree.
