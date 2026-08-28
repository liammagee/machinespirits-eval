---
name: ms-derivation-episode-replay
description: Replay a completed dramatic-derivation prefix with an explicitly mocked suffix to debug selector, pacing, guard, or script behavior. Real suffix generation is blocked because the episode runner does not yet inherit and enforce the source run's model routes and attempt ceiling.
---

Use `scripts/run-derivation-episode.js` to replay a saved dramatic derivation
prefix and exercise a mocked suffix at a chosen turn. This is local mechanism
triage, not final evidence.

Argument shape: `<failed-label|run-dir> --turn N [--window K] [guard/script overrides]`.

## Safety

- Do not disturb live jobs. Check first:
  ```bash
  ps -axo pid,ppid,stat,etime,command | rg 'run-derivation-(loop|codex-learner-selector-probe)|selector-' | rg -v ' rg '
  ```
- Use a completed source run with `result.json` and `diagnosis.json` under `exports/dramatic-derivation/loop/<label>/` or `exports/dramatic-derivation/episodes/<label>/`.
- Do not change `--world`; the episode CLI refuses it because replaying role outputs into another world is undefined.
- Force `DERIVATION_LLM=mock` in the command. An ambient
  `DERIVATION_LLM=real` can otherwise make a suffix real even without
  `--real`.
- Do not use `--real`. The runner currently resolves environment routes rather
  than inheriting and pinning `diagnosis.backend.roles`, and it exposes no
  enforced episode attempt ceiling. A real result would not be the claimed
  single-variable replay.
- Treat episodes as counterfactual debugging artifacts. A repaired episode is a candidate fix, not held-out selector evidence. Promote it to a fresh first-pass loop/fan before making claims.

## Choose the Turn

- `--turn N` means turn `N` is the first live/generated turn.
- To preserve dialogue through the failure turn itself, set `--turn failureTurn + 1`.
- To change the policy at the point where failure begins, set `--turn failureTurn`.
- Use a short `--window` first, usually `4` to `8`. Increase only if the repair reaches the edge with `windowExhausted: true`.

## Run an Episode

For a selector/pacing policy adjustment:

```bash
DERIVATION_LLM=mock node scripts/run-derivation-episode.js \
  --from exports/dramatic-derivation/loop/<failed-label> \
  --turn <first-live-turn> \
  --window 6 \
  --pacing-guard-selective-v1 off \
  --pacing-guard-selective-v2 on \
  --label <failed-label>-v2-from-t<turn> \
  --out exports/dramatic-derivation/episodes
```

For a tutor-script adjustment:

```bash
DERIVATION_LLM=mock node scripts/run-derivation-episode.js \
  --from exports/dramatic-derivation/loop/<failed-label> \
  --turn <first-live-turn> \
  --window 6 \
  --script config/drama-derivation/tutor-scripts/<candidate>.md \
  --label <failed-label>-scriptfix-from-t<turn>
```

Every supported episode is a free plumbing check: the source prefix replays
and the suffix uses explicitly mocked roles.

## Verify the Prefix

Read:

```bash
jq '.episode.prefixIntegrity, .verdict, .turnsPlayed, .firstForcedTurn, .assertedGroundedTurn' \
  exports/dramatic-derivation/episodes/<episode-label>/diagnosis.json
```

Interpretation:

- `prefixIntegrity.ok == true`: the formal prefix matched the source run. The suffix difference is attributable to the live-region change.
- `ok == false` and `expectedDivergence == true`: acceptable only when you deliberately changed a condition that reaches back into the prefix, such as decay start/config or acts mode.
- `ok == false` and `expectedDivergence == false`: invalid episode. Do not interpret the result; inspect mismatches.

Useful artifact paths:

```bash
exports/dramatic-derivation/episodes/<episode-label>/episode.json
exports/dramatic-derivation/episodes/<episode-label>/diagnosis.json
exports/dramatic-derivation/episodes/<episode-label>/result.json
exports/dramatic-derivation/episodes/<episode-label>/transcript.md
```

## Current Selector/Derivation Workflow

When a live selector run produces an unexpected failure:

1. Wait for the target label to finish; do not replay from a partial artifact.
2. Identify the earliest material failure turn from `diagnosis.json`/log tail: aporia, disengagement, overreach burst, lucky leap, visible false-block, or the first turn where `D` stops recovering.
3. Run one short episode from just before that turn using the candidate policy/script change.
4. If the episode fixes the local failure and `prefixIntegrity.ok` is true,
   report the candidate repair and stop. A fresh full loop is a separate
   model-backed action requiring its own current authority and bounded route.
5. If the episode also fails, inspect the transcript around `--turn`; avoid taxonomy creep. Classify the failure as route failure, guard brittleness, implementation artifact, or world/learner-stack instability.

## Report

Report only high-signal fields:

- source label and episode label
- first live turn and window
- overrides
- `prefixIntegrity`
- verdict, turns, final D, forced/asserted gap
- whether the episode repaired the local failure
- caveat that this is a prefix-controlled debugging replay, not independent evidence
