# Hethel Promoted-v4 ProofDebt Fresh First Pass

Date: 2026-06-16

## Purpose

Test whether the current promoted selector-v4 plus proofDebt stack can survive
the Hethel hidden-hurts fixture outside prefix replay. This was a fresh
first-pass run, not an episode replay.

## Command

```bash
DERIVATION_PROVIDER=codex \
DERIVATION_LEARNER_PROVIDER=claude \
DERIVATION_LEARNER_MODEL=sonnet \
DERIVATION_CLI_TIMEOUT_MS=900000 \
DERIVATION_LLM=real \
DERIVATION_TRACE=0 \
node scripts/run-derivation-loop.js \
  --world config/drama-derivation/world-006-hethel.yaml \
  --script config/drama-derivation/tutor-scripts/hethel-v001.md \
  --label hethel-promoted-v4-proofdebt-r1 \
  --out exports/dramatic-derivation/loop \
  --group hethel-promoted-v4-proofdebt \
  --real \
  --superego \
  --acts '{"minActTurns":3,"maxActTurns":8}' \
  --decay '{"rate":0.75,"graceTurns":1,"maxConcurrent":2,"startTurn":1,"mutateShare":1.0,"seed":1,"pool":"staged"}' \
  --confront \
  --repair-clause \
  --release-authority \
  --plot \
  --throughline \
  --critic-feedback off \
  --critic off \
  --logic-projection \
  --pacing-guard-selective-v4 \
  --proof-debt-guard
```

Artifacts:

- `exports/dramatic-derivation/loop/hethel-promoted-v4-proofdebt-r1/result.json`
- `exports/dramatic-derivation/loop/hethel-promoted-v4-proofdebt-r1/diagnosis.json`
- `exports/dramatic-derivation/loop/hethel-promoted-v4-proofdebt-r1/transcript.md`

## Result

| label | world | arm | verdict | turns | final D | forced | asserted | gap | selected | fabricated | overreach | lucky leap |
|---|---|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|
| `hethel-promoted-v4-proofdebt-r1` | Hethel | promoted selector-v4 + proofDebt | grounded_anagnorisis | 20/26 | 0 | 20 | 20 | 0 | hidden | 0 | 0 | 0 |

D curve:

```text
5->5->5->4->4->4->4->4->3->3->3->3->2->2->1->1->1->1->1->0
```

## Mechanism Notes

Selector-v4 selected hidden:

- `selected`: `hidden`
- `selectedFlag`: `--pacing-guard-selective-v4`
- gate: `hidden_default_visible_consolidation_assertion_gate`
- rejected: `visible_release_acceleration`
- mirror-dead-predicate decoy present: `builtUnder(hethelSpan, reyner)`,
  `liableFor(hethelSpan, reyner)`

ProofDebt fired once and repaired `p_point` at turn 6:

- detected turns: 1
- debts detected: 1
- restored moves: 1
- repaired targets: `p_point`

Conduct policy was active under promoted selector-v4:

- checked: 18
- passed: 18
- failed: 0
- enforcement applied: 4/20
- enforced changes: t2, t8, t13, t20, all `ask_diagnostic` under
  `visible_hidden_conflict`

Release adherence:

- on cue: 7/8
- one early release: `p_brand`, planned t17, actual t15
- no missed or unscheduled releases

Decay/repair:

- decay events: 3
- repaired: 1
- unrepaired at end: 2
- D reversals: 0
- final theory fidelity: 0.833

Events:

```json
{
  "plot": 4,
  "throughline": 1,
  "decay": 3,
  "act_end": 3,
  "plot_audit": 4,
  "repair": 1,
  "forced": 1,
  "grounded_anagnorisis": 1
}
```

Usage telemetry reported 89 calls but zero token/cost totals because this CLI
role path does not currently report provider token usage.

## Interpretation

The fresh run neutralizes the old Hethel first-pass negative-transfer concern
for the current stack: promoted selector-v4 plus proofDebt grounded from
scratch with gap 0 and without fabrication, overreach, or lucky leap.

This does not show that adaptive H/V representation selection works. The
selector still chose hidden even though the mirror-dead-predicate decoy was
present, and it explicitly rejected visible release acceleration. The result is
better read as evidence that proofDebt plus release authority and the promoted
conduct clamp can absorb the old visible benefit in this fixture.

The immediate policy implication is narrow: the reliability baseline is now
hidden proof continuity plus proofDebt plus promoted conduct enforcement. If the
project still needs a genuine adaptive-selector claim, that requires a separate
v5 diagnostic route or a newly frozen V-positive fixture; it should not be
inferred from this run.

## Caveats

- Single first-pass run.
- No static-arm rerun was conducted in this increment.
- The original Hethel V-positive signal came from older selective-v1 behavior;
  the current v4 policy deliberately refuses that visible acceleration path.
- This should not be promoted as paper evidence for "adaptive selector works."
