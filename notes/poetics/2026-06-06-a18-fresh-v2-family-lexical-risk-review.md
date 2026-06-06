# A18.25 Fresh Post-V2 Family Lexical-Risk Review

Date: 2026-06-06

Status: zero-API fixture authoring and validation complete. No replay
generation or panel scoring has been run.

## Family

Config:

`config/recursive-tutor-learning/a18.25-fresh-family-v2.yaml`

Family:

`diagonal_socket_priority`

Selected repair:

`diagonal_socket_test`

Protocol:

`config/recursive-tutor-learning/a18-panel-vote-rule-v2.yaml`

## Validation

Protocol validator:

```bash
npm run poetics:recursive-tutor-protocol -- \
  --protocol config/recursive-tutor-learning/a18-panel-vote-rule-v2.yaml \
  --config config/recursive-tutor-learning/a18.25-fresh-family-v2.yaml \
  --family diagonal_socket_priority
```

Result:

- status: `pass`
- families checked: `1`
- errors: `0`
- warnings: `0`

Benchmark dry-run:

```bash
npm run poetics:recursive-tutor-learning -- \
  --config config/recursive-tutor-learning/a18.25-fresh-family-v2.yaml \
  --out-dir exports/recursive-tutor-learning/a18.25-fresh-family-local \
  --dry-run
```

Result:

- valid: `true`
- issues: `0`
- status counts: `ready_for_attempt1: 1`

## Lexical-Risk Screen

Public fields checked:

- `training_seed.public_setup`
- `training_seed.learner_resistance`
- `training_seed.baseline_tutor_attempt`
- `training_seed.learner_followup`
- the same four fields on both held-out siblings

Phrases searched:

- `diagonal socket`
- `socket diagonal`
- `opposite corner`
- `corner mate`
- `mirror corner`
- `paired offset chooses`
- `diagonal`
- `socket`
- `opposite`
- `corner`
- `mirror`
- `paired offset`

Result:

- public fields searched: `12`
- hits: `0`

## Interpretation

The selected policy vocabulary is not present in the public transcript seeds.
The family is a valid post-v2 candidate for local replay. This does not yet say
anything about adaptation: A18.26 must still show attempt-1 survival, policy
fill, and S1-over-S0 local headroom before any panel is justified.
