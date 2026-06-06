# A18.28 Non-Inverse Fresh Family Lexical-Risk Review

Date: 2026-06-06

Status: zero-API fixture authoring and validation complete. No replay
generation or panel scoring has been run.

## Family

Config:

`config/recursive-tutor-learning/a18.28-fresh-family-non-inverse.yaml`

Family:

`thread_source_priority`

Selected repair:

`source_end_test`

Protocol:

`config/recursive-tutor-learning/a18-panel-vote-rule-v2.yaml`

## Validation

Protocol validator:

```bash
npm run poetics:recursive-tutor-protocol -- \
  --protocol config/recursive-tutor-learning/a18-panel-vote-rule-v2.yaml \
  --config config/recursive-tutor-learning/a18.28-fresh-family-non-inverse.yaml \
  --family thread_source_priority
```

Result:

- status: `pass`
- families checked: `1`
- errors: `0`
- warnings: `0`

Benchmark dry-run:

```bash
npm run poetics:recursive-tutor-learning -- \
  --config config/recursive-tutor-learning/a18.28-fresh-family-non-inverse.yaml \
  --out-dir exports/recursive-tutor-learning/a18.28-fresh-family-local \
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

- `source end`
- `source dot`
- `origin nub`
- `start end`
- `carrier end`
- `taper is destination`
- `taper-is-destination`
- `source`
- `origin`
- `carrier`

Result:

- public fields searched: `12`
- hits: `0`

## Interpretation

This family is designed to avoid the A18.27 inverse-relation failure. The
selected repair asks whether the round end of a thread mark determines the
carrier, while public text leaves color, nearness, lane continuity, taper
direction, and small-nub salience as plausible competing repairs.

The next step is local replay only. No panel is justified until both held-out
siblings become local candidates.
