# Strategy Ledger v2 — pre-registered pilot contrasts (binding conditions)

Worlds: hethel-resistant, marrick. Arm counts: baseline=6, ledger-v1=6, trialling=6, trialling-learner=0.
All endpoints programmatic (no LLM judge). Pilot tier: signals are directional, not significance claims.

## Guardrails

| guardrail | ok | detail |
|---|---|---|
| leaks | PASS | 0 run(s) with leak events |
| aporia-hethel-resistant-ledger-v1 | PASS | hethel-resistant/ledger-v1: aporia-like verdicts 1 vs baseline 0 |
| releases-hethel-resistant-ledger-v1 | PASS | hethel-resistant/ledger-v1: mean releases 8.00 vs baseline 8.00 |
| aporia-hethel-resistant-trialling | PASS | hethel-resistant/trialling: aporia-like verdicts 0 vs baseline 0 |
| releases-hethel-resistant-trialling | PASS | hethel-resistant/trialling: mean releases 8.00 vs baseline 8.00 |
| aporia-marrick-ledger-v1 | PASS | marrick/ledger-v1: aporia-like verdicts 1 vs baseline 2 |
| releases-marrick-ledger-v1 | PASS | marrick/ledger-v1: mean releases 9.00 vs baseline 8.67 |
| aporia-marrick-trialling | PASS | marrick/trialling: aporia-like verdicts 1 vs baseline 2 |
| releases-marrick-trialling | FAIL | marrick/trialling: mean releases 7.33 vs baseline 8.67 |
| commit-coverage | PASS | mean commitment coverage 1.00 across ledger arms |
| guard-overrides | PASS | 0 run(s) with pacing-guard overrides |
| invalid-person-attack | PASS | 0 run(s) with invalid corrosive violations |
| review-coverage | PASS | mean review coverage 1.00 on openings-with-history |

## Contrasts

### V2a — trialling (trialling vs ledger-v1)

| endpoint | better | treat mean±sd | control mean±sd | Δ | pooled sd | U/Umax | per-world dir | signal |
|---|---|---|---|---|---|---|---|---|
| timeToRecognition | lower | 24.67±4.76 (n=6) | 24.00±3.46 (n=6) | 0.67 | 3.98 | 19/36 | -1,1 | no |
| grounded | higher | 0.50±0.55 (n=6) | 0.67±0.52 (n=6) | -0.17 | 0.51 | 15/36 | 1,-1 | no |
| repairLatency | lower | 12.29±5.65 (n=6) | 8.06±2.42 (n=6) | 4.23 | 4.69 | 29.5/36 | 1,1 | YES (worsens) |
| aporiaLike | lower | 0.17±0.41 (n=6) | 0.33±0.52 (n=6) | -0.17 | 0.45 | 15/36 | -1,0 | no |

### V2b — ledger-under-binding (ledger-v1 vs baseline)

| endpoint | better | treat mean±sd | control mean±sd | Δ | pooled sd | U/Umax | per-world dir | signal |
|---|---|---|---|---|---|---|---|---|
| timeToRecognition | lower | 24.00±3.46 (n=6) | 24.33±4.23 (n=6) | -0.33 | 3.69 | 18/36 | 1,-1 | no |
| grounded | higher | 0.67±0.52 (n=6) | 0.67±0.52 (n=6) | 0.00 | 0.49 | 18/36 | -1,1 | no |
| repairLatency | lower | 8.06±2.42 (n=6) | 11.23±3.11 (n=6) | -3.17 | 3.13 | 8/36 | -1,-1 | YES (improves) |
| aporiaLike | lower | 0.33±0.52 (n=6) | 0.33±0.52 (n=6) | 0.00 | 0.49 | 18/36 | 1,-1 | no |

### V2c — learner-mirror-staged (trialling-learner vs trialling)

| endpoint | better | treat mean±sd | control mean±sd | Δ | pooled sd | U/Umax | per-world dir | signal |
|---|---|---|---|---|---|---|---|---|
| timeToRecognition | lower | —±— (n=0) | 24.67±4.76 (n=6) | — | 4.76 | — | — | no |
| voicedCount | higher | —±— (n=0) | 3.33±1.86 (n=6) | — | 1.86 | — | — | no |
| overreachCount | lower | —±— (n=0) | 0.00±0.00 (n=6) | — | 0.00 | — | — | no |
| hypothesisCount | higher | —±— (n=0) | 11.50±5.47 (n=6) | — | 5.47 | — | — | no |

## Descriptives

Register switches/run by arm: {"baseline":0,"ledger-v1":0,"trialling":0,"trialling-learner":null}
D-AUC by arm: baseline=3.28, ledger-v1=3.05, trialling=3.53, trialling-learner=—
Audit kept/drift: {"ledger-v1":{"kept":193,"drift":62},"trialling":{"kept":187,"drift":56},"trialling-learner":{"kept":0,"drift":0}}
Blocks (rows/cleared): {"ledger-v1":{"rows":43,"cleared":19},"trialling":{"rows":20,"cleared":7},"trialling-learner":{"rows":0,"cleared":0}}

## v2 estimands: assigned-arm vs faithful-arm (trialling)

Assigned runs: 6; faithful-arm runs: 1.
Assigned means: {"timeToRecognition":24.666666666666668,"grounded":0.5,"repairLatency":12.291666666666666,"aporiaLike":0.16666666666666666}
Faithful means: {"timeToRecognition":21,"grounded":1,"repairLatency":15,"aporiaLike":0}

