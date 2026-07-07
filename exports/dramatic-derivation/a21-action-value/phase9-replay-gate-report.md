# A21 Phase 9 Replay Gate Report

Generated: 2026-06-16

## Boundary

- Status: real episode replay gate from frozen prefix.
- Runtime default changed: no.
- Selector/HV defaults changed: no.
- Patch promoted: no.
- Fresh full paid run launched: no.
- Phase 10 no-harm screen launched: no.

## Source

- Source prefix: `exports/dramatic-derivation/loop/hethel-phase5g-a20-fresh-selective-v4-r1`
- Source verdict: `disengagement`
- Source conditions: selector-v4, proofDebt, conduct policy/enforcement
- Replay from turn: 4
- Prefix integrity: pass for both S0 and S1
- Proposed patch: `exports/dramatic-derivation/a21-action-value/policy-patch-proposal.json`
- Patch id: `a21_hethel_release_after_diagnostic_budget`
- Patch status: `proposed_only`

## Commands

```bash
DERIVATION_PROVIDER=codex DERIVATION_LEARNER_PROVIDER=claude DERIVATION_LEARNER_MODEL=sonnet DERIVATION_CLI_TIMEOUT_MS=900000 DERIVATION_LLM=real DERIVATION_TRACE=0 node scripts/run-derivation-episode.js --from exports/dramatic-derivation/loop/hethel-phase5g-a20-fresh-selective-v4-r1 --turn 4 --window 17 --real --pacing-guard-selective-v4 off --pacing-guard on --conduct-policy off --conduct-policy-enforce off --label phase9-a21-s0-hidden-proofdebt-from-t4 --out exports/dramatic-derivation/episodes --critic off --note "A21 Phase 9 S0 hidden+proofDebt replay from frozen Hethel trigger prefix"

DERIVATION_PROVIDER=codex DERIVATION_LEARNER_PROVIDER=claude DERIVATION_LEARNER_MODEL=sonnet DERIVATION_CLI_TIMEOUT_MS=900000 DERIVATION_LLM=real DERIVATION_TRACE=0 node scripts/run-derivation-episode.js --from exports/dramatic-derivation/loop/hethel-phase5g-a20-fresh-selective-v4-r1 --turn 4 --window 17 --real --pacing-guard-selective-v4 off --pacing-guard on --a21-policy-patch a21_hethel_release_after_diagnostic_budget --label phase9-a21-s1-hidden-proofdebt-a21patch-from-t4 --out exports/dramatic-derivation/episodes --critic off --note "A21 Phase 9 S1 hidden+proofDebt plus proposed A21 replay patch from frozen Hethel trigger prefix"
```

## Result Table

| arm | label | verdict | final D | forced turn | grounded turn | forced/asserted gap | release `p_point` | D curve | prefix |
|---|---|---:|---:|---:|---:|---:|---|---|---|
| S0 | `phase9-a21-s0-hidden-proofdebt-from-t4` | grounded_anagnorisis | 0 | 20 | 20 | 0 | t4 | 5,5,5,4,4,4,4,4,3,3,3,3,2,2,1,1,1,1,1,0 | pass |
| S1 | `phase9-a21-s1-hidden-proofdebt-a21patch-from-t4` | grounded_anagnorisis | 0 | 20 | 20 | 0 | t4 | 5,5,5,4,4,4,4,4,3,3,3,3,2,2,1,1,1,1,1,0 | pass |

## Release Timing

Both arms used the same material release sequence:

```text
m_record@t2
p_point@t4
m_yard@t6
m_bond@t8
p_surface@t9
p_mark@t13
p_brand@t15
p_carter@t20
```

Both arms reported:

- release-deviation turns with window: 7
- played: 3
- on schedule: 2
- early: 1
- held: 0
- forced: 0
- overridden: 0
- invalid claims: 0

## Conduct Patch Check

S1 ran with trigger-only conduct enforcement:

- `conductPolicy`: true
- `conductPolicyEnforce`: true
- `conductTriggerOnly`: true
- active conduct turns: 1
- inactive conduct turns: 16
- active reason code: `a21_release_after_diagnostic_budget`
- selected move family: `release_next_evidence`
- target premise: `p_point`
- realized move: `analogia`, target `p_point`, intent `release`
- realized release: `p_point`
- enforcement applied: false
- enforcement reason: `already_compliant`
- generator compliance: pass
- non-leak audit: pass

This confirms the replay flag is narrow: it did not re-enable general A20 conduct policy after the explicit A21 trigger.

## Interpretation

Phase 9 is a neutral pass. S1 satisfies the strict safety gate because it matches S0 on grounding, final `D=0`, forced/asserted gap, prefix integrity, release timing, and leak/compliance. It also improves over the historical failed A20 action at the trigger because it releases `p_point` rather than repeating the visible/hidden diagnostic loop.

But it does not beat hidden+proofDebt. S0 already released `p_point` on schedule at turn 4 and grounded at turn 20. The A21 patch therefore adds no demonstrated advantage over the current reliability substrate in this replay. It should not be promoted as a general runtime policy from this result.

## Next Decision

Do not run a fresh full paid validation from this evidence alone. The useful result is explanatory: the A21 microbench correctly identified why the failed overlay was bad, but Phase 9 shows hidden+proofDebt already takes the same winning action in this trigger state.

Reasonable next options:

1. Stop A21 policy promotion here and report A21 as an action-value explanation of hidden+proofDebt's strength.
2. Run Phase 10 only as a no-harm screen if we need to prove the replay flag is harmless, not because it has promotion value.
3. Search for a different fixed trigger where hidden+proofDebt does not already choose the action that A21 ranks highest.

## Artifacts

- `exports/dramatic-derivation/episodes/phase9-a21-s0-hidden-proofdebt-from-t4/diagnosis.json`
- `exports/dramatic-derivation/episodes/phase9-a21-s0-hidden-proofdebt-from-t4/result.json`
- `exports/dramatic-derivation/episodes/phase9-a21-s0-hidden-proofdebt-from-t4/transcript.md`
- `exports/dramatic-derivation/episodes/phase9-a21-s1-hidden-proofdebt-a21patch-from-t4/diagnosis.json`
- `exports/dramatic-derivation/episodes/phase9-a21-s1-hidden-proofdebt-a21patch-from-t4/result.json`
- `exports/dramatic-derivation/episodes/phase9-a21-s1-hidden-proofdebt-a21patch-from-t4/transcript.md`
