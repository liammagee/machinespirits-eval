# A21 Phase 1/2 Report

Date: 2026-06-16

## Scope

Phase 1/2 was a zero-paid artifact pass. It did not launch replay, fresh
generation, or paid LLM calls.

## Commands

```bash
node scripts/a21-hethel-autopsy.js
node scripts/a21-build-trigger-fixture.js
node --test tests/dramaticDerivationA21ActionSet.test.js tests/dramaticDerivationA21LearnerState.test.js tests/dramaticDerivationA21LearnerSimulator.test.js tests/dramaticDerivationA21AutopsyFixture.test.js
```

## Outputs

- `exports/dramatic-derivation/a21-action-value/hethel-autopsy.md`
- `exports/dramatic-derivation/a21-action-value/hethel-autopsy.json`
- `exports/dramatic-derivation/a21-action-value/hethel-trigger-fixture.md`
- `exports/dramatic-derivation/a21-action-value/hethel-trigger-fixture.json`
- `exports/dramatic-derivation/a21-action-value/action-set.json`

## Result

The contrastive autopsy identifies one primary trigger:

- turn: 4
- prefix through: 3
- primary label: `release_starvation`
- secondary label: `diagnostic_overuse`

Hidden+proofDebt releases `p_point` on schedule at turn 4 and D falls from 5 to
4. The failed overlay spends turn 4 on another visible/hidden diagnostic against
`m_record`, does not release `p_point`, and stays at D=5. The later overlay
release at turn 6 is two turns late and the run ends in disengagement.

The trigger fixture therefore freezes the failed overlay public prefix through
turn 3, leaves turn 4 open for action-value trials, and stores the observed
hidden/failed turn-4 outcomes only as provenance.

## Validation

Focused A21 tests:

```text
12 pass, 0 fail
```

Full suite:

```bash
npm test
```

```text
3753 pass, 1 skipped, 0 fail
```

## Next Gate

Proceed to Phase 3/5 before any replay or paid run: use the fixture to run the
four frozen candidate actions through transition audit and reward scoring. Do not
promote a policy patch until the action-value table shows a concrete local
advantage over the failed overlay action and no hidden leakage.
