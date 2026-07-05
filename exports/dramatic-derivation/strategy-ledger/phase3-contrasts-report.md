# Strategy Ledger Phase 3 — pre-registered pilot contrasts

Worlds: bitterwell, ravensmark. Arm counts: baseline=6, ledger=6, ledger-palette=6, ledger-learner=6.
All endpoints programmatic (no LLM judge). Pilot tier: signals are directional, not significance claims.

## Guardrails

| guardrail | ok | detail |
|---|---|---|
| leaks | PASS | 0 run(s) with leak events |
| aporia-bitterwell-ledger | PASS | bitterwell/ledger: aporia-like verdicts 0 vs baseline 0 |
| releases-bitterwell-ledger | PASS | bitterwell/ledger: mean releases 7.00 vs baseline 7.00 |
| aporia-bitterwell-ledger-palette | PASS | bitterwell/ledger-palette: aporia-like verdicts 0 vs baseline 0 |
| releases-bitterwell-ledger-palette | PASS | bitterwell/ledger-palette: mean releases 7.00 vs baseline 7.00 |
| aporia-bitterwell-ledger-learner | PASS | bitterwell/ledger-learner: aporia-like verdicts 0 vs baseline 0 |
| releases-bitterwell-ledger-learner | PASS | bitterwell/ledger-learner: mean releases 7.00 vs baseline 7.00 |
| aporia-ravensmark-ledger | PASS | ravensmark/ledger: aporia-like verdicts 0 vs baseline 0 |
| releases-ravensmark-ledger | PASS | ravensmark/ledger: mean releases 5.00 vs baseline 5.00 |
| aporia-ravensmark-ledger-palette | PASS | ravensmark/ledger-palette: aporia-like verdicts 0 vs baseline 0 |
| releases-ravensmark-ledger-palette | PASS | ravensmark/ledger-palette: mean releases 5.00 vs baseline 5.00 |
| aporia-ravensmark-ledger-learner | PASS | ravensmark/ledger-learner: aporia-like verdicts 0 vs baseline 0 |
| releases-ravensmark-ledger-learner | PASS | ravensmark/ledger-learner: mean releases 5.00 vs baseline 5.00 |
| commit-coverage | PASS | mean commitment coverage 1.00 across ledger arms |
| intent-coverage | PASS | mean learner intent coverage 1.00 in ledger-learner |

## Contrasts

### E1 — persistence (ledger vs baseline)

| endpoint | better | treat mean±sd | control mean±sd | Δ | pooled sd | U/Umax | per-world dir | signal |
|---|---|---|---|---|---|---|---|---|
| modeFlapRate | lower | 0.12±0.11 (n=6) | 0.10±0.12 (n=6) | 0.02 | 0.11 | 19.5/36 | 0,1 | no |
| timeToRecognition | lower | 15.33±0.52 (n=6) | 15.00±0.00 (n=6) | 0.33 | 0.39 | 24/36 | 0,1 | no |
| grounded | higher | 1.00±0.00 (n=6) | 1.00±0.00 (n=6) | 0.00 | 0.00 | 18/36 | 0,0 | no |

### E2 — register-as-decision (ledger-palette vs ledger)

| endpoint | better | treat mean±sd | control mean±sd | Δ | pooled sd | U/Umax | per-world dir | signal |
|---|---|---|---|---|---|---|---|---|
| modeFlapRate | lower | 0.14±0.09 (n=6) | 0.12±0.11 (n=6) | 0.02 | 0.10 | 21/36 | -1,1 | no |
| timeToRecognition | lower | 15.17±0.41 (n=6) | 15.33±0.52 (n=6) | -0.17 | 0.45 | 15/36 | 1,-1 | no |
| grounded | higher | 1.00±0.00 (n=6) | 1.00±0.00 (n=6) | 0.00 | 0.00 | 18/36 | 0,0 | no |

### E3 — learner-mirror (ledger-learner vs ledger)

| endpoint | better | treat mean±sd | control mean±sd | Δ | pooled sd | U/Umax | per-world dir | signal |
|---|---|---|---|---|---|---|---|---|
| timeToRecognition | lower | 15.17±0.41 (n=6) | 15.33±0.52 (n=6) | -0.17 | 0.45 | 15/36 | 1,-1 | no |
| voicedCount | higher | 1.50±0.55 (n=6) | 1.83±0.98 (n=6) | -0.33 | 0.78 | 15/36 | 0,-1 | no |
| overreachCount | lower | 0.00±0.00 (n=6) | 0.00±0.00 (n=6) | 0.00 | 0.00 | 18/36 | 0,0 | no |
| hypothesisCount | higher | 13.33±0.82 (n=6) | 13.83±0.75 (n=6) | -0.50 | 0.79 | 12.5/36 | 0,-1 | no |

## Descriptives

Register switches/run by arm: {"baseline":0,"ledger":0,"ledger-palette":0,"ledger-learner":0}
D-AUC by arm: baseline=1.90, ledger=1.88, ledger-palette=1.87, ledger-learner=1.87
Audit kept/drift: {"ledger":{"kept":75,"drift":40},"ledger-palette":{"kept":67,"drift":43},"ledger-learner":{"kept":71,"drift":39}}
Blocks (rows/cleared): {"ledger":{"rows":1,"cleared":1},"ledger-palette":{"rows":1,"cleared":1},"ledger-learner":{"rows":3,"cleared":1}}

