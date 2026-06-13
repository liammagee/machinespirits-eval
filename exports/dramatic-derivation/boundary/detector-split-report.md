# E4a detector-split dry report

Frozen-artifact classification only. Registered run verdicts stand; this report labels what kind of non-grounding the existing mechanical trace most resembles.

| arm | verdict | guard | failure mode | split class | key evidence |
|---|---|---|---|---|---|
| `lantern-p2-plot-on` | aporia t8 | `unguarded` | `early_pull_death` | `tempo_starved_house` | tempo-insolvent tutor release(s): p_bearing@t3, p_chart@t7 |
| `lantern-p3-repair-on` | grounded_anagnorisis t20 | `unguarded` | `grounded` | `grounded_control` | grounded verdict; no detector split applied |
| `lantern-p4-hygiene-on` | grounded_anagnorisis t20 | `unguarded` | `grounded` | `grounded_control` | grounded verdict; no detector split applied |
| `lantern-p5-mutation-on` | aporia t12 | `unguarded` | `early_pull_death` | `tempo_starved_house` | tempo-insolvent tutor release(s): p_chart@t7 |
| `lantern-e2-real-r1` | disengagement t12 | `unguarded` | `early_pull_death` | `tempo_starved_house` | tempo-insolvent tutor release(s): p_bearing@t3, p_chart@t7 |
| `lantern-e2-real-r5` | disengagement t12 | `unguarded` | `early_pull_death` | `tempo_starved_house` | tempo-insolvent tutor release(s): p_bearing@t3, p_chart@t7 |
| `lantern-e3-real-r1` | disengagement t24 | `pacing` | `decay_seating_death` | `decay_starved_lucky_leap` | 2 unrepaired dropped premise(s) at end; 4 lucky leap(s), 12 overreach event(s); terminal learner text names dropped premise(s): p_bearing |
| `lantern-e5-proof-debt-real-r1` | grounded_anagnorisis t20 | `proof_debt` | `grounded` | `grounded_control` | grounded verdict; no detector split applied |

## Guard × failure-mode contingency

Counts over 8 classifiable arm(s). Keyed on mechanism, not terminal verdict shape.

| guard state | grounded | early_pull_death | decay_seating_death | n |
|---|---|---|---|---|
| `unguarded` | 2 | 4 | 0 | 6 |
| `pacing` | 0 | 0 | 1 | 1 |
| `proof_debt` | 1 | 0 | 0 | 1 |
| **all** | **3** | **4** | **1** | **8** |

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

