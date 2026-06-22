# Plan 2.5 AF6 Dogmatic Control Cheap Screen

Date: 2026-06-20

## Scope

This pass fixed only the ignored Plan 2.5 export controls and preview harness:

- `exports/plan2_5-rhetorical-dramatic-eval/af6-comparison-dramas.yaml`
- `exports/plan2_5-rhetorical-dramatic-eval/run-public-preview.mjs`

No tracked source files were edited, staged, or committed.

## Negative-control repair

The dogmatic arm was narrowed from an AF6 metric-family task into a protocol-completeness control:

- public task: verify whether the headline accuracy field is procedurally complete for sign-off
- allowed checks: source, signature, sign-off authority
- forbidden checks: recall, precision, confusion matrix, TP/TN/FP/FN, row/column totals, positive/minority-class rates, majority/null floor, baseline comparison, two-gate tests, deployment verdict, revised deployment claim

The preview harness now treats those metric-family terms as dogmatic-control leaks, including abbreviations and class/baseline variants that caused the prior full-fidelity leakage.

## Commands run

```bash
node --check exports/plan2_5-rhetorical-dramatic-eval/run-public-preview.mjs
```

```bash
PLAN25_PREVIEW_MODEL=haiku PLAN25_PREVIEW_ATTEMPTS=4 \
node exports/plan2_5-rhetorical-dramatic-eval/run-public-preview.mjs \
  --tag public-preview-haiku-dogmatic-protocol-control-20260620 \
  --force
```

```bash
node scripts/critic-poetics-structure.js \
  --critic rules \
  --sample-dir exports/plan2_5-rhetorical-dramatic-eval/public-preview-haiku-dogmatic-protocol-control-20260620/sample \
  --key exports/plan2_5-rhetorical-dramatic-eval/public-preview-haiku-dogmatic-protocol-control-20260620/key.yaml \
  --out exports/plan2_5-rhetorical-dramatic-eval/public-preview-haiku-dogmatic-protocol-control-20260620/structure-rules.json
```

## Cheap-screen result

Generation harness:

- T01 adaptive: passed generation validation on attempt 1
- T02 no-cue: passed on attempt 2 after one `no_cue_recognition_leak`
- T03 mismatch: wrote with remaining turn-count warnings after four attempts
- T04 dogmatic: passed generation validation on attempt 1
- T05 generic: wrote with remaining turn-count warnings after four attempts

Rule critic:

- 2/5 pass overall: T02 and T04
- T04 dogmatic passed with no rule violations or warnings
- T01, T03, and T05 failed `peripeteia_arm_without_earned_reorientation`; this is outside the dogmatic negative-control repair target and should not be read as a paid-battery pass.

Dogmatic direct leak audit:

- `metricRepair`: false
- `recognitiveRepair`: false
- `organicRecognition`: false
- `protocolPressure`: true

Dogmatic transcript summary: the tutor presses only the authorization/signature requirement on the existing headline accuracy field. The learner continues to defend the 0.94 accuracy value. There is no recall/precision/baseline/two-gate repair.

## Go / no-go

Go for a user-confirmed paid paired battery on the repaired dogmatic control.

Do not treat this cheap screen as proof of adaptive advantage. It only clears the immediate negative-control leak that made the earlier clean contrast unusable.
