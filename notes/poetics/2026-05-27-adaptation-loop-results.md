# Adaptation Recognition Loop Results

Date: 2026-05-27

## Gate Definition

The gated loop tests D42, D50, and D53 under `routine`, `none`, and
`peripeteia-only` arms. A loop iteration passes only if controls stay negative,
`peripeteia-only` gets at least 3/4 recognition votes, at least 3 critics classify
the origin as `peripeteia_induced`, at least 3 critics see learner actional
breakthrough, and the deterministic adaptation sidecar marks branch-valid tutor
peripeteia.

Critics:

- `qwen/qwen3.7-max`
- `google/gemini-3.5-flash`
- `deepseek/deepseek-v4-pro`
- `anthropic/claude-sonnet-4.6`

## Completed Loop

Command:

```bash
npm run poetics:adaptation-loop -- --max-iterations 3 --required-passes 2 --skip-existing-scores
```

Loop stamp: `phase2-adaptation-recognition-loop-20260527T105617Z`

Status artifact:

- `exports/phase2-adaptation-recognition-loop-20260527T105617Z-loop-status.md`
- `exports/phase2-adaptation-recognition-loop-20260527T105617Z-loop-status.json`

Result: failed the termination rule, with 1 pass out of 2 required.

| iteration | pass | passed items | failures |
|---:|---:|---:|---|
| `phase2-adaptation-recognition-loop-20260527T105617Z-i01` | yes | 9/9 | none |
| `phase2-adaptation-recognition-loop-20260527T105617Z-i02` | no | 6/9 | `organic_or_ambiguous_recognition:1`, `quality_warning:1`, `insufficient_scores:2`, `scorer_error:1` |
| `phase2-adaptation-recognition-loop-20260527T105617Z-i03` | no | 6/9 | `critic_split:2`, `organic_or_ambiguous_recognition:2`, `scorer_error:1`, `insufficient_scores:1` |

## Reading

The mechanism is not absent. Iteration 1 was a full clean pass: all controls
held, and all three `peripeteia-only` arms passed the recognition, origin,
action, and branch-validity gates.

It is not yet robust. Iteration 2 failed mostly through hygiene and coverage:
D42 routine leaked a no-cue learner reframe warning, and D50 none lost coverage
to a DeepSeek scorer error. Iteration 3 had cleaner controls but exposed the
central weakness: the `peripeteia-only` endings often produced actional
performance without enough explicit learner re-reading for Gemini/Sonnet/DeepSeek
to converge.

The current conclusion is therefore:

> Branch-valid tutor peripeteia can produce recognitive reframe in clean
> low-organic anchors, but we do not yet have repeat-stable evidence that
> adaptation reliably produces recognition across D42/D50/D53.

The practical blocker is the action-to-re-reading bridge. The tutor can change
the public mechanism; the learner can perform the new device; the final learner
turn still sometimes sounds like successful procedure rather than recognitive
reorientation.

## Follow-Up Changes Made

After the 10:56 loop, the generator and structural critic were tightened again.

The peripeteia learner branch now asks for explicit sentence-stem structure:

1. perform the new device on the current task;
2. say what the old check or pressure was;
3. say what the replacement check is now.

The rules structural critic now rejects peripeteia arms unless the post-tutor
learner turn contains both a pressure/old-check frame and a replacement-check
frame. This is intentionally stricter than the previous detector: procedural
success alone is no longer enough to reach external scoring.

Focused tests passed after this change:

```bash
node --test tests/generatePedagogicalDramas.test.js tests/criticPoeticsStructure.test.js tests/runPoeticsAdaptationLoop.test.js
```

## Paused Follow-Up Loop

A follow-up loop using the stricter contract was started and then stopped at the
user's request before any scoring completed:

- run stamp: `phase2-adaptation-recognition-loop-20260527T135413Z`
- stopped during iteration 1 shared-prefix generation
- no gate status was produced
- no poetics DB ingest was completed

Any partial ignored artifacts under
`config/poetics-calibration/phase2-adaptation-recognition-loop-20260527T135413Z-i01`
can be ignored or deleted. They are not evidence.

## Archive Status

The three completed 10:56 iterations were packaged with:

```bash
npm run poetics:package-run -- --run-id phase2-adaptation-recognition-loop-20260527T105617Z-i01
npm run poetics:package-run -- --run-id phase2-adaptation-recognition-loop-20260527T105617Z-i02
npm run poetics:package-run -- --run-id phase2-adaptation-recognition-loop-20260527T105617Z-i03
```

Local ignored archive directories:

- `artifacts/poetics-runs/phase2-adaptation-recognition-loop-20260527T105617Z-i01`
- `artifacts/poetics-runs/phase2-adaptation-recognition-loop-20260527T105617Z-i02`
- `artifacts/poetics-runs/phase2-adaptation-recognition-loop-20260527T105617Z-i03`

Tracked manifests:

- `config/poetics-calibration/runs/phase2-adaptation-recognition-loop-20260527T105617Z-i01.manifest.json`
- `config/poetics-calibration/runs/phase2-adaptation-recognition-loop-20260527T105617Z-i02.manifest.json`
- `config/poetics-calibration/runs/phase2-adaptation-recognition-loop-20260527T105617Z-i03.manifest.json`

The manifests belong in Git. The archive directories must be copied to durable
external storage before deleting this worktree; they are intentionally ignored
and will not be pushed to the remote.
