# Hethel r2 Promoted-v4 Prefix Replay

Date: 2026-06-16

## Purpose

Test the mined Hethel r2 V-positive fixture with the current promoted
selector-v4 stack before spending on a fresh mixed-world matrix.

Source:

- `exports/dramatic-derivation/loop/hethel-selector-v1-selective-r2/`

The source run selected visible by `mirror_dead_predicate_visible` and grounded
at t20. The live replay begins at t7, where visible handling starts to matter:
the successful visible source soon pushes `p_surface`, the physical-cause
premise that keeps the dead Reyner liability branch from consuming the run.

## Episodes

| label | first live turn | window | prefix integrity | verdict | turns | final D | forced/asserted gap | selector selected |
| --- | ---: | ---: | --- | --- | ---: | ---: | ---: | --- |
| `hethel-vpositive-r2-promoted-v4-from-t7` | 7 | 8 | ok | cap_reached | 14 | 2 | n/a | hidden |
| `hethel-vpositive-r2-promoted-v4-from-t7-w16` | 7 | 16 | ok | grounded_anagnorisis | 20 | 0 | 0 | hidden |

Both episodes used the default mock suffix. No paid calls were made.

Overrides:

- `--pacing-guard-selective-v1 off`
- `--pacing-guard-selective-v4 on`
- `--proof-debt-guard on`
- `--conduct-policy-enforce on`

## Extended Replay Details

The extended replay grounded at t20:

- D curve: `5->5->5->5->4->4->4->4->3->3->3->3->2->2->2->2->1->1->1->0`
- S forced at t20 and asserted grounded at t20.
- Fabricated facts: 0.
- Overreach events: 1.
- Lucky leap: 0.
- Proof debt detected on two turns and repaired `p_point` twice: t7 and t9.
- Conduct compliance: 14/14 pass.
- Conduct enforcement applied 9/14 turns, all `ask_diagnostic` corrections from
  `visible_hidden_conflict`.

## Interpretation

The replay does not show that current selector-v4 has recovered the old
V-positive route. Selector-v4 selected hidden, not visible, so the old
`mirror_dead_predicate_visible` behavior is absent from the current policy.

The replay does show that promoted selector-v4 + proofDebt can survive the
Hethel r2 visible-prefix fixture. The current stack repairs `p_point`, keeps the
physical-cause chain moving, and grounds by t20 without fabrication, lucky leap,
or forced/asserted gap.

Mechanistically, the old visible benefit is partly absorbed by proofDebt plus
release authority once the source prefix has already passed the early visible
branch. This is useful but bounded replay evidence. It is not independent
evidence that adaptive H/V selection works.

## Recommended Next Step

If we need to know whether the current stack survives Hethel without inheriting
the visible prefix, run one fresh first-pass loop:

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

Interpretation rule:

- If fresh promoted v4 grounds, current v4 + proofDebt has probably neutralized
  Hethel's old hidden-hurts failure without truly selecting visible.
- If fresh promoted v4 stalls like hidden, then current v4 has lost the only
  strict visible-positive signal and needs a separate visible-route gate before
  any mixed-world selector matrix.
- If fresh promoted v4 grounds but with overreach/lucky leap, classify it as a
  guard/implementation artifact, not selector success.

## Commands Run

Short replay:

```bash
node scripts/run-derivation-episode.js \
  --from exports/dramatic-derivation/loop/hethel-selector-v1-selective-r2 \
  --turn 7 \
  --window 8 \
  --pacing-guard-selective-v1 off \
  --pacing-guard-selective-v4 on \
  --proof-debt-guard on \
  --conduct-policy-enforce on \
  --label hethel-vpositive-r2-promoted-v4-from-t7 \
  --out exports/dramatic-derivation/episodes
```

Extended replay:

```bash
node scripts/run-derivation-episode.js \
  --from exports/dramatic-derivation/loop/hethel-selector-v1-selective-r2 \
  --turn 7 \
  --window 16 \
  --pacing-guard-selective-v1 off \
  --pacing-guard-selective-v4 on \
  --proof-debt-guard on \
  --conduct-policy-enforce on \
  --label hethel-vpositive-r2-promoted-v4-from-t7-w16 \
  --out exports/dramatic-derivation/episodes
```

Artifacts:

- `exports/dramatic-derivation/episodes/hethel-vpositive-r2-promoted-v4-from-t7/`
- `exports/dramatic-derivation/episodes/hethel-vpositive-r2-promoted-v4-from-t7-w16/`

