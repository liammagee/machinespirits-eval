# Phase 5c Conduct-Policy Ravensmark Diagnostic Pair

Date: 2026-06-16 UTC

Status: paid first-pass pair, real role calls, no crash recovery, no rerolls.

This pair follows the Phase 5b Withercombe diagnostic add-on after the
final-turn priority fix. It tests whether conduct-policy enforcement improves
selector-v4 visible-consolidation behavior on a different world without
negative transfer.

## Arms

- S0 logging: `--pacing-guard-selective-v4 --proof-debt-guard --conduct-policy`
- S1 enforcement: S0 plus `--conduct-policy-enforce`

Shared substrate:

- world: `config/drama-derivation/world-009-ravensmark.yaml`
- script: `config/drama-derivation/tutor-scripts/ravensmark-v001.md`
- group: `phase5c-conduct-ravensmark-diagnostic-v4`
- decay: `{"rate":0,"graceTurns":1,"maxConcurrent":2,"startTurn":1,"mutateShare":0,"seed":1,"pool":"staged"}`
- common run flags: `--real --superego --acts '{"minActTurns":3,"maxActTurns":8}' --confront --repair-clause --release-authority --plot --throughline --critic-feedback off --critic off`

Logs:

- `exports/dramatic-derivation/phase5c-conduct-policy-run-logs/`

Artifacts:

- `exports/dramatic-derivation/loop/phase5c-conduct-ravensmark-diagnostic-v4-zerodecay-s0-r1/`
- `exports/dramatic-derivation/loop/phase5c-conduct-ravensmark-diagnostic-v4-zerodecay-s1-r1/`

## Result Table

| Arm | Label | Verdict | Turns | Final D | Forced | Asserted | Gap | Overreach | Lucky leap | Fabricated facts | Conduct pass | Enforcement changed |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| S0 logging | `phase5c-conduct-ravensmark-diagnostic-v4-zerodecay-s0-r1` | `grounded_anagnorisis` | 13 | 0 | 13 | 13 | 0 | 0 | 0 | 0 | 8/12 | n/a |
| S1 enforce | `phase5c-conduct-ravensmark-diagnostic-v4-zerodecay-s1-r1` | `grounded_anagnorisis` | 13 | 0 | 13 | 13 | 0 | 0 | 0 | 0 | 12/12 | 2 |

D curve in both arms:

```text
2->2->2->1->1->1->1->1->1->1->1->1->0
```

## Conduct Policy

Both arms selected the same conduct families:

- `ask_diagnostic`: 9 turns, all `visible_hidden_conflict`
- `release_next_evidence`: 3 turns, all `release_candidate_certified`

S0 failures:

- t2 `ask_diagnostic` on `m_steward` was realized as `consolidate`.
- t3 `ask_diagnostic` on `m_steward` was realized as `consolidate`.
- t6 `ask_diagnostic` on `m_key` was realized as `consolidate`.
- t7 `ask_diagnostic` on `m_key` was realized as `consolidate`.

S1 enforcement:

- t2 `ask_diagnostic` on `m_steward` was rewritten to:
  `Pause there. What in the public record licenses that next step?`
- t6 `ask_diagnostic` on `m_key` was rewritten to the same public-record test.
- No post-enforcement conduct failures.
- No final-turn over-diagnosticization: the final t13 move remained a
  `release_next_evidence` closure for `p_registry`, not an `ask_diagnostic`.

## Release Behavior

Both arms had the same release-adherence profile:

- 4 on-cue releases
- 1 early release
- 0 missed releases
- 0 unscheduled releases

The early release was `p_registry`, planned at t15 and played at t13. In both
arms, release authority accepted it two turns early because the learner had
already named the missing custody line and could join law, mark, and holder.

## Interpretation

This is a clean positive diagnostic for enforcement in the selector-v4
visible-consolidation regime:

1. Enforcement improved local conduct compliance from 8/12 to 12/12.
2. It changed two concrete early `ask_diagnostic` failures into concise public
   diagnostic prompts.
3. It did not change final grounding, turn count, forced/asserted gap,
   overreach, lucky-leap, fabricated-fact, or release-deviation outcomes.
4. The final-turn priority fix held: a final eligible release/closure was not
   converted into another diagnostic detour.

This supports promoting conduct enforcement only as a selector-v4
visible-consolidation clamp. It still does not justify making enforcement the
general hidden + proofDebt default.

## Commands

The runner used the paid stack:

```bash
DERIVATION_PROVIDER=codex
DERIVATION_LEARNER_PROVIDER=claude
DERIVATION_LEARNER_MODEL=sonnet
DERIVATION_CLI_TIMEOUT_MS=900000
DERIVATION_LLM=real
DERIVATION_TRACE=0
```

S0 command shape:

```bash
node scripts/run-derivation-loop.js \
  --world config/drama-derivation/world-009-ravensmark.yaml \
  --script config/drama-derivation/tutor-scripts/ravensmark-v001.md \
  --out exports/dramatic-derivation/loop \
  --group phase5c-conduct-ravensmark-diagnostic-v4 \
  --real \
  --superego \
  --acts '{"minActTurns":3,"maxActTurns":8}' \
  --decay '{"rate":0,"graceTurns":1,"maxConcurrent":2,"startTurn":1,"mutateShare":0,"seed":1,"pool":"staged"}' \
  --confront \
  --repair-clause \
  --release-authority \
  --plot \
  --throughline \
  --critic-feedback off \
  --critic off \
  --pacing-guard-selective-v4 \
  --proof-debt-guard \
  --conduct-policy \
  --label phase5c-conduct-ravensmark-diagnostic-v4-zerodecay-s0-r1
```

S1 added:

```bash
--conduct-policy-enforce
```

## Caveats

- This is still one additional world, first pass only.
- It is diagnostic evidence for selector-v4 visible-consolidation enforcement,
  not a broad proof that conduct enforcement should be globally defaulted.
- Raw logs and loop artifacts are under ignored `exports/` paths; this compact
  report preserves the key evidence.
