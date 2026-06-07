# A18.23 V2 Protocol Validation and Packaging Smoke

Date: 2026-06-06

Status: zero-API validation/smoke complete.

## Commands

Protocol validation:

```bash
npm run poetics:recursive-tutor-protocol -- \
  --protocol config/recursive-tutor-learning/a18-panel-vote-rule-v2.yaml \
  --config config/recursive-tutor-learning/underdetermined-transfer-families.yaml
```

Result:

- status: `pass`
- families checked: `3`
- errors: `0`
- warnings: `0`

Targeted tests:

```bash
node --test tests/recursiveTutorPolicyContrastPanel.test.js
node --test tests/validateRecursiveTutorProtocol.test.js
```

Result:

- contrast-panel tests: `10/10 pass`
- protocol-validator tests: `3/3 pass`

No-score packaging smoke:

```bash
npm run poetics:recursive-tutor-contrast-panel -- \
  --chain-dir exports/recursive-tutor-learning/a18.19-fresh-family-local/sidepair_bracket_priority \
  --family sidepair_bracket_priority \
  --out-dir exports/recursive-tutor-learning/a18.19-fresh-family-local/sidepair_bracket_priority/a18.23-policy-core-v2-package-smoke \
  --run-id a18-23-policy-core-v2-package-smoke \
  --min-critics 5 \
  --panel-threshold majority \
  --vote-rule policy_core_v2 \
  --skip-score \
  --force
```

Result:

- packaged pairs: `2`
- scoring: skipped
- expected report status: `contrast_panel_not_yet_reliable` with zero votes
- manifest vote rule: `policy_core_v2`
- report vote rule: `policy_core_v2`

## Interpretation

The v2 rule is now executable and provenance-preserving. This does not change
A18.21's strict-v1 status. It only makes future policy-core panels explicitly
pre-registered and machine-recorded.
