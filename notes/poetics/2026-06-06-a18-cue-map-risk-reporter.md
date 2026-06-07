# A18.31 Cue-Map Risk Reporter

Date: 2026-06-06

Status: zero-API preflight reporter implemented.

## Artifacts

Script:

`scripts/report-recursive-tutor-cue-map-risk.js`

NPM wrapper:

```bash
npm run poetics:recursive-tutor-cue-risk -- --config <family-yaml> --cue-map <cue-map-yaml> --family <family_id>
```

Cue-map sidecar:

`config/recursive-tutor-learning/a18-post-v2-cue-maps.yaml`

Test:

`tests/recursiveTutorCueMapRisk.test.js`

## Risk Classes

The reporter flags:

- `inverse_rule_instability_risk`
- `public_self_solving_risk`
- `target_salience_overload`
- `marker_too_narrow`
- `marker_too_broad`
- `counterexample_missing`

It reads the normal family fixture plus a cue-map sidecar that makes target
salience, public visibility, old-check counterexamples, and natural marker
aliases explicit.

## Validation

Targeted test:

```bash
node --test tests/recursiveTutorCueMapRisk.test.js
```

Result:

- `2/2` pass

Reporter on `diagonal_socket_priority`:

- status: `fail`
- key error: `inverse_rule_instability_risk`
- warnings: `target_salience_overload`, `marker_too_narrow`,
  `counterexample_missing`

Reporter on `thread_source_priority`:

- status: `fail`
- key error: `public_self_solving_risk`
- warnings: `marker_too_narrow`, `counterexample_missing`

The nonzero CLI exit for these two commands is expected because both families
are known local negatives.

## Interpretation

A18.31 captures the higher-order lesson from A18.26/A18.29 in runnable form.
Future families should not proceed to attempt-1 replay until their cue-map
preflight passes or has an explicitly accepted warning profile.

This is the "teacher-as-learner" loop moved up one level: the system now stores
what it learned about failed family construction as a reusable gate, not just as
chat interpretation.
