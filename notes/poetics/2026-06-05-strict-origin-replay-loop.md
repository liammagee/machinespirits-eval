# Strict-Origin Discursive Replay Loop

Date: 2026-06-05

## Run

Command:

```bash
npm run poetics:replay-loop -- \
  --item-id "phase2-adaptation-recognition-loop-20260527T044802Z-i01:target-r01:routine:T24,phase2-adaptation-recognition-loop-20260528T022408Z-i03:target-r01:none:T24,phase2-adaptation-recognition-loop-20260529T023023Z-i01:target-r01:none:T18" \
  --max-iterations 3 \
  --run-label discursive-replay-loop-strict-origin-heldout-20260605 \
  --policy-memory exports/discursive-replay-lessons/heldout-revise-again-20260605/policy-memory.md \
  --critic-concurrency all \
  --score-concurrency 1
```

Artifacts, ignored by repo policy:

- `exports/discursive-replay-loops/discursive-replay-loop-strict-origin-heldout-20260605/manifest.json`
- `exports/discursive-replay-lessons/strict-origin-heldout-20260605/policy-memory.md`

## Result

The capped loop ran 3 iterations and stopped at `max_iterations`.

- Completed: 0
- Final pending: 3
- Policy memory injected: yes
- Origin gate: enabled, majority threshold
- Critics: default five-critic panel, concurrent

Final pending items:

- `phase2-adaptation-recognition-loop-20260528T022408Z-i03:target-r01:none:T24`
- `phase2-adaptation-recognition-loop-20260529T023023Z-i01:target-r01:none:T18`
- `phase2-adaptation-recognition-loop-20260527T044802Z-i01:target-r01:routine:T24`

## Key Finding

The strict-origin panel gate did its intended work. It separated recognitive form from tutor-induced adaptation evidence.

The `routine:T24` rewrite reached the panel twice and both times showed the same pattern:

```text
recognitionVotes: 5/5
peripeteia originVotes: 2/5
status: panel_origin_fail
originCounts: peripeteia_induced=2, organic=3
```

This is a recognitive-form survivor, not a peripeteia-induced adaptation survivor.

## Diagnosis

The panel critics were not rejecting recognition. They were rejecting origin attribution.

Codex, Gemini, and DeepSeek generally accepted that the transcript contained a public device or test, but did not credit enough stock-taking contrast. In their scores, the tutor move looked useful but not clearly caused by a peripeteia-linked strategic reversal. Claude and Qwen were more willing to infer induction.

The local gate also kept the two `none` items mostly below panel escalation because of temporal-ledger and self-reframe scoping warnings. Some of those warnings look advisory rather than blocking:

- temporal ledger entries overclaiming what is publicly owned by a turn
- self-reframe fields appearing before the learner fully owns the contrast
- tactic labels that are imprecise but do not invalidate the public transcript

## Claim Boundary

This run supports a methodological claim only:

> The stricter gate can prevent recognitive-form success from being promoted into peripeteia-induced adaptation evidence.

It does not support a claim of reliable peripeteia-induced adaptation.

## Next Move

Tighten the local gate so checker findings are separated into:

- blocking failures that prevent panel escalation
- advisory warnings that are recorded but do not block panel escalation

Then rerun only the three final pending items. The target is not broader generation yet; it is to determine whether the remaining bottleneck is local-gate overblocking or the stricter origin gate itself.
