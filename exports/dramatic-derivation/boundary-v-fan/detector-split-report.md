# E4a detector-split dry report

Frozen-artifact classification only. Registered run verdicts stand; this report labels what kind of non-grounding the existing mechanical trace most resembles.

| arm | verdict | guard | failure mode | split class | key evidence |
|---|---|---|---|---|---|
| `lantern-e2-real-r1` | disengagement t12 | `unguarded` | `early_pull_death` | `tempo_starved_house` | tempo-insolvent tutor release(s): p_bearing@t3, p_chart@t7 |
| `lantern-e2-real-r2` | grounded_anagnorisis t20 | `unguarded` | `grounded` | `grounded_control` | grounded verdict; no detector split applied |
| `lantern-e2-real-r3` | grounded_anagnorisis t20 | `unguarded` | `grounded` | `grounded_control` | grounded verdict; no detector split applied |
| `lantern-e2-real-r4` | grounded_anagnorisis t20 | `unguarded` | `grounded` | `grounded_control` | grounded verdict; no detector split applied |
| `lantern-e2-real-r5` | disengagement t12 | `unguarded` | `early_pull_death` | `tempo_starved_house` | tempo-insolvent tutor release(s): p_bearing@t3, p_chart@t7 |
| `lantern-e2-real-r6` | disengagement t12 | `unguarded` | `early_pull_death` | `tempo_starved_house` | tempo-insolvent tutor release(s): p_bearing@t3, p_chart@t7 |
| `lantern-e2-real-r7` | disengagement t12 | `unguarded` | `early_pull_death` | `tempo_starved_house` | tempo-insolvent tutor release(s): p_bearing@t3, p_chart@t7 |
| `lantern-e2-real-r8` | disengagement t12 | `unguarded` | `early_pull_death` | `tempo_starved_house` | tempo-insolvent tutor release(s): p_bearing@t3, p_chart@t7 |
| `lantern-e2-real-r9` | grounded_anagnorisis t20 | `unguarded` | `grounded` | `grounded_control` | grounded verdict; no detector split applied |
| `lantern-e2-real-r10` | aporia t8 | `unguarded` | `early_pull_death` | `tempo_starved_house` | tempo-insolvent tutor release(s): p_bearing@t3 |
| `lantern-e2-guard-r1` | disengagement t7 | `pacing` | `decay_seating_death` | `decay_starved_stall` | 1 unrepaired dropped premise(s) at end |
| `lantern-e2-guard-r2` | grounded_anagnorisis t20 | `pacing` | `grounded` | `grounded_control` | grounded verdict; no detector split applied |
| `lantern-e2-guard-r3` | grounded_anagnorisis t20 | `pacing` | `grounded` | `grounded_control` | grounded verdict; no detector split applied |
| `lantern-e2-guard-r4` | grounded_anagnorisis t20 | `pacing` | `grounded` | `grounded_control` | grounded verdict; no detector split applied |
| `lantern-e2-guard-r5` | grounded_anagnorisis t20 | `pacing` | `grounded` | `grounded_control` | grounded verdict; no detector split applied |
| `lantern-e2-visible-r1` | grounded_anagnorisis t20 | `visible` | `grounded` | `grounded_control` | grounded verdict; no detector split applied |
| `lantern-e2-visible-r2` | grounded_anagnorisis t20 | `visible` | `grounded` | `grounded_control` | grounded verdict; no detector split applied |
| `lantern-e2-visible-r3` | grounded_anagnorisis t20 | `visible` | `grounded` | `grounded_control` | grounded verdict; no detector split applied |
| `lantern-e2-visible-r4` | grounded_anagnorisis t20 | `visible` | `grounded` | `grounded_control` | grounded verdict; no detector split applied |
| `lantern-e2-visible-r5` | grounded_anagnorisis t20 | `visible` | `grounded` | `grounded_control` | grounded verdict; no detector split applied |

## Guard × failure-mode contingency

Counts over 20 classifiable arm(s). Keyed on mechanism, not terminal verdict shape.

| guard state | grounded | early_pull_death | decay_seating_death | n |
|---|---|---|---|---|
| `unguarded` | 4 | 6 | 0 | 10 |
| `pacing` | 4 | 0 | 1 | 5 |
| `visible` | 5 | 0 | 0 | 5 |
| **all** | **13** | **6** | **1** | **20** |

## Interpretation

Public failure modes (coarse, mechanism-keyed):

- `grounded`: recognition earned; the board carried the learner to the secret.
- `early_pull_death`: an exhibit was released before it was tempo-solvent (the house ran ahead of the board).
- `decay_seating_death`: an already-seated exhibit decayed unrepaired and the learner lost the thread.
- `aporia`: no licensed tutor-supply window existed when the dialogue stalled.
- `unresolved`: non-grounding with no registered split trigger.

Detailed split classes (the forensic axis the modes project from):

- `grounded_control`: negative-control survivor; no detector split applied.
- `tempo_starved_house`: a licensed tutor release was tempo-insolvent under the production D/stall arithmetic.
- `decay_starved_stall`: unrepaired decay left the board short, without repeated final overreach.
- `decay_starved_lucky_leap`: unrepaired decay left the board short while the learner kept asserting or deriving ahead of the board.
- `supply_starved_stall`: no licensed tutor-supply window existed in the terminal detector span.

