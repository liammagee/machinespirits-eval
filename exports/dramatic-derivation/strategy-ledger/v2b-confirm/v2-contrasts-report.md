# Strategy Ledger v2 — pre-registered pilot contrasts (binding conditions)

Worlds: hethel-resistant, marrick. Arm counts: baseline=12, ledger-v1=12, trialling=0, trialling-learner=0.
All endpoints programmatic (no LLM judge). Pilot tier: signals are directional, not significance claims.

## Guardrails

| guardrail | ok | detail |
|---|---|---|
| leaks | PASS | 0 run(s) with leak events |
| aporia-hethel-resistant-ledger-v1 | FAIL | hethel-resistant/ledger-v1: aporia-like verdicts 4 vs baseline 2 |
| releases-hethel-resistant-ledger-v1 | PASS | hethel-resistant/ledger-v1: mean releases 7.17 vs baseline 7.33 |
| aporia-marrick-ledger-v1 | PASS | marrick/ledger-v1: aporia-like verdicts 5 vs baseline 4 |
| releases-marrick-ledger-v1 | FAIL | marrick/ledger-v1: mean releases 7.00 vs baseline 7.67 |
| commit-coverage | PASS | mean commitment coverage 1.00 across ledger arms |
| guard-overrides | PASS | 0 run(s) with pacing-guard overrides |
| invalid-person-attack | PASS | 0 run(s) with invalid corrosive violations |

## Contrasts

### V2a — trialling (trialling vs ledger-v1)

| endpoint | better | treat mean±sd | control mean±sd | Δ | pooled sd | U/Umax | per-world dir | signal |
|---|---|---|---|---|---|---|---|---|
| timeToRecognition | lower | —±— (n=0) | 27.17±2.33 (n=12) | — | 2.33 | — | — | no |
| grounded | higher | —±— (n=0) | 0.25±0.45 (n=12) | — | 0.45 | — | — | no |
| repairLatency | lower | —±— (n=0) | 8.02±1.20 (n=12) | — | 1.20 | — | — | no |
| aporiaLike | lower | —±— (n=0) | 0.75±0.45 (n=12) | — | 0.45 | — | — | no |

### V2b — ledger-under-binding (ledger-v1 vs baseline)

| endpoint | better | treat mean±sd | control mean±sd | Δ | pooled sd | U/Umax | per-world dir | signal |
|---|---|---|---|---|---|---|---|---|
| timeToRecognition | lower | 27.17±2.33 (n=12) | 25.58±3.29 (n=12) | 1.58 | 2.90 | 91.5/144 | 1,1 | YES (worsens) |
| grounded | higher | 0.25±0.45 (n=12) | 0.50±0.52 (n=12) | -0.25 | 0.49 | 54/144 | -1,-1 | YES (worsens) |
| repairLatency | lower | 8.02±1.20 (n=12) | 9.24±1.97 (n=12) | -1.21 | 1.71 | 37.5/144 | -1,-1 | YES (improves) |
| aporiaLike | lower | 0.75±0.45 (n=12) | 0.50±0.52 (n=12) | 0.25 | 0.49 | 90/144 | 1,1 | YES (worsens) |

### V2c — learner-mirror-staged (trialling-learner vs trialling)

| endpoint | better | treat mean±sd | control mean±sd | Δ | pooled sd | U/Umax | per-world dir | signal |
|---|---|---|---|---|---|---|---|---|
| timeToRecognition | lower | —±— (n=0) | —±— (n=0) | — | — | — | — | no |
| voicedCount | higher | —±— (n=0) | —±— (n=0) | — | — | — | — | no |
| overreachCount | lower | —±— (n=0) | —±— (n=0) | — | — | — | — | no |
| hypothesisCount | higher | —±— (n=0) | —±— (n=0) | — | — | — | — | no |

## Descriptives

Register switches/run by arm: {"baseline":0,"ledger-v1":0,"trialling":null,"trialling-learner":null}
D-AUC by arm: baseline=3.59, ledger-v1=3.75, trialling=—, trialling-learner=—
Audit kept/drift: {"ledger-v1":{"kept":253,"drift":92},"trialling":{"kept":0,"drift":0},"trialling-learner":{"kept":0,"drift":0}}
Blocks (rows/cleared): {"ledger-v1":{"rows":41,"cleared":18},"trialling":{"rows":0,"cleared":0},"trialling-learner":{"rows":0,"cleared":0}}

## v2 estimands: assigned-arm vs faithful-arm (trialling)

Assigned runs: 0; faithful-arm runs: 0.
Assigned means: {"timeToRecognition":null,"grounded":null,"repairLatency":null,"aporiaLike":null}
Faithful means: {"timeToRecognition":null,"grounded":null,"repairLatency":null,"aporiaLike":null}

