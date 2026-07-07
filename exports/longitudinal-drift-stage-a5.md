# Longitudinal Drift — Stage A5 (negotiation threading, three-arm) live scoring

Checker `longitudinalDriftChecker@1.2` (byte-unchanged) · deterministic, judge-free · opening tutor turn only. 3-way aggregation/gates are new to this script (§11.4).

## Per-session rows

| Arm | Session | Run ID | Opening | Content-bearing check-in | Continuity-ack | Threading tagged/turns |
| --- | ---: | --- | --- | :---: | :---: | :---: |
| Arm 3: pad-OFF + threading ON (critical control) | 1 | eval-2026-07-07-74fc5845 | 228 chars | n/a (not applicable) | n/a (not applicable) | 4/4 |
| Arm 3: pad-OFF + threading ON (critical control) | 2 | eval-2026-07-07-a858c7b4 | 229 chars | HIT | HIT | 4/4 |
| Arm 3: pad-OFF + threading ON (critical control) | 3 | eval-2026-07-07-72f7d609 | 550 chars | HIT | HIT | 4/4 |

## Frozen §11.3 "4-slot" aggregate (2 sessions × 2 checkers) + threading-delivery diagnostic

| Arm | Slots hit | Slots applicable | Instrument failures | Threading-delivery rate |
| --- | :---: | ---: | ---: | :---: |
| Arm 1: pad-ON + threading ON | NOT RUN | — | — | — |
| Arm 2: pad-ON + threading OFF (§10 replication control) | NOT RUN | — | — | — |
| Arm 3: pad-OFF + threading ON (critical control) | 4/4 | 4 | 0 | 12/12 (100%) |

- **Structural-signal gate** (arm-1 >=3/4 AND arm-2 <=1/4 AND arm-3 =0/4): **NOT_EVALUABLE — arm(s) not run: padon-threadon, padon-threadoff (see the prereg §11.8 implementation log)** (arm-1 NOT RUN, arm-2 NOT RUN, arm-3 4/4 [fail]). Directional-only at this n — scaling needs a fresh pre-registration (§11.6).
- **§10 comparison line (frozen)**: arm 2 NOT RUN — no fresh replication datum; §10's own pad-ON **2/4** stands unchallenged.
- **Red flag** (arm-3 — the critical control — any content-bearing hit): **RAISED** — investigate for scenario-echo vs genuine fabrication per §11.4pt5/§11.5 before any positive reading.

## Pad-content secondary trace

### Arm 1 (pad-ON + threading ON)

_(no --learner-id-arm1 supplied)_

### Arm 2 (pad-ON + threading OFF)

_(no --learner-id-arm2 supplied)_
