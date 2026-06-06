# A18.32 Fold-Anchor Cue-Map Preflight

Date: 2026-06-06

Status: zero-API preflight passed. No replay or panel scoring has been run in
this step.

## Family

Config:

`config/recursive-tutor-learning/a18.32-fresh-family-cue-pass.yaml`

Family:

`fold_anchor_priority`

Selected repair:

`anchor_fold_test`

Cue-map sidecar:

`config/recursive-tutor-learning/a18-post-v2-cue-maps.yaml`

## Validation

Protocol validator:

```bash
npm run poetics:recursive-tutor-protocol -- \
  --protocol config/recursive-tutor-learning/a18-panel-vote-rule-v2.yaml \
  --config config/recursive-tutor-learning/a18.32-fresh-family-cue-pass.yaml \
  --family fold_anchor_priority
```

Result:

- status: `pass`
- errors: `0`
- warnings: `0`

Benchmark dry-run:

```bash
npm run poetics:recursive-tutor-learning -- \
  --config config/recursive-tutor-learning/a18.32-fresh-family-cue-pass.yaml \
  --out-dir exports/recursive-tutor-learning/a18.32-fresh-family-local \
  --dry-run
```

Result:

- valid: `true`
- issues: `0`
- status counts: `ready_for_attempt1: 1`

Cue-risk reporter:

```bash
npm run poetics:recursive-tutor-cue-risk -- \
  --config config/recursive-tutor-learning/a18.32-fresh-family-cue-pass.yaml \
  --cue-map config/recursive-tutor-learning/a18-post-v2-cue-maps.yaml \
  --family fold_anchor_priority
```

Result:

- status: `pass`
- issues: `[]`

Lexical-risk screen:

- public fields searched: `12`
- selected-policy phrase hits: `0`

## Interpretation

This is the first post-A18.31 candidate to clear the new cue-map gate before
replay. It is deliberately shaped like the prior selector/bead positives:

- medium-visible cue;
- explicit old-check counterexample in the cue map;
- selected target with more than one support cue;
- marker aliases broad enough for natural policy language;
- selected-policy vocabulary absent from public seed fields.

The next step is local replay only. No panel is justified until both held-out
siblings become local candidates.
