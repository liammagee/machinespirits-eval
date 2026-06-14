---
name: ms-derivation-episode-replay
description: Use dramatic derivation episode replay to resume a saved `run-derivation-loop.js` result from a frozen transcript prefix. Trigger when debugging selector/pacing/guard failures, trying a small policy/script change from a failure turn, preserving turns before an unexpected aporia/disengagement/overreach/lucky-leap, or accelerating current dramatic derivation runs without paying to regenerate the whole prefix.
allowed-tools: Bash, Read, Grep
---

Use `scripts/run-derivation-episode.js` to replay a saved dramatic derivation prefix exactly and resume live at a chosen turn. This is for local mechanism triage, not final evidence. It answers: "if everything through turn N-1 is identical, does this policy/script change repair the failure?"

Argument shape: `<failed-label|run-dir> --turn N [--window K] [--real] [guard/script overrides]`.

## Safety

- Do not disturb live jobs. Check first:
  ```bash
  ps -axo pid,ppid,stat,etime,command | rg 'run-derivation-(loop|codex-learner-selector-probe)|selector-' | rg -v ' rg '
  ```
- Use a completed source run with `result.json` and `diagnosis.json` under `exports/dramatic-derivation/loop/<label>/` or `exports/dramatic-derivation/episodes/<label>/`.
- Do not change `--world`; the episode CLI refuses it because replaying role outputs into another world is undefined.
- The episode CLI defaults to mock. Pass `--real` only when the user has explicitly asked to spend or the current task already authorizes paid real runs.
- Treat episodes as counterfactual debugging artifacts. A repaired episode is a candidate fix, not held-out selector evidence. Promote it to a fresh first-pass loop/fan before making claims.

## Choose the Turn

- `--turn N` means turn `N` is the first live/generated turn.
- To preserve dialogue through the failure turn itself, set `--turn failureTurn + 1`.
- To change the policy at the point where failure begins, set `--turn failureTurn`.
- Use a short `--window` first, usually `4` to `8`. Increase only if the repair reaches the edge with `windowExhausted: true`.

## Run an Episode

For a selector/pacing policy adjustment:

```bash
node scripts/run-derivation-episode.js \
  --from exports/dramatic-derivation/loop/<failed-label> \
  --turn <first-live-turn> \
  --window 6 \
  --real \
  --pacing-guard-selective-v1 off \
  --pacing-guard-selective-v2 on \
  --label <failed-label>-v2-from-t<turn> \
  --out exports/dramatic-derivation/episodes
```

For a tutor-script adjustment:

```bash
node scripts/run-derivation-episode.js \
  --from exports/dramatic-derivation/loop/<failed-label> \
  --turn <first-live-turn> \
  --window 6 \
  --real \
  --script config/drama-derivation/tutor-scripts/<candidate>.md \
  --label <failed-label>-scriptfix-from-t<turn>
```

For a free plumbing check, omit `--real`; the source prefix still replays and the suffix uses mock roles.

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
4. If the episode fixes the local failure and `prefixIntegrity.ok` is true, run a fresh first-pass full loop under a new label. Do not overwrite the original selector result.
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
