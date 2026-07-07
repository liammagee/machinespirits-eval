# A21 Initial Scaffold Report

Date: 2026-06-16

## Status

A20/Phase 6 remains frozen as negative evidence against promoting the
conduct/progress/learner-entitlement overlay. A21 is opened as a separate
zero-paid action-value microbench arc.

This increment implements only the first deterministic scaffold:

- `docs/research/A21-action-value-tutoring-microbench.md`
- `services/dramaticDerivation/a21/actionSet.js`
- `services/dramaticDerivation/a21/learnerState.js`
- `services/dramaticDerivation/a21/learnerSimulator.js`
- focused tests for action set, learner state, and learner simulator

## Guardrails

- No selector default changed.
- No conduct-policy enforcement default changed.
- No hidden+proofDebt behavior changed.
- No replay or fresh paid run launched.
- No broad situation taxonomy added.
- The action set encodes exactly four Hethel kill-gate candidate actions and no winner.

## Implemented Mechanics

The scaffold separates:

- concrete tutor action (`A21Action`);
- durable learner state;
- evidence seen versus dependency owned;
- repeated diagnostic cost;
- proof progress proxy (`D`) inside the simulator state;
- action assignment probability logging for later microbench trials.

The learner simulator enforces:

- diagnostics cannot spontaneously repair the target misconception;
- repeated diagnostics without new evidence increase cost and can trigger aporia;
- releasing `p_point` marks evidence seen but does not grant dependency ownership;
- dependency repair requires seen evidence or a permitted public restatement;
- consolidation can repair ownership only after the relevant evidence has been seen.

## Validation

Command:

```bash
node --test tests/dramaticDerivationA21ActionSet.test.js tests/dramaticDerivationA21LearnerState.test.js tests/dramaticDerivationA21LearnerSimulator.test.js
```

Result:

```text
11 pass, 0 fail
```

Regression command:

```bash
node --test tests/dramaticDerivationConductPolicy.test.js tests/dramaticDerivationReplay.test.js tests/dramaticDerivationProofDebt.test.js tests/dramaticDerivationRuntimeMonitor.test.js
```

Result:

```text
43 pass, 0 fail
```

Full-suite command:

```bash
npm test
```

Result:

```text
3748 pass, 1 skipped, 0 fail
```

## Next Gate

The next useful increment is Phase 1/2: implement the Hethel contrastive autopsy
and build the frozen trigger fixture from existing artifacts. The fixture should
identify one primary divergent action point before the microbench runner is
implemented.
