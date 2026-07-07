# Handoff: Adaptation To Recognition Loop

Date: 2026-05-27

Audience: Codex or Claude continuing after this chat is lost.

## Current Branch State

Branch: `main`

Latest pushed commit before this handoff work:

- `d3079cd Add gated adaptation recognition loop`

Do not assume a clean worktree. At handoff time there were unrelated dirty
changes that were not part of this loop work:

- `CLAUDE.md` modified
- `notes paper-2-0/gemini-analysis-of-paper-2-0.md` renamed to
  `notes/2026-03-04-gemini-analysis-of-paper-2-0.md`

Leave those alone unless the user explicitly asks to include them.

## What Was Just Changed

The peripeteia branch was tightened after a completed loop showed that public
tutor mechanism change and learner action were still not enough to force stable
recognitive reorientation.

Changed files:

- `scripts/generate-pedagogical-dramas.js`
- `scripts/critic-poetics-structure.js`
- `tests/criticPoeticsStructure.test.js`
- `notes/poetics/2026-05-27-adaptation-loop-results.md`
- `notes/poetics/2026-05-26-paper-to-dramatic-recognition-arc.md`
- `notes/poetics/2026-05-26-paper-to-dramatic-recognition-arc.html`
- this handoff note
- three archive manifests under `config/poetics-calibration/runs/`

Substantive code change:

1. The generator now tells peripeteia learners to use explicit old-check /
   pressure / replacement-check language after performing the new device.
2. The deterministic structure critic now requires both a pressure or old-check
   frame and a replacement-check frame before a peripeteia arm can pass cheap
   structure validation.

Verification already run:

```bash
node --test tests/generatePedagogicalDramas.test.js tests/criticPoeticsStructure.test.js tests/runPoeticsAdaptationLoop.test.js
```

Result: pass, 98 tests.

## Completed Evidence Loop

Command:

```bash
npm run poetics:adaptation-loop -- --max-iterations 3 --required-passes 2 --skip-existing-scores
```

Completed loop stamp:

```text
phase2-adaptation-recognition-loop-20260527T105617Z
```

Status files:

- `exports/phase2-adaptation-recognition-loop-20260527T105617Z-loop-status.md`
- `exports/phase2-adaptation-recognition-loop-20260527T105617Z-loop-status.json`

Outcome:

- status: failed
- required passes: 2
- actual passes: 1
- iteration 1: pass, 9/9 items
- iteration 2: fail, 6/9 items
- iteration 3: fail, 6/9 items

Interpretation:

- controls mostly hold;
- branch-valid tutor adaptation exists;
- recognitive closure downstream of peripeteia is not repeat-stable;
- the weak link is the learner's final action-to-re-reading bridge.

## Paused Loop

After tightening the generator and structure critic, a new loop was started:

```text
phase2-adaptation-recognition-loop-20260527T135413Z
```

It was stopped at the user's request during the first shared-prefix generation.
No scoring or ingest completed. Treat any partial artifacts from this stamp as
non-evidence.

Confirm no loop is still running before continuing:

```bash
ps -axo pid,ppid,stat,command | rg 'run-poetics-adaptation-loop|run-poetics-production-batch|generate-pedagogical-dramas|codex exec'
```

## How To Continue

Start by syncing and verifying the handoff commit:

```bash
git pull
git status --short --branch
node --test tests/generatePedagogicalDramas.test.js tests/criticPoeticsStructure.test.js tests/runPoeticsAdaptationLoop.test.js
```

Then run exactly one bounded loop:

```bash
npm run poetics:adaptation-loop -- --max-iterations 3 --required-passes 2 --skip-existing-scores
```

Do not broaden the target set yet. Keep:

- targets: D42, D50, D53
- arms: `routine`, `none`, `peripeteia-only`
- termination: two passes within three iterations

When the loop finishes, inspect:

```bash
ls -t exports/*adaptation-recognition-loop*loop-status.md | head
sed -n '1,220p' "$(ls -t exports/*adaptation-recognition-loop*loop-status.md | head -1)"
```

If it gets two passes, package each completed iteration:

```bash
npm run poetics:package-run -- --run-id <RUN_ID>
```

Commit only the manifest(s), notes, and any deliberate source/test changes. Do
not commit generated raw artifacts.

If it fails again for critic splits or organic/ambiguous peripeteia origin, stop
the loop. The next work is mechanism design, not more generations. Inspect the
failed `peripeteia-only` public scripts and ask whether the final learner turn
explicitly names:

1. the performed device;
2. the old check or pressure;
3. the replacement check.

## Archive And Backup Policy

The repository solution is now:

- raw generated transcripts, deliberations, samples, scores, structure-critic
  outputs, and per-run keys stay out of Git;
- compressed run bundles live under `artifacts/poetics-runs/`, which is ignored;
- small manifests live under `config/poetics-calibration/runs/` and are committed.

Already packaged local archive dirs:

- `artifacts/poetics-runs/phase2-adaptation-recognition-loop-20260527T105617Z-i01`
- `artifacts/poetics-runs/phase2-adaptation-recognition-loop-20260527T105617Z-i02`
- `artifacts/poetics-runs/phase2-adaptation-recognition-loop-20260527T105617Z-i03`

Already created manifests:

- `config/poetics-calibration/runs/phase2-adaptation-recognition-loop-20260527T105617Z-i01.manifest.json`
- `config/poetics-calibration/runs/phase2-adaptation-recognition-loop-20260527T105617Z-i02.manifest.json`
- `config/poetics-calibration/runs/phase2-adaptation-recognition-loop-20260527T105617Z-i03.manifest.json`

Before deleting this worktree, copy the ignored archive dirs to durable storage
outside Git. The remote repository will preserve only the manifests, not the
archive payloads.

The GitHub release workflow is documented in
`notes/poetics/2026-05-27-poetics-run-archive-workflow.md`. Use:

```bash
npm run poetics:publish-run -- --run-id <RUN_ID> --dry-run
```

This repository is public, so live uploads of raw transcripts/traces require
`--allow-public`; otherwise use a private artifact target.

## Claim Boundary

Do not claim that the mechanical adaptive tutor is complete.

Current defensible claim:

> Branch-valid tutor peripeteia can produce recognitive reframe in clean
> low-organic anchors, and one full gated iteration passed. The effect is not yet
> repeat-stable across D42/D50/D53. The next architecture problem is making
> learner action reliably become explicit re-reading of the prior difficulty.

This is a productive stopping point for the broad generation phase. The system
has become a mechanism-discovery apparatus, and the remaining work is to promote
the learned mechanism into a durable state/action/outcome control loop.
