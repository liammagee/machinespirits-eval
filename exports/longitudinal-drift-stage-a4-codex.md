# Longitudinal Drift — Stage A4 (structural check-in pilot) live scoring

Checker `longitudinalDriftChecker@1.2` · deterministic, judge-free · opening tutor turn only

## Per-session rows

| Arm | Session | Run ID | Opening | Content-bearing check-in | Continuity-ack |
| --- | ---: | --- | --- | :---: | :---: |
| padOn | 1 | eval-2026-07-07-139daa20 | 107 chars | n/a (not applicable) | n/a (not applicable) |
| padOn | 2 | eval-2026-07-07-ffaac9d7 | 119 chars | miss | miss |
| padOn | 3 | eval-2026-07-07-44a48b61 | 113 chars | HIT | HIT |
| padOff | 1 | eval-2026-07-07-433a19d2 | 126 chars | n/a (not applicable) | n/a (not applicable) |
| padOff | 2 | eval-2026-07-07-b7b30353 | 103 chars | miss | miss |
| padOff | 3 | eval-2026-07-07-49cbde02 | 153 chars | HIT | HIT |

## Frozen §9 "4-slot" aggregate (2 sessions × 2 checkers)

| Arm | Slots hit | Slots applicable | Instrument failures |
| --- | :---: | ---: | ---: |
| pad-ON (cell_40, learner-id) | 2/4 | 4 | 0 |
| pad-OFF (cell_93, no learner-id) | 2/4 | 4 | 0 |

- **Structural-signal gate** (pad-ON >= 3/4 AND pad-OFF = 0/4): **FAIL** (pad-ON 2/4, pad-OFF 2/4). Directional-only at this n — scaling needs a fresh pre-registration (§9).
- **Red flag** (any pad-OFF content-bearing hit): **RAISED** — investigate for leakage, do not fold into a positive pad-OFF finding.

## Pad-content secondary trace (pad-ON)

Pad `a4c-drift-padon-v1-2026-07-07`: total_recognition_moments **2**, raw moments **2**, updated 2026-07-07 09:49:33.

| voice | need | synthesis | transformative | layer |
| --- | --- | --- | :---: | --- |
| The suggestion correctly honors the learner's x=0 self-check, but it still evades the exact rule the learner is asking for. Framing this as 'experience corrects a first answer' turns a concrete algebra misconception into an abstract review target. | support_during_struggle | Flip the **inequality** sign exactly when you multiply or divide both sides by a | true | unconscious |
| The suggestion correctly targets the learner’s denominator habit, but it misfires on this example: for 1/3 + 1/5, 15 is already the least common denominator. A stronger intervention would validate this case, then ask the learner to explain why 1/4 + 1/6 has a smaller shared denominator while 1/3 + 1/5 does not. | support_during_struggle | Yes: for 1/3 + 1/5, 15 is the least common denominator because 3 and 5 share no  | true | unconscious |
